package com.daviramos.atletabridge.data

import com.daviramos.atletabridge.BuildConfig
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

class SupabaseRestClient {
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }
    private val client = HttpClient(Android) {
        install(ContentNegotiation) { json(json) }
    }

    private val baseUrl = BuildConfig.SUPABASE_URL.trim().trimEnd('/')
    private val key = BuildConfig.SUPABASE_KEY.trim()

    fun isConfigured(): Boolean = baseUrl.startsWith("https://") && key.isNotBlank()

    suspend fun signIn(email: String, password: String): AuthResponse {
        require(isConfigured()) { "Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no gradle.properties." }

        val response = client.post("$baseUrl/auth/v1/token?grant_type=password") {
            contentType(ContentType.Application.Json)
            header("apikey", key)
            setBody(AuthRequest(email = email, password = password))
        }

        val raw = response.bodyAsText()
        if (response.status.value !in 200..299) {
            throw IllegalStateException(formatSupabaseError(response.status.value, raw))
        }

        return decodeAuthResponse(response.status.value, raw)
    }

    suspend fun refreshSession(refreshToken: String): AuthResponse {
        require(isConfigured()) { "Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no gradle.properties." }
        require(refreshToken.isNotBlank()) { "Refresh token vazio. Entre novamente." }

        val response = client.post("$baseUrl/auth/v1/token?grant_type=refresh_token") {
            contentType(ContentType.Application.Json)
            header("apikey", key)
            setBody(RefreshTokenRequest(refreshToken = refreshToken))
        }

        val raw = response.bodyAsText()
        if (response.status.value !in 200..299) {
            throw IllegalStateException(formatSupabaseError(response.status.value, raw))
        }

        return decodeAuthResponse(response.status.value, raw)
    }

    private fun decodeAuthResponse(status: Int, raw: String): AuthResponse {
        return try {
            json.decodeFromString<AuthResponse>(raw)
        } catch (e: SerializationException) {
            throw IllegalStateException(
                "Login retornou resposta inesperada do Supabase. Verifique SUPABASE_URL, chave pública e se o e-mail foi confirmado. HTTP $status: ${raw.take(250)}"
            )
        }
    }

    private fun formatSupabaseError(status: Int, raw: String): String {
        val parsed = try {
            json.decodeFromString<SupabaseErrorResponse>(raw)
        } catch (_: Exception) {
            null
        }

        val detail = parsed?.msg
            ?: parsed?.message
            ?: parsed?.error
            ?: parsed?.errorCode
            ?: raw.take(250)

        return when {
            detail.contains("Invalid login credentials", ignoreCase = true) ->
                "Credenciais inválidas. Use o mesmo e-mail e senha do app web. Também confira se a conta foi confirmada no e-mail."
            detail.contains("Email not confirmed", ignoreCase = true) ->
                "E-mail ainda não confirmado. Abra seu e-mail e confirme a conta no Supabase."
            detail.contains("Invalid Refresh Token", ignoreCase = true) ||
                detail.contains("refresh token", ignoreCase = true) ->
                "Sua sessão salva expirou ou foi revogada. Entre novamente."
            detail.contains("Invalid API key", ignoreCase = true) || detail.contains("API key", ignoreCase = true) ->
                "Chave pública do Supabase inválida. Revise SUPABASE_PUBLISHABLE_KEY no gradle.properties. Não use service_role."
            else -> "Erro do Supabase. HTTP $status: $detail"
        }
    }

    suspend fun upsertDailyMetric(accessToken: String, metric: WearableDailyMetricUpsert): HttpResponse {
        require(isConfigured()) { "Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no gradle.properties." }
        val response = client.post("$baseUrl/rest/v1/wearable_daily_metrics?on_conflict=user_id,metric_date,source") {
            contentType(ContentType.Application.Json)
            header("apikey", key)
            header(HttpHeaders.Authorization, "Bearer $accessToken")
            header("Prefer", "resolution=merge-duplicates,return=minimal")
            setBody(metric)
        }
        if (response.status.value !in 200..299) {
            val raw = response.bodyAsText()
            throw IllegalStateException("Supabase não gravou wearable_daily_metrics. HTTP ${response.status.value}: ${raw.take(500)}")
        }
        return response
    }
}
