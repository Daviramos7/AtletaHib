package com.daviramos.atletabridge.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class AuthRequest(
    val email: String,
    val password: String
)

@Serializable
data class AuthUser(
    val id: String? = null,
    val email: String? = null
)

@Serializable
data class AuthResponse(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String? = null,
    val user: AuthUser? = null
)

@Serializable
data class SupabaseErrorResponse(
    val code: Int? = null,
    val error: String? = null,
    @SerialName("error_code") val errorCode: String? = null,
    val msg: String? = null,
    val message: String? = null
)

@Serializable
data class WearableDailyMetricUpsert(
    @SerialName("user_id") val userId: String,
    @SerialName("metric_date") val metricDate: String,
    val provider: String = "mi_fitness",
    val source: String = "health_connect_android_bridge",
    val steps: Int? = null,
    @SerialName("sleep_minutes") val sleepMinutes: Int? = null,
    @SerialName("avg_heart_rate") val avgHeartRate: Int? = null,
    @SerialName("resting_heart_rate") val restingHeartRate: Int? = null,
    @SerialName("active_kcal") val activeKcal: Int? = null,
    @SerialName("workout_minutes") val workoutMinutes: Int? = null,
    @SerialName("distance_km") val distanceKm: Double? = null,
    val notes: String? = null
)

data class DailyHealthSummary(
    val date: String,
    val steps: Long?,
    val sleepMinutes: Long?,
    val avgHeartRate: Double?,
    val restingHeartRate: Double?,
    val activeKcal: Double?,
    val workoutMinutes: Long?,
    val distanceKm: Double?
)
