package com.daviramos.atletabridge.health

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.LocalDate
import java.time.ZoneId
import kotlin.reflect.KClass

object HealthConnectBridgeConfig {
    val types: Map<Metric, KClass<out Record>> = linkedMapOf(
        Metric.STEPS to StepsRecord::class, Metric.SLEEP to SleepSessionRecord::class,
        Metric.HEART_RATE to HeartRateRecord::class, Metric.RESTING_HEART_RATE to RestingHeartRateRecord::class,
        Metric.CALORIES to ActiveCaloriesBurnedRecord::class, Metric.WORKOUT to ExerciseSessionRecord::class,
        Metric.DISTANCE to DistanceRecord::class
    )
    val permissions = types.mapValues { HealthPermission.getReadPermission(it.value) }
    val readPermissions = permissions.values.toSet()
    val requestPermissionsContract = PermissionController.createRequestPermissionResultContract()
}

class HealthConnectReader(context: Context) : HealthSource {
    private val appContext = context.applicationContext
    private val client by lazy { HealthConnectClient.getOrCreate(appContext) }
    fun sdkStatus(): Int = HealthConnectClient.getSdkStatus(appContext)
    fun isAvailable() = sdkStatus() == HealthConnectClient.SDK_AVAILABLE

    override suspend fun grantedMetrics(): Set<Metric> {
        if (!isAvailable()) return emptySet()
        val granted = client.permissionController.getGrantedPermissions()
        return HealthConnectBridgeConfig.permissions.filterValues { it in granted }.keys
    }

    private suspend fun <T : Record> records(type: KClass<T>, window: TimeWindow): List<T> =
        readAllPages { token ->
            val page = client.readRecords(ReadRecordsRequest(
                recordType = type, timeRangeFilter = TimeRangeFilter.between(window.start, window.end),
                pageSize = 1000, pageToken = token
            ))
            Page(page.records, page.pageToken)
        }

    override suspend fun read(metric: Metric, date: LocalDate, zone: ZoneId): Reading {
        val window = dayWindow(date, zone)
        val range = TimeRangeFilter.between(window.start, window.end)
        return when (metric) {
            Metric.HEART_RATE -> heartReading(records(HeartRateRecord::class, window).map { record ->
                HeartRecord(record.metadata.id, record.metadata.dataOrigin.packageName,
                    record.samples.map { HeartSample(it.time, it.beatsPerMinute) })
            }, window)
            Metric.RESTING_HEART_RATE -> {
                val values = records(RestingHeartRateRecord::class, window)
                    .filter { it.time >= window.start && it.time < window.end }
                    .distinctBy { Triple(it.metadata.dataOrigin.packageName, it.time, it.beatsPerMinute) }
                result(values.map { it.beatsPerMinute.toDouble() }.takeIf { it.isNotEmpty() }?.average(), values)
            }
            Metric.STEPS -> {
                // Health Connect aggregation handles source priority and overlapping step buckets.
                val total = client.aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), range))
                Reading(if (total[StepsRecord.COUNT_TOTAL] == null) ReadState.EMPTY else ReadState.AVAILABLE,
                    total[StepsRecord.COUNT_TOTAL]?.toDouble(), origins = total.dataOrigins.map { it.packageName }.toSet())
            }
            Metric.CALORIES -> {
                // Never sum different providers for the same activity; select the largest origin total.
                val records = records(ActiveCaloriesBurnedRecord::class, window)
                val totals = records.map { it.metadata.dataOrigin }.distinct().mapNotNull { origin ->
                    client.aggregate(AggregateRequest(setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL), range,
                        dataOriginFilter = setOf(origin)))[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories
                }
                result(totals.maxOrNull(), records)
            }
            Metric.DISTANCE -> {
                val records = records(DistanceRecord::class, window)
                val totals = records.map { it.metadata.dataOrigin }.distinct().mapNotNull { origin ->
                    client.aggregate(AggregateRequest(setOf(DistanceRecord.DISTANCE_TOTAL), range,
                        dataOriginFilter = setOf(origin)))[DistanceRecord.DISTANCE_TOTAL]?.inKilometers
                }
                result(totals.maxOrNull(), records)
            }
            Metric.SLEEP -> {
                val sleepWindow = TimeWindow(date.minusDays(1).atTime(18, 0).atZone(zone).toInstant(),
                    date.atTime(18, 0).atZone(zone).toInstant())
                val records = records(SleepSessionRecord::class, sleepWindow)
                result(sleepMinutes(records.map { TimeWindow(it.startTime, it.endTime) }, sleepWindow), records)
            }
            Metric.WORKOUT -> {
                val records = records(ExerciseSessionRecord::class, window)
                result(workoutMinutes(records.map { TimeWindow(it.startTime, it.endTime) }, window), records)
            }
        }
    }

    private fun result(value: Double?, records: List<Record>) = Reading(
        if (value == null) ReadState.EMPTY else ReadState.AVAILABLE, value, records.size,
        origins = records.map { it.metadata.dataOrigin.packageName }.toSet()
    )
}
