package com.daviramos.atletabridge.health

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.daviramos.atletabridge.data.DailyHealthSummary
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import kotlin.math.ceil
import kotlin.math.roundToLong

object HealthConnectBridgeConfig {
    val readPermissions: Set<String> = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(RestingHeartRateRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class)
    )

    val basicPermissions: Set<String> = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class)
    )

    val requestPermissionsContract = PermissionController.createRequestPermissionResultContract()

    fun friendlyName(permission: String): String = when {
        permission.contains("STEPS") -> "passos"
        permission.contains("DISTANCE") -> "distância"
        permission.contains("ACTIVE_CALORIES") -> "calorias ativas"
        permission.contains("HEART_RATE") && !permission.contains("RESTING") -> "frequência cardíaca"
        permission.contains("RESTING_HEART_RATE") -> "frequência cardíaca de repouso"
        permission.contains("SLEEP") -> "sono"
        permission.contains("EXERCISE") -> "treinos"
        else -> permission.substringAfterLast('.')
    }
}

class HealthConnectReader(private val context: Context) {
    private val client by lazy { HealthConnectClient.getOrCreate(context) }

    private val preferredSourcePackages = setOf(
        "com.xiaomi.wearable",
        "com.xiaomi.wearable.global",
        "com.mi.health",
        "com.mi.health.global",
        "com.xiaomi.hm.health"
    )

    fun isAvailable(): Boolean =
        HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE

    suspend fun grantedPermissions(): Set<String> = client.permissionController.getGrantedPermissions()

    suspend fun missingPermissions(): Set<String> = HealthConnectBridgeConfig.readPermissions - grantedPermissions()

    suspend fun hasAnyReadPermission(): Boolean =
        grantedPermissions().any { it in HealthConnectBridgeConfig.readPermissions }

    suspend fun hasAllPermissions(): Boolean =
        grantedPermissions().containsAll(HealthConnectBridgeConfig.readPermissions)

    suspend fun permissionStatusText(): String {
        val granted = grantedPermissions()
        val missing = HealthConnectBridgeConfig.readPermissions - granted
        val grantedNames = granted
            .filter { it in HealthConnectBridgeConfig.readPermissions }
            .map(HealthConnectBridgeConfig::friendlyName)
            .sorted()
        val missingNames = missing
            .map(HealthConnectBridgeConfig::friendlyName)
            .sorted()

        return buildString {
            append("Concedidas: ")
            append(if (grantedNames.isEmpty()) "nenhuma" else grantedNames.joinToString(", "))
            if (missingNames.isNotEmpty()) {
                append("\nPendentes: ")
                append(missingNames.joinToString(", "))
            }
        }
    }

    suspend fun readDay(date: LocalDate = LocalDate.now()): DailyHealthSummary {
        val granted = grantedPermissions()
        val zone = ZoneId.systemDefault()
        val start = date.atStartOfDay(zone).toInstant()
        val end = date.plusDays(1).atStartOfDay(zone).toInstant()
        val range = TimeRangeFilter.between(start, end)

        // Janela da noite que terminou no dia consultado.
        val sleepSearchStart = date.minusDays(1).atTime(LocalTime.of(18, 0)).atZone(zone).toInstant()
        val sleepSearchEnd = date.atTime(LocalTime.of(18, 0)).atZone(zone).toInstant()
        val sleepSearchRange = TimeRangeFilter.between(sleepSearchStart, sleepSearchEnd)

        val restingSearchStart = date.minusDays(1).atStartOfDay(zone).toInstant()
        val restingSearchEnd = date.plusDays(1).atStartOfDay(zone).toInstant()
        val restingSearchRange = TimeRangeFilter.between(restingSearchStart, restingSearchEnd)

        val stepsPermission = HealthPermission.getReadPermission(StepsRecord::class)
        val distancePermission = HealthPermission.getReadPermission(DistanceRecord::class)
        val activeKcalPermission = HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class)
        val heartRatePermission = HealthPermission.getReadPermission(HeartRateRecord::class)
        val restingHeartRatePermission = HealthPermission.getReadPermission(RestingHeartRateRecord::class)
        val sleepPermission = HealthPermission.getReadPermission(SleepSessionRecord::class)
        val exercisePermission = HealthPermission.getReadPermission(ExerciseSessionRecord::class)

        val sleepRecords = if (sleepPermission in granted) {
            runCatching {
                client.readRecords(
                    ReadRecordsRequest(SleepSessionRecord::class, timeRangeFilter = sleepSearchRange)
                ).records.preferSleepSource()
            }.getOrElse { emptyList() }
        } else emptyList()

