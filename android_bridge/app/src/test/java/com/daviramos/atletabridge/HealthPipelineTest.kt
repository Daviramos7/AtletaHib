package com.daviramos.atletabridge

import com.daviramos.atletabridge.health.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test
import java.time.*

class HealthPipelineTest {
    private val date = LocalDate.of(2026, 9, 23)
    private val zone = ZoneId.of("America/Sao_Paulo")
    private val window = dayWindow(date, zone)
    private fun sample(seconds: Long, bpm: Long = 90) = HeartSample(window.start.plusSeconds(seconds), bpm)
    private fun record(vararg samples: HeartSample, id: String = "record-1", origin: String = "com.xiaomi.wearable") = HeartRecord(id, origin, samples.toList())

    @Test fun noRecordsIsMissingNotZero() { assertEquals(ReadState.EMPTY, heartReading(emptyList(), window).state); assertNull(heartReading(emptyList(), window).value) }
    @Test fun oneSampleUsesBeatsPerMinute() { assertEquals(91.0, heartReading(listOf(record(sample(1, 91))), window).value!!, 0.0) }
    @Test fun preservesSeveralSamplesWithinOneMinute() {
        val result = heartReading(listOf(record(sample(0, 90), sample(12, 92), sample(24, 94))), window)
        assertEquals(3, result.validSamples); assertEquals(92.0, result.value!!, 0.0)
    }
    @Test fun multipleRecordsAreWeightedBySamplesNotByRecord() {
        val result = heartReading(listOf(record(sample(0, 60)), record(sample(12, 90), sample(24, 120), id = "r2")), window)
        assertEquals(90.0, result.value!!, 0.0); assertEquals(2, result.records)
    }
    @Test fun miFitnessAndUnlistedOriginsAreAccepted() {
        val result = heartReading(listOf(record(sample(1), origin = "com.xiaomi.wearable.global"),
            record(sample(2, 100), id = "r2", origin = "vendor.new.package")), window)
        assertEquals(2, result.validSamples); assertEquals(2, result.origins.size)
    }
    @Test fun exactDuplicatesRemovedWithoutMinuteTruncation() {
        val result = heartReading(listOf(record(sample(1, 91), sample(10, 93)), record(sample(1, 91), id = "updated")), window)
        assertEquals(3, result.samples); assertEquals(2, result.validSamples); assertEquals(1, result.ignoredSamples)
    }
    @Test fun differentBpmAtSameTimestampAreNotDropped() {
        assertEquals(2, heartReading(listOf(record(sample(1, 90), sample(1, 91))), window).validSamples)
    }
    @Test fun subsecondTimestampsArePreserved() {
        assertEquals(2, heartReading(listOf(record(sample(1), HeartSample(window.start.plusSeconds(1).plusNanos(1), 90))), window).validSamples)
    }
    @Test fun invalidBpmNotUsedToCreateAverage() {
        val result = heartReading(listOf(record(sample(0, 0), sample(1, 301), sample(2, -1), sample(3, 90))), window)
        assertEquals(1, result.validSamples); assertEquals(90.0, result.value!!, 0.0)
    }
    @Test fun localMidnightIsHalfOpen() {
        val result = heartReading(listOf(record(HeartSample(window.start.minusNanos(1), 60), sample(0, 90),
            HeartSample(window.end.minusNanos(1), 110), HeartSample(window.end, 200))), window)
        assertEquals(2, result.validSamples); assertEquals(100.0, result.value!!, 0.0)
    }
    @Test fun utcAndLocalDatesDifferCorrectly() {
        assertEquals(Instant.parse("2026-09-23T03:00:00Z"), window.start)
        assertEquals(Instant.parse("2026-09-24T03:00:00Z"), window.end)
    }
    @Test fun dstDaysNeedNotHave24Hours() {
        val dst = dayWindow(LocalDate.of(2026, 3, 8), ZoneId.of("America/New_York"))
        assertEquals(23, Duration.between(dst.start, dst.end).toHours().toInt())
    }
    @Test fun readsEveryPageIncludingEmptyIntermediatePage() = runTest {
        val tokens = mutableListOf<String?>()
        val records = readAllPages { token ->
            tokens.add(token)
            when (token) { null -> Page(listOf(1), "second"); "second" -> Page(emptyList(), "third"); else -> Page(listOf(2), null) }
        }
        assertEquals(listOf(1, 2), records); assertEquals(listOf(null, "second", "third"), tokens)
    }
    @Test fun emptyPageTokenTerminates() = runTest { assertEquals(listOf(1), readAllPages { Page(listOf(1), "") }) }
    @Test fun repeatedTokenFailsRatherThanLoopingForever() = runTest {
        try { readAllPages { Page(listOf(1), "same") }; fail("Expected pagination error") } catch (_: IllegalStateException) { }
    }
    @Test fun secondPageFailureCannotReturnFirstPageAsSuccess() = runTest {
        var calls = 0
        try { readAllPages { if (calls++ == 0) Page(listOf(1), "next") else error("read failed") }; fail() } catch (_: IllegalStateException) { }
    }
    private class Source(val permission: Boolean = true, val error: Exception? = null) : HealthSource {
        var calls = 0
        override suspend fun grantedMetrics() = if (permission) setOf(Metric.HEART_RATE) else emptySet()
        override suspend fun read(metric: Metric, date: LocalDate, zone: ZoneId): Reading {
            calls++; error?.let { throw it }; return Reading(ReadState.AVAILABLE, 90.0, 1, 1, 1)
        }
    }
    @Test fun grantedHeartPermissionReadsHeartRecords() = runTest {
        val source = Source(); val result = DailyReader(source).readDay(date, zone)
        assertEquals(ReadState.AVAILABLE, result.metrics[Metric.HEART_RATE]?.state); assertEquals(1, source.calls)
    }
    @Test fun deniedHeartPermissionDoesNotRead() = runTest {
        val source = Source(false); val result = DailyReader(source).readDay(date, zone)
        assertEquals(ReadState.NO_PERMISSION, result.metrics[Metric.HEART_RATE]?.state); assertEquals(0, source.calls)
    }
    @Test fun heartErrorProducesPartialResult() = runTest {
        val result = DailyReader(Source(error = IllegalStateException())).readDay(date, zone)
        assertEquals(ReadState.ERROR, result.metrics[Metric.HEART_RATE]?.state); assertTrue(result.partial)
    }
    @Test fun revokedPermissionHasSpecificState() = runTest {
        assertEquals(ReadState.NO_PERMISSION, DailyReader(Source(error = SecurityException())).readDay(date, zone).metrics[Metric.HEART_RATE]?.state)
    }
    @Test fun cancellationIsNeverReportedAsMissingData() = runTest {
        try { DailyReader(Source(error = CancellationException())).readDay(date, zone); fail() } catch (_: CancellationException) { }
    }
    @Test fun cardioPreserves60MinutesAndMergesOverlap() {
        val windows = listOf(TimeWindow(window.start, window.start.plusSeconds(3600)), TimeWindow(window.start, window.start.plusSeconds(1500)))
        assertEquals(60.0, workoutMinutes(windows, window)!!, 0.0)
    }
    @Test fun cardioAcrossMidnightIsClippedPerDay() {
        val records = listOf(TimeWindow(window.start.minusSeconds(1200), window.start.plusSeconds(1200)))
        assertEquals(20.0, workoutMinutes(records, window)!!, 0.0)
        assertEquals(20.0, workoutMinutes(records, dayWindow(date.minusDays(1), zone))!!, 0.0)
    }
    @Test fun cardio25And40MinutesNotCappedAt20() {
        for (minutes in listOf(25, 40)) assertEquals(minutes.toDouble(), workoutMinutes(listOf(TimeWindow(window.start, window.start.plusSeconds(minutes * 60L))), window)!!, 0.0)
    }
    @Test fun sleepMissingIsNull() { assertNull(sleepMinutes(emptyList(), window)) }
    @Test fun cumulativeSleepSessionsDoNotAddTo24Hours() {
        val start = window.start
        assertEquals(480.0, sleepMinutes(listOf(TimeWindow(start, start.plusSeconds(7200)), TimeWindow(start, start.plusSeconds(28800))), window)!!, 0.0)
    }
    @Test fun sleepCrossesUtcMidnightInNightWindow() {
        val bounds = TimeWindow(date.minusDays(1).atTime(18, 0).atZone(zone).toInstant(), date.atTime(18, 0).atZone(zone).toInstant())
        val start = date.minusDays(1).atTime(23, 0).atZone(zone).toInstant()
        assertEquals(480.0, sleepMinutes(listOf(TimeWindow(start, start.plusSeconds(28800))), bounds)!!, 0.0)
    }
}
