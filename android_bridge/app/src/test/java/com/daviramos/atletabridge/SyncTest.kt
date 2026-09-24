package com.daviramos.atletabridge

import com.daviramos.atletabridge.data.*
import com.daviramos.atletabridge.health.*
import kotlinx.coroutines.*
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException
import java.time.*

class SyncTest {
    private val date = LocalDate.of(2026, 9, 23)
    private val zone = ZoneId.of("America/Sao_Paulo")
    private val auth = AuthResponse("test-access", "test-refresh", AuthUser("test-user"))
    private class Store(var auth: AuthResponse?) : AuthStore {
        override fun load() = auth
        override fun save(auth: AuthResponse) { this.auth = auth }
        override fun clear() { auth = null }
    }
    private class Source : HealthSource {
        var hr: Reading = Reading(ReadState.AVAILABLE, 90.0, 1, 1, 1)
        var sleep: Reading = Reading(ReadState.EMPTY)
        var gate: CompletableDeferred<Unit>? = null
        override suspend fun grantedMetrics() = Metric.entries.toSet()
        override suspend fun read(metric: Metric, date: LocalDate, zone: ZoneId): Reading {
            gate?.await()
            return when (metric) { Metric.HEART_RATE -> hr; Metric.SLEEP -> sleep; else -> Reading(ReadState.EMPTY) }
        }
    }
    private class Backend : BridgeBackend {
        var logouts = 0
        override suspend fun signOutGlobal(accessToken: String) { failure?.let { throw it }; logouts++ }
        var row = emptyMap<String, Double>()
        var writes = 0; var refreshes = 0; var calls = 0
        var failure: Exception? = null; var refreshFailure: Exception? = null
        var expired = false; var alwaysExpired = false
        override suspend fun signIn(email: String, password: String) = AuthResponse("new", "refresh", AuthUser("test-user"))
        override suspend fun refreshSession(refreshToken: String): AuthResponse {
            refreshes++; refreshFailure?.let { throw it }; expired = false
            return AuthResponse("fresh", "rotated", AuthUser("test-user"))
        }
        override suspend fun syncDaily(accessToken: String, userId: String, day: LocalDate, values: Map<String, Double>): Boolean {
            calls++; failure?.let { throw it }
            if (expired || alwaysExpired) throw BackendFailure(401)
            if (values.all { row[it.key] == it.value }) return false
            row = row + values; writes++; return true
        }
    }
    @Test fun threeSyncsSendOnlyChangedDailySummary() = runTest {
        val source = Source(); val backend = Backend()
        val sync = SyncCoordinator(DailyReader(source), backend, AuthSession(backend, Store(auth)))
        assertEquals(1, sync.sync(listOf(date), zone).sent)
        assertEquals(0, sync.sync(listOf(date), zone).sent)
        source.hr = Reading(ReadState.AVAILABLE, 92.0, 2, 2, 2)
        assertEquals(1, sync.sync(listOf(date), zone).sent)
        assertEquals(2, backend.writes); assertEquals(92.0, backend.row["avg_heart_rate"]!!, 0.0)
    }
    @Test fun samplesChangingWithoutChangingIntegerMeanNeedsNoDailyWrite() = runTest {
        val source = Source(); val backend = Backend(); val sync = SyncCoordinator(DailyReader(source), backend, AuthSession(backend, Store(auth)))
        sync.sync(listOf(date), zone); source.hr = source.hr.copy(value = 90.2, samples = 2, validSamples = 2)
        assertEquals(1, sync.sync(listOf(date), zone).unchanged); assertEquals(1, backend.writes)
    }
    @Test fun heartFailureIsPartialEvenWhenSleepSent() = runTest {
        val source = Source().apply { hr = Reading(ReadState.ERROR); sleep = Reading(ReadState.AVAILABLE, 480.0) }
        val backend = Backend(); val result = SyncCoordinator(DailyReader(source), backend, AuthSession(backend, Store(auth))).sync(listOf(date), zone)
        assertTrue(result.partial); assertEquals(1, result.sent); assertFalse(backend.row.containsKey("avg_heart_rate"))
    }
    @Test fun emptyAndDeniedMetricsNeverOverwriteExistingValues() = runTest {
        val source = Source().apply { sleep = Reading(ReadState.NO_PERMISSION) }
        val backend = Backend().apply { row = mapOf("sleep_minutes" to 480.0) }
        SyncCoordinator(DailyReader(source), backend, AuthSession(backend, Store(auth))).sync(listOf(date), zone)
        assertEquals(480.0, backend.row["sleep_minutes"]!!, 0.0)
    }
    @Test fun noDataMeansNoNetworkWrite() = runTest {
        val source = Source().apply { hr = Reading(ReadState.EMPTY) }; val backend = Backend()
        val result = SyncCoordinator(DailyReader(source), backend, AuthSession(backend, Store(auth))).sync(listOf(date), zone)
        assertEquals(SendState.NO_DATA, result.days.single().send); assertEquals(0, backend.calls)
    }
    @Test fun failedSupabaseNeverMarkedSentAndStopsSevenDayStorm() = runTest {
        val backend = Backend().apply { failure = BackendFailure(403) }
        val result = SyncCoordinator(DailyReader(Source()), backend, AuthSession(backend, Store(auth))).sync((0..6).map { date.minusDays(it.toLong()) }, zone)
        assertTrue(result.partial); assertEquals(0, result.sent); assertEquals(1, backend.calls)
    }
    @Test fun offlineKeepsSessionAndRetryCanSucceed() = runTest {
        val backend = Backend().apply { failure = IOException("private network detail") }; val store = Store(auth)
        val sync = SyncCoordinator(DailyReader(Source()), backend, AuthSession(backend, store))
        val failed = sync.sync(listOf(date), zone)
        assertTrue(failed.partial); assertNotNull(store.auth); assertFalse(failed.message.contains("private"))
        backend.failure = null; assertEquals(1, sync.sync(listOf(date), zone).sent)
    }
    @Test fun expiredAccessRefreshesOnceAndPersistsRotation() = runTest {
        val backend = Backend().apply { expired = true }; val store = Store(auth)
        val result = SyncCoordinator(DailyReader(Source()), backend, AuthSession(backend, store)).sync(listOf(date), zone)
        assertEquals(1, result.sent); assertEquals(1, backend.refreshes); assertEquals("rotated", store.auth?.refreshToken)
    }
    @Test fun revokedRefreshClearsSessionWithoutLoop() = runTest {
        val backend = Backend().apply { expired = true; refreshFailure = BackendFailure(400) }; val store = Store(auth)
        val result = SyncCoordinator(DailyReader(Source()), backend, AuthSession(backend, store)).sync(listOf(date), zone)
        assertTrue(result.partial); assertNull(store.auth); assertEquals(1, backend.refreshes)
    }
    @Test fun refreshOfflineKeepsSession() = runTest {
        val backend = Backend().apply { expired = true; refreshFailure = IOException() }; val store = Store(auth)
        SyncCoordinator(DailyReader(Source()), backend, AuthSession(backend, store)).sync(listOf(date), zone)
        assertEquals(auth, store.auth)
    }
    @Test fun repeated401AfterRefreshSignsOutOnce() = runTest {
        val backend = Backend().apply { alwaysExpired = true }; val store = Store(auth)
        SyncCoordinator(DailyReader(Source()), backend, AuthSession(backend, store)).sync(listOf(date), zone)
        assertEquals(1, backend.refreshes); assertEquals(2, backend.calls); assertNull(store.auth)
    }
    @Test fun missingRefreshSignsOut() = runTest {
        val backend = Backend().apply { expired = true }; val store = Store(auth.copy(refreshToken = null))
        SyncCoordinator(DailyReader(Source()), backend, AuthSession(backend, store)).sync(listOf(date), zone)
        assertNull(store.auth); assertEquals(0, backend.refreshes)
    }
    @Test fun duplicateConcurrentSyncIsRejected() = runTest {
        val gate = CompletableDeferred<Unit>(); val source = Source().apply { this.gate = gate }; val backend = Backend()
        val sync = SyncCoordinator(DailyReader(source), backend, AuthSession(backend, Store(auth)))
        val first = async(start = CoroutineStart.UNDISPATCHED) { sync.sync(listOf(date), zone) }
        try { sync.sync(listOf(date), zone); fail() } catch (_: SyncInProgress) { }
        gate.complete(Unit); first.await(); assertEquals(1, backend.writes)
    }
    @Test fun cancellationReleasesSyncLock() = runTest {
        val source = Source().apply { gate = CompletableDeferred() }; val backend = Backend()
        val sync = SyncCoordinator(DailyReader(source), backend, AuthSession(backend, Store(auth)))
        val first = launch(start = CoroutineStart.UNDISPATCHED) { sync.sync(listOf(date), zone) }
        first.cancelAndJoin(); source.gate = null
        assertEquals(1, sync.sync(listOf(date), zone).sent)
    }
    @Test fun absenceDoesNotInventRestingHeartRate() {
        val payload = DayRead(date, mapOf(Metric.HEART_RATE to Reading(ReadState.AVAILABLE, 93.2), Metric.SLEEP to Reading(ReadState.AVAILABLE, 480.0))).payload()
        assertFalse(payload.containsKey("resting_heart_rate")); assertEquals(93.0, payload["avg_heart_rate"]!!, 0.0)
    }
    @Test fun measuredZeroIsPreservedButMissingIsNotZero() {
        val payload = DayRead(date, mapOf(Metric.STEPS to Reading(ReadState.AVAILABLE, 0.0), Metric.SLEEP to Reading(ReadState.EMPTY))).payload()
        assertEquals(0.0, payload["steps"]!!, 0.0); assertFalse(payload.containsKey("sleep_minutes"))
    }
    @Test fun distancePrecisionMatchesNumericColumn() {
        assertEquals(1.235, DayRead(date, mapOf(Metric.DISTANCE to Reading(ReadState.AVAILABLE, 1.23456))).payload()["distance_km"]!!, 0.0)
    }
    @Test fun sanitizedErrorsNeverExposeRawBackendText() {
        assertFalse(friendlyError(IllegalStateException("secret-token" )).contains("secret-token"))
    }
    @Test fun globalLogoutRevokesThenClearsLocalSession() = runTest {
        val backend = Backend(); val store = Store(auth); val session = AuthSession(backend, store)
        session.signOutGlobal()
        assertEquals(1, backend.logouts); assertNull(store.auth); assertNull(session.current)
        try { session.authorized { true }; fail() } catch (_: SessionExpired) { }
        assertEquals(0, backend.refreshes)
    }
    @Test fun offlineLogoutIsNotFalselyReportedAsGlobalSuccess() = runTest {
        val backend = Backend().apply { failure = IOException() }; val store = Store(auth); val session = AuthSession(backend, store)
        try { session.signOutGlobal(); fail() } catch (_: IOException) { }
        assertNotNull(store.auth); assertEquals(0, backend.logouts)
        backend.failure = null; session.signOutGlobal(); assertNull(store.auth)
    }
}