        // Correção v2.1:
        // O Mi Fitness pode escrever vários registros cumulativos com o mesmo início:
        // 22:57-00:46, 22:57-01:53, 22:57-04:51, 22:57-05:31, 22:57-06:20.
        // Somar tudo gera +24h de sono. O correto é tratar como registros sobrepostos
        // e usar o bloco consolidado/mais longo da noite.
        val mainSleepWindow = sleepRecords
            .mapNotNull { it.toClampedSleepWindow(sleepSearchStart, sleepSearchEnd) }
            .mergeOverlaps()
            .filter { it.durationMinutes in 30..(16 * 60) }
            .maxByOrNull { it.durationMinutes }

        val sleepWindows = mainSleepWindow?.let { listOf(it) } ?: emptyList()

        val steps = if (stepsPermission in granted) {
            runCatching {
                val records = client.readRecords(
                    ReadRecordsRequest(StepsRecord::class, timeRangeFilter = range)
                ).records.preferStepSource()
                records.sumOf { it.count }
            }.getOrNull()
        } else null

        val distanceKm = if (distancePermission in granted) {
            runCatching {
                val records = client.readRecords(
                    ReadRecordsRequest(DistanceRecord::class, timeRangeFilter = range)
                ).records.preferDistanceSource()
                records.sumOf { it.distance.inKilometers }
            }.getOrNull()
        } else null

        val activeKcal = if (activeKcalPermission in granted) {
            runCatching {
                val records = client.readRecords(
                    ReadRecordsRequest(ActiveCaloriesBurnedRecord::class, timeRangeFilter = range)
                ).records.preferActiveCaloriesSource()
                records.sumOf { it.energy.inKilocalories }
            }.getOrNull()
        } else null

        val dayHeartRateRecords = if (heartRatePermission in granted) {
            runCatching {
                client.readRecords(
                    ReadRecordsRequest(HeartRateRecord::class, timeRangeFilter = range)
                ).records.preferHeartRateSource()
            }.getOrElse { emptyList() }
        } else emptyList()

        val avgHeartRate = dayHeartRateRecords
            .flatMap { record -> record.samples.map { it.beatsPerMinute.toDouble() } }
            .takeIf { it.isNotEmpty() }
            ?.average()

        val nativeRestingHeartRate = if (restingHeartRatePermission in granted) {
            runCatching {
                val records = client.readRecords(
                    ReadRecordsRequest(RestingHeartRateRecord::class, timeRangeFilter = restingSearchRange)
                ).records.preferRestingHeartRateSource()
                records.map { it.beatsPerMinute.toDouble() }
                    .takeIf { it.isNotEmpty() }
                    ?.average()
            }.getOrNull()
        } else null

        val sleepDerivedRestingHeartRate = if (
            nativeRestingHeartRate == null &&
            heartRatePermission in granted &&
            sleepWindows.isNotEmpty()
        ) {
            runCatching {
                val sleepHeartRateRecords = client.readRecords(
                    ReadRecordsRequest(HeartRateRecord::class, timeRangeFilter = sleepSearchRange)
                ).records.preferHeartRateSource()

                val sleepHeartRateSamples = sleepWindows.flatMap { window ->
                    sleepHeartRateRecords
                        .flatMap { record -> record.samples }
                        .filter { sample -> sample.time.isWithinInclusive(window.start, window.end) }
                        .map { it.beatsPerMinute.toDouble() }
                }

                sleepHeartRateSamples.lowestPercentAverage(percent = 0.30)
            }.getOrNull()
        } else null

        val restingHeartRate = nativeRestingHeartRate ?: sleepDerivedRestingHeartRate
        val sleepMinutes = mainSleepWindow?.durationMinutes?.takeIf { it > 0 }

        val workoutMinutes = if (exercisePermission in granted) {
            runCatching {
                val records = client.readRecords(
                    ReadRecordsRequest(ExerciseSessionRecord::class, timeRangeFilter = range)
                ).records.preferExerciseSource()
                records.sumOf { Duration.between(it.startTime, it.endTime).toMinutes() }
            }.getOrNull()
        } else null

