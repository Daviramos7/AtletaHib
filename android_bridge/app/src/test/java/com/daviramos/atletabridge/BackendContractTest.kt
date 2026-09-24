package com.daviramos.atletabridge

import com.daviramos.atletabridge.data.*
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.*
import io.ktor.http.*
import io.ktor.http.content.TextContent
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate
import java.util.Base64

class BackendContractTest {
    @Test fun legacyDefaultSerializationOmittedProvenance() {
        // Regression evidence: the old DTO omitted default source/provider, letting the DB use "manual".
        val oldPayload = Json.parseToJsonElement(Json.encodeToString(WearableDailyMetricUpsert(
            userId = "test-user", metricDate = "2026-09-23", avgHeartRate = 92
        ))).jsonObject
        assertFalse(oldPayload.containsKey("source"))
        assertFalse(oldPayload.containsKey("provider"))
        // The HTTP three-sync test below asserts the replacement always sends an explicit source.
    }
    @Test fun logoutUsesOfficialGlobalEndpoint() = runTest {
        client { request ->
            assertEquals("/auth/v1/logout", request.url.encodedPath)
            assertEquals("global", request.url.parameters["scope"])
            assertEquals(HttpMethod.Post, request.method)
            assertEquals("Bearer test-access", request.headers[HttpHeaders.Authorization])
            respond("", HttpStatusCode.NoContent)
        }.use { it.signOutGlobal("test-access") }
    }
    private val day = LocalDate.of(2026, 9, 23)
    private fun client(handler: MockRequestHandler) = SupabaseRestClient(HttpClient(MockEngine(handler)), "https://test.invalid", "sb_publishable_test_only")
    private val headers = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString())

    @Test fun threeSyncsUseGetPostGetThenPatchOneRow() = runTest {
        var row: JsonObject? = null
        val methods = mutableListOf<HttpMethod>()
        val service = client { request ->
            methods.add(request.method)
            assertEquals("Bearer test-access", request.headers[HttpHeaders.Authorization])
            assertEquals("sb_publishable_test_only", request.headers["apikey"])
            when (request.method) {
                HttpMethod.Get -> {
                    assertEquals("eq.test-user", request.url.parameters["user_id"])
                    assertEquals("eq.health_connect_android_bridge", request.url.parameters["source"])
                    respond(if (row == null) "[]" else "[$row]", headers = headers)
                }
                HttpMethod.Post -> {
                    assertEquals("user_id,metric_date,source", request.url.parameters["on_conflict"])
                    row = Json.parseToJsonElement((request.body as TextContent).text).jsonObject
                    assertEquals("health_connect_android_bridge", row!!["source"]!!.jsonPrimitive.content)
                    assertEquals("2026-09-23", row!!["metric_date"]!!.jsonPrimitive.content)
                    assertFalse(row!!.containsKey("sleep_minutes"))
                    respond("[$row]", HttpStatusCode.Created, headers)
                }
                else -> {
                    val changed = Json.parseToJsonElement((request.body as TextContent).text).jsonObject
                    assertEquals(setOf("avg_heart_rate"), changed.keys)
                    row = JsonObject(row!!.toMap() + changed)
                    respond("[$row]", headers = headers)
                }
            }
        }
        service.use {
            assertTrue(it.syncDaily("test-access", "test-user", day, mapOf("avg_heart_rate" to 92.0)))
            assertFalse(it.syncDaily("test-access", "test-user", day, mapOf("avg_heart_rate" to 92.0)))
            assertTrue(it.syncDaily("test-access", "test-user", day, mapOf("avg_heart_rate" to 93.0)))
        }
        assertEquals(listOf(HttpMethod.Get, HttpMethod.Post, HttpMethod.Get, HttpMethod.Get, HttpMethod.Patch), methods)
    }
    @Test fun httpFailureIsTypedAndDoesNotExposeBody() = runTest {
        client { respond("private sensitive response", HttpStatusCode.Forbidden) }.use {
            try { it.syncDaily("test", "user", day, mapOf("steps" to 10.0)); fail() }
            catch (e: BackendFailure) { assertEquals(403, e.status); assertFalse(e.toString().contains("private")) }
        }
    }
    @Test fun noReturnedRowIsNotConfirmation() = runTest {
        client { respond("[]", headers = headers) }.use {
            try { it.syncDaily("test", "user", day, mapOf("steps" to 10.0)); fail() }
            catch (_: IllegalStateException) { }
        }
    }
    @Test fun wrongReturnedValueIsNotConfirmation() = runTest {
        client { req -> respond(if (req.method == HttpMethod.Get) "[]" else "[{\"steps\":9}]", headers = headers) }.use {
            try { it.syncDaily("test", "user", day, mapOf("steps" to 10.0)); fail() }
            catch (_: IllegalStateException) { }
        }
    }
    @Test fun deniedMetricNotIncludedInPatch() = runTest {
        client { req ->
            if (req.method == HttpMethod.Get) respond("[{\"steps\":2,\"sleep_minutes\":480}]", headers = headers)
            else {
                val fields = Json.parseToJsonElement((req.body as TextContent).text).jsonObject
                assertFalse(fields.containsKey("sleep_minutes"))
                respond("[{\"steps\":10,\"sleep_minutes\":480}]", headers = headers)
            }
        }.use { assertTrue(it.syncDaily("test", "user", day, mapOf("steps" to 10.0))) }
    }
    @Test fun numericScaleDoesNotCauseRedundantWrite() = runTest {
        var calls = 0
        client { calls++; respond("[{\"distance_km\":1.200}]", headers = headers) }.use {
            assertFalse(it.syncDaily("test", "user", day, mapOf("distance_km" to 1.2)))
        }
        assertEquals(1, calls)
    }
    @Test fun authRequestsUseCorrectGrantAndSerialization() = runTest {
        val grants = mutableListOf<String?>()
        client { req ->
            grants.add(req.url.parameters["grant_type"])
            val body = Json.parseToJsonElement((req.body as TextContent).text).jsonObject
            if (grants.size == 1) assertEquals("test@example.invalid", body["email"]!!.jsonPrimitive.content)
            else assertEquals("old-refresh", body["refresh_token"]!!.jsonPrimitive.content)
            respond("{\"access_token\":\"new-access\",\"refresh_token\":\"new-refresh\",\"user\":{\"id\":\"user\"}}", headers = headers)
        }.use {
            assertEquals("new-access", it.signIn("test@example.invalid", "test-password").accessToken)
            assertEquals("new-refresh", it.refreshSession("old-refresh").refreshToken)
        }
        assertEquals(listOf("password", "refresh_token"), grants)
    }
    @Test fun authParseErrorContainsNoRawResponse() = runTest {
        client { respond("private-token-body", headers = headers) }.use {
            try { it.signIn("test", "test"); fail() } catch (e: Exception) {
                assertFalse(friendlyError(e).contains("private-token-body"))
            }
        }
    }
    @Test fun onlyPublicKeysAccepted() {
        fun jwt(role: String) = "header." + Base64.getUrlEncoder().withoutPadding().encodeToString("{\"role\":\"$role\"}".toByteArray()) + ".signature"
        assertTrue(isPublicClientKey("sb_publishable_test")); assertTrue(isPublicClientKey(jwt("anon")))
        assertFalse(isPublicClientKey(jwt("service_role"))); assertFalse(isPublicClientKey("sb_secret_test")); assertFalse(isPublicClientKey(""))
    }
}
