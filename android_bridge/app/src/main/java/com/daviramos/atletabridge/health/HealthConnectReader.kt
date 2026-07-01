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
import java.time.LocalDate
import java.time.ZoneId
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

        val stepsPermission = HealthPermission.getReadPermission(StepsRecord::class)
        val distancePermission = HealthPermission.getReadPermission(DistanceRecord::class)
        val activeKcalPermission = HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class)
        val heartRatePermission = HealthPermission.getReadPermission(HeartRateRecord::class)
        val restingHeartRatePermission = HealthPermission.getReadPermission(RestingHeartRateRecord::class)
        val sleepPermission = HealthPermission.getReadPermission(SleepSessionRecord::class)
        val exercisePermission = HealthPermission.getReadPermission(ExerciseSessionRecord::class)

        val steps = if (stepsPermission in granted) {
            runCatching {
                client.readRecords(
                    ReadRecordsRequest(StepsRecord::class, timeRangeFilter = range)
                ).records.sumOf { it.count }
            }.getOrNull()
        } else null

        val distanceKm = if (distancePermission in granted) {
            runCatching {
                client.readRecords(
                    ReadRecordsRequest(DistanceRecord::class, timeRangeFilter = range)
                ).records.sumOf { it.distance.inKilometers }
            }.getOrNull()
        } else null

        val activeKcal = if (activeKcalPermission in granted) {
            runCatching {
                client.readRecords(
                    ReadRecordsRequest(ActiveCaloriesBurnedRecord::class, timeRangeFilter = range)
                ).records.sumOf { it.energy.inKilocalories }
            }.getOrNull()
        } else null

        val avgHeartRate = if (heartRatePermission in granted) {
            runCatching {
                val samples = client.readRecords(
                    ReadRecordsRequest(HeartRateRecord::class, timeRangeFilter = range)
                ).records.flatMap { record -> record.samples.map { it.beatsPerMinute.toDouble() } }
                samples.takeIf { it.isNotEmpty() }?.average()
            }.getOrNull()
        } else null

        val restingHeartRate = if (restingHeartRatePermission in granted) {
            runCatching {
                val records = client.readRecords(
                    ReadRecordsRequest(RestingHeartRateRecord::class, timeRangeFilter = range)
                ).records.map { it.beatsPerMinute.toDouble() }
                records.takeIf { it.isNotEmpty() }?.average()
            }.getOrNull()
        } else null

        val sleepMinutes = if (sleepPermission in granted) {
            runCatching {
                client.readRecords(
                    ReadRecordsRequest(SleepSessionRecord::class, timeRangeFilter = range)
                ).records.sumOf { Duration.between(it.startTime, it.endTime).toMinutes() }
            }.getOrNull()
        } else null

        val workoutMinutes = if (exercisePermission in granted) {
            runCatching {
                client.readRecords(
                    ReadRecordsRequest(ExerciseSessionRecord::class, timeRangeFilter = range)
                ).records.sumOf { Duration.between(it.startTime, it.endTime).toMinutes() }
            }.getOrNull()
        } else null

        return DailyHealthSummary(
            date = date.toString(),
            steps = steps?.takeIf { it > 0 },
            sleepMinutes = sleepMinutes?.takeIf { it > 0 },
            avgHeartRate = avgHeartRate?.round1(),
            restingHeartRate = restingHeartRate?.round1(),
            activeKcal = activeKcal?.takeIf { it > 0.0 }?.round1(),
            workoutMinutes = workoutMinutes?.takeIf { it > 0 },
            distanceKm = distanceKm?.takeIf { it > 0.0 }?.round2()
        )
    }
}

private fun Double.round1(): Double = (this * 10.0).roundToLong() / 10.0
private fun Double.round2(): Double = (this * 100.0).roundToLong() / 100.0