        return DailyHealthSummary(
            date = date.toString(),
            steps = steps?.takeIf { it > 0 },
            sleepMinutes = sleepMinutes,
            avgHeartRate = avgHeartRate?.round1(),
            restingHeartRate = restingHeartRate?.round1(),
            activeKcal = activeKcal?.takeIf { it > 0.0 }?.round1(),
            workoutMinutes = workoutMinutes?.takeIf { it > 0 },
            distanceKm = distanceKm?.takeIf { it > 0.0 }?.round2()
        )
    }

    private fun isPreferredPackage(packageName: String): Boolean {
        val lower = packageName.lowercase()
        return lower in preferredSourcePackages ||
            "xiaomi" in lower ||
            "mi.health" in lower ||
            "wearable" in lower ||
            "mifit" in lower
    }

    private fun <T : androidx.health.connect.client.records.Record> List<T>.preferred(): List<T> {
        val preferred = filter { record -> isPreferredPackage(record.metadata.dataOrigin.packageName) }
        return preferred.ifEmpty { this }
    }

    private fun List<StepsRecord>.preferStepSource(): List<StepsRecord> {
        val preferred = preferred()
        if (preferred.isNotEmpty() && preferred.size != size) return preferred
        return groupBy { it.metadata.dataOrigin.packageName }
            .maxByOrNull { (_, records) -> records.sumOf { it.count } }
            ?.value ?: this
    }

    private fun List<DistanceRecord>.preferDistanceSource(): List<DistanceRecord> {
        val preferred = preferred()
        if (preferred.isNotEmpty() && preferred.size != size) return preferred
        return groupBy { it.metadata.dataOrigin.packageName }
            .maxByOrNull { (_, records) -> records.sumOf { it.distance.inKilometers } }
            ?.value ?: this
    }

    private fun List<ActiveCaloriesBurnedRecord>.preferActiveCaloriesSource(): List<ActiveCaloriesBurnedRecord> {
        val preferred = preferred()
        if (preferred.isNotEmpty() && preferred.size != size) return preferred
        return groupBy { it.metadata.dataOrigin.packageName }
            .maxByOrNull { (_, records) -> records.sumOf { it.energy.inKilocalories } }
            ?.value ?: this
    }

    private fun List<HeartRateRecord>.preferHeartRateSource(): List<HeartRateRecord> {
        val preferred = preferred()
        if (preferred.isNotEmpty() && preferred.size != size) return preferred
        return groupBy { it.metadata.dataOrigin.packageName }
            .maxByOrNull { (_, records) -> records.sumOf { it.samples.size } }
            ?.value ?: this
    }

    private fun List<RestingHeartRateRecord>.preferRestingHeartRateSource(): List<RestingHeartRateRecord> {
        val preferred = preferred()
        if (preferred.isNotEmpty() && preferred.size != size) return preferred
        return groupBy { it.metadata.dataOrigin.packageName }
            .maxByOrNull { (_, records) -> records.size }
            ?.value ?: this
    }

    private fun List<SleepSessionRecord>.preferSleepSource(): List<SleepSessionRecord> {
        val preferred = preferred()
        if (preferred.isNotEmpty() && preferred.size != size) return preferred

        return groupBy { it.metadata.dataOrigin.packageName }
            .maxByOrNull { (_, records) ->
                records.mapNotNull { record ->
                    val minutes = Duration.between(record.startTime, record.endTime).toMinutes()
                    minutes.takeIf { it in 1..(24 * 60) }
                }.sum()
            }
            ?.value ?: this
    }

    private fun List<ExerciseSessionRecord>.preferExerciseSource(): List<ExerciseSessionRecord> {
        val preferred = preferred()
        if (preferred.isNotEmpty() && preferred.size != size) return preferred
        return groupBy { it.metadata.dataOrigin.packageName }
            .maxByOrNull { (_, records) -> records.sumOf { Duration.between(it.startTime, it.endTime).toMinutes() } }
            ?.value ?: this
    }

    private fun SleepSessionRecord.toClampedSleepWindow(windowStart: Instant, windowEnd: Instant): SleepWindow? {
        val clampedStart = maxInstant(startTime, windowStart)
        val clampedEnd = minInstant(endTime, windowEnd)
        if (!clampedStart.isBefore(clampedEnd)) return null

        val minutes = Duration.between(clampedStart, clampedEnd).toMinutes()
        if (minutes <= 0 || minutes > (24 * 60)) return null

        return SleepWindow(clampedStart, clampedEnd)
    }

    private fun List<SleepWindow>.mergeOverlaps(): List<SleepWindow> {
        if (isEmpty()) return emptyList()
        val sorted = sortedBy { it.start }
        val merged = mutableListOf<SleepWindow>()

        for (window in sorted) {
            val last = merged.lastOrNull()
            if (last == null || window.start.isAfter(last.end)) {
                merged.add(window)
            } else {
                merged[merged.lastIndex] = SleepWindow(
                    start = last.start,
                    end = maxInstant(last.end, window.end)
                )
            }
        }

        return merged
    }

    private fun Instant.isWithinInclusive(start: Instant, end: Instant): Boolean =
        !isBefore(start) && !isAfter(end)

    private fun List<Double>.lowestPercentAverage(percent: Double): Double? {
        if (isEmpty()) return null
        val sorted = sorted()
        val takeCount = ceil(sorted.size * percent).toInt().coerceAtLeast(1)
        return sorted.take(takeCount).average()
    }

    private fun maxInstant(a: Instant, b: Instant): Instant = if (a.isAfter(b)) a else b
    private fun minInstant(a: Instant, b: Instant): Instant = if (a.isBefore(b)) a else b

    private data class SleepWindow(val start: Instant, val end: Instant) {
        val durationMinutes: Long get() = Duration.between(start, end).toMinutes()
    }
}

private fun Double.round1(): Double = (this * 10.0).roundToLong() / 10.0
private fun Double.round2(): Double = (this * 100.0).roundToLong() / 100.0
