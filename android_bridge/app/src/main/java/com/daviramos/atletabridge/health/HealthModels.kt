package com.daviramos.atletabridge.health

import kotlinx.coroutines.CancellationException
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

enum class Metric(val label: String, val column: String) {
    STEPS("Passos", "steps"), SLEEP("Sono", "sleep_minutes"),
    HEART_RATE("Batimentos", "avg_heart_rate"), RESTING_HEART_RATE("Batimentos em repouso", "resting_heart_rate"),
    CALORIES("Calorias ativas", "active_kcal"), WORKOUT("Atividade", "workout_minutes"), DISTANCE("Distância", "distance_km")
}

enum class ReadState { AVAILABLE, EMPTY, NO_PERMISSION, ERROR }

data class Reading(
    val state: ReadState,
    val value: Double? = null,
    val records: Int = 0,
    val samples: Int = 0,
    val validSamples: Int = 0,
    val ignoredSamples: Int = 0,
    val origins: Set<String> = emptySet(),
    val detail: String? = null
)

data class DayRead(val date: LocalDate, val metrics: Map<Metric, Reading>) {
    val partial get() = metrics.values.any { it.state == ReadState.ERROR || it.state == ReadState.NO_PERMISSION }
}

interface HealthSource {
    suspend fun grantedMetrics(): Set<Metric>
    suspend fun read(metric: Metric, date: LocalDate, zone: ZoneId): Reading
}

class DailyReader(private val source: HealthSource) {
    suspend fun readDay(date: LocalDate, zone: ZoneId): DayRead {
        val permissions = source.grantedMetrics()
        return DayRead(date, Metric.entries.associateWith { metric ->
            if (metric !in permissions) Reading(ReadState.NO_PERMISSION)
            else try {
                source.read(metric, date, zone)
            } catch (e: CancellationException) {
                throw e
            } catch (_: SecurityException) {
                Reading(ReadState.NO_PERMISSION, detail = "Permissão removida. Abra as permissões novamente.")
            } catch (_: Exception) {
                Reading(ReadState.ERROR, detail = "Não foi possível ler. Tente novamente ou confira o Health Connect.")
            }
        })
    }
}

data class Page<T>(val records: List<T>, val next: String?)

suspend fun <T> readAllPages(fetch: suspend (String?) -> Page<T>): List<T> {
    val records = mutableListOf<T>()
    val seenTokens = mutableSetOf<String>()
    var token: String? = null
    do {
        val page = fetch(token)
        records.addAll(page.records)
        token = page.next?.takeIf { it.isNotEmpty() }
        check(token == null || seenTokens.add(token)) { "Paginação repetida do Health Connect" }
    } while (token != null)
    return records
}

data class HeartSample(val time: Instant, val bpm: Long)
data class HeartRecord(val id: String, val origin: String, val samples: List<HeartSample>)
data class TimeWindow(val start: Instant, val end: Instant)

fun dayWindow(date: LocalDate, zone: ZoneId) = TimeWindow(
    date.atStartOfDay(zone).toInstant(), date.plusDays(1).atStartOfDay(zone).toInstant()
)

fun heartReading(records: List<HeartRecord>, window: TimeWindow): Reading {
    // Exact timestamps and all origins; never deduplicate by minute or day.
    val all = records.flatMap { record -> record.samples.map { record.origin to it } }
    val valid = all.filter { (_, sample) ->
        sample.bpm in 1..300 && sample.time >= window.start && sample.time < window.end
    }.distinctBy { (origin, sample) -> Triple(origin, sample.time, sample.bpm) }
    return Reading(
        state = if (valid.isEmpty()) ReadState.EMPTY else ReadState.AVAILABLE,
        value = valid.takeIf { it.isNotEmpty() }?.map { it.second.bpm.toDouble() }?.average(),
        records = records.distinctBy { it.origin to it.id }.size,
        samples = all.size, validSamples = valid.size, ignoredSamples = all.size - valid.size,
        origins = records.map { it.origin }.toSet()
    )
}

fun mergedWindows(windows: List<TimeWindow>, bounds: TimeWindow): List<TimeWindow> {
    val result = mutableListOf<TimeWindow>()
    windows.map { TimeWindow(maxOf(it.start, bounds.start), minOf(it.end, bounds.end)) }
        .filter { it.start < it.end }.sortedBy { it.start }.forEach { window ->
            val last = result.lastOrNull()
            if (last == null || window.start > last.end) result.add(window)
            else result[result.lastIndex] = TimeWindow(last.start, maxOf(last.end, window.end))
        }
    return result
}

fun workoutMinutes(windows: List<TimeWindow>, bounds: TimeWindow): Double? =
    mergedWindows(windows, bounds).takeIf { it.isNotEmpty() }
        ?.sumOf { Duration.between(it.start, it.end).seconds }?.div(60.0)

fun sleepMinutes(windows: List<TimeWindow>, bounds: TimeWindow): Double? =
    mergedWindows(windows, bounds).map { Duration.between(it.start, it.end).toMinutes() }
        .filter { it in 30..960 }.maxOrNull()?.toDouble()
