package com.daviramos.atletabridge.data

import com.daviramos.atletabridge.BuildConfig
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import kotlinx.serialization.json.*
import kotlinx.serialization.encodeToString
import java.time.LocalDate

class SupabaseRestClient(
    private val client: HttpClient = HttpClient(Android) {
        install(HttpTimeout) { requestTimeoutMillis = 30_000; connectTimeoutMillis = 15_000; socketTimeoutMillis = 30_000 }
        followRedirects = false
    },
    url: String = BuildConfig.SUPABASE_URL,
    private val key: String = BuildConfig.SUPABASE_KEY
) : BridgeBackend, AutoCloseable {
    private val baseUrl = url.trim().trimEnd('/')
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }
    fun isConfigured() = baseUrl.startsWith("https://") && isPublicClientKey(key)
    private fun configured() = check(isConfigured()) { "Configuração do servidor indisponível" }

    override suspend fun signOutGlobal(accessToken: String) {
        configured()
        client.post("$baseUrl/auth/v1/logout") {
            parameter("scope", "global"); header("apikey", key); bearerAuth(accessToken)
        }.ensureSuccess()
    }

    override suspend fun signIn(email: String, password: String): AuthResponse =
        authenticate("password", json.encodeToString(AuthRequest(email, password)))

    override suspend fun refreshSession(refreshToken: String): AuthResponse =
        authenticate("refresh_token", json.encodeToString(RefreshTokenRequest(refreshToken)))

    private suspend fun authenticate(grant: String, body: String): AuthResponse {
        configured()
        val response = client.post("$baseUrl/auth/v1/token") {
            parameter("grant_type", grant); header("apikey", key)
            contentType(ContentType.Application.Json); setBody(body)
        }
        response.ensureSuccess()
        // Never include raw responses in exceptions: auth responses contain tokens.
        return try { json.decodeFromString<AuthResponse>(response.bodyAsText()) }
        catch (_: kotlinx.serialization.SerializationException) { throw IllegalStateException("Resposta de autenticação inválida") }
    }

    override suspend fun syncDaily(accessToken: String, userId: String, day: LocalDate, values: Map<String, Double>): Boolean {
        configured()
        require(values.isNotEmpty())
        val allowed = com.daviramos.atletabridge.health.Metric.entries.map { it.column }.toSet()
        require(values.keys.all { it in allowed } && values.values.all { it.isFinite() && it >= 0 })
        val endpoint = "$baseUrl/rest/v1/wearable_daily_metrics"
        fun HttpRequestBuilder.auth() {
            header("apikey", key); bearerAuth(accessToken); contentType(ContentType.Application.Json)
        }
        fun HttpRequestBuilder.rowFilter() {
            parameter("user_id", "eq.$userId"); parameter("metric_date", "eq.$day")
            parameter("source", "eq.health_connect_android_bridge")
        }
        val read = client.get(endpoint) {
            auth(); rowFilter(); parameter("select", allowed.joinToString(",")); parameter("limit", 2)
        }
        read.ensureSuccess()
        val existing = json.decodeFromString<List<JsonObject>>(read.bodyAsText())
        check(existing.size <= 1) { "Resumo diário ambíguo" }
        val row = existing.singleOrNull()
        if (row != null && values.all { (name, value) -> row[name]?.jsonPrimitive?.doubleOrNull == value }) return false
        val fields = buildJsonObject {
            values.forEach { (name, value) ->
                if (name == "distance_km") put(name, value) else put(name, value.toInt())
            }
        }
        val response = if (row != null) client.patch(endpoint) {
            auth(); rowFilter(); header("Prefer", "return=representation")
            setBody(fields.toString())
        } else client.post(endpoint) {
            auth(); parameter("on_conflict", "user_id,metric_date,source")
            header("Prefer", "resolution=merge-duplicates,return=representation")
            setBody(buildJsonObject {
                put("user_id", userId); put("metric_date", day.toString())
                put("source", "health_connect_android_bridge"); put("provider", "health_connect")
                fields.forEach { (name, value) -> put(name, value) }
            }.toString())
        }
        response.ensureSuccess()
        val saved = json.decodeFromString<List<JsonObject>>(response.bodyAsText()).singleOrNull()
        check(saved != null && values.all { (name, value) -> saved[name]?.jsonPrimitive?.doubleOrNull == value }) {
            "Servidor não confirmou a gravação"
        }
        return true
    }

    private fun HttpResponse.ensureSuccess() {
        if (status.value !in 200..299) throw BackendFailure(status.value)
    }
    override fun close() = client.close()
}

internal fun isPublicClientKey(key: String): Boolean {
    if (key.startsWith("sb_publishable_")) return true
    if (key.startsWith("sb_secret_") || key.isBlank()) return false
    return try {
        val payload = String(java.util.Base64.getUrlDecoder().decode(key.split('.')[1]), Charsets.UTF_8)
        Json.parseToJsonElement(payload).jsonObject["role"]?.jsonPrimitive?.content == "anon"
    } catch (_: Exception) { false }
}
