package com.daviramos.atletabridge.data

import com.daviramos.atletabridge.health.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import java.io.IOException
import java.time.LocalDate
import java.time.ZoneId
import kotlin.math.round
import kotlin.math.roundToInt

class BackendFailure(val status: Int) : Exception()
class SessionExpired : Exception()
class SyncInProgress : Exception()

fun friendlyError(error: Throwable): String = when (error) {
    is SessionExpired -> "Sua sessão expirou. Entre novamente."
    is IOException -> "Sem conexão ou serviço indisponível. Não foi possível confirmar o envio. Tente novamente."
    is BackendFailure -> when (error.status) {
        400, 409, 422 -> "O servidor não aceitou os dados. Confira a configuração da integração."
        401 -> "Sua sessão expirou. Entre novamente."
        403 -> "Sua conta não tem acesso a esta operação. Entre novamente ou contate o suporte."
        else -> "O servidor não confirmou o envio. Tente novamente."
    }
    else -> "Não foi possível concluir. Tente novamente."
}

interface BridgeBackend {
    suspend fun signOutGlobal(accessToken: String)
    suspend fun signIn(email: String, password: String): AuthResponse
    suspend fun refreshSession(refreshToken: String): AuthResponse
    suspend fun syncDaily(accessToken: String, userId: String, day: LocalDate, values: Map<String, Double>): Boolean
}

interface AuthStore {
    fun load(): AuthResponse?
    fun save(auth: AuthResponse)
    fun clear()
}

class AuthSession(private val backend: BridgeBackend, private val store: AuthStore) {
    var current: AuthResponse? = store.load()
        private set
    suspend fun signIn(email: String, password: String) {
        val signedIn = backend.signIn(email, password)
        check(!signedIn.user?.id.isNullOrBlank() && signedIn.accessToken.isNotBlank())
        store.save(signedIn)
        current = signedIn
    }
    fun signOut() { store.clear(); current = null }

    suspend fun signOutGlobal() {
        authorized { backend.signOutGlobal(it.accessToken) }
        signOut()
    }

    suspend fun <T> authorized(operation: suspend (AuthResponse) -> T): T {
        val auth = current ?: throw SessionExpired()
        try { return operation(auth) } catch (e: BackendFailure) {
            if (e.status != 401) throw e
        }
        val refresh = auth.refreshToken ?: run { signOut(); throw SessionExpired() }
        val updated = try {
            backend.refreshSession(refresh).let { it.copy(refreshToken = it.refreshToken ?: refresh, user = it.user ?: auth.user) }
        } catch (e: BackendFailure) {
            if (e.status == 400 || e.status == 401) { signOut(); throw SessionExpired() }
            throw e
        }
        // Persist a rotated refresh token before retrying. Network failures never erase the saved session.
        store.save(updated)
        current = updated
        return try { operation(updated) } catch (e: BackendFailure) {
            if (e.status == 401) { signOut(); throw SessionExpired() }
            throw e
        }
    }
}

enum class SendState { SENT, UNCHANGED, NO_DATA, FAILED }
data class DaySync(val read: DayRead, val send: SendState, val error: String? = null)
data class SyncResult(val days: List<DaySync>) {
    val sent get() = days.count { it.send == SendState.SENT }
    val unchanged get() = days.count { it.send == SendState.UNCHANGED }
    val partial get() = days.any { it.read.partial || it.send == SendState.FAILED }
    val message get() = when {
        partial -> "Sincronização parcial · $sent resumo(s) diário(s) enviado(s). Confira as métricas abaixo."
        sent > 0 -> "Sincronização concluída · $sent resumo(s) diário(s) enviado(s)."
        unchanged > 0 -> "Tudo já estava atualizado. Nenhum envio repetido."
        else -> "Nenhum dado encontrado neste período. Confira o Mi Fitness e o Health Connect."
    }
}

fun DayRead.payload(): Map<String, Double> = metrics.mapNotNull { (metric, reading) ->
    reading.value?.takeIf { reading.state == ReadState.AVAILABLE && it.isFinite() && it >= 0 }?.let {
        metric.column to if (metric == Metric.DISTANCE) round(it * 1000) / 1000 else it.roundToInt().toDouble()
    }
}.toMap()

class SyncCoordinator(private val reader: DailyReader, private val backend: BridgeBackend, private val session: AuthSession) {
    private val mutex = Mutex()
    suspend fun sync(days: List<LocalDate>, zone: ZoneId, progress: (Int, Int) -> Unit = { _, _ -> }): SyncResult {
        if (!mutex.tryLock()) throw SyncInProgress()
        try {
            require(days.size in 1..7)
            val results = mutableListOf<DaySync>()
            for ((index, day) in days.withIndex()) {
                progress(index + 1, days.size)
                val read = reader.readDay(day, zone)
                val values = read.payload()
                if (values.isEmpty()) { results.add(DaySync(read, SendState.NO_DATA)); continue }
                try {
                    val changed = session.authorized { auth ->
                        val id = auth.user?.id ?: throw SessionExpired()
                        backend.syncDaily(auth.accessToken, id, day, values)
                    }
                    results.add(DaySync(read, if (changed) SendState.SENT else SendState.UNCHANGED))
                } catch (e: CancellationException) { throw e
                } catch (e: Exception) {
                    results.add(DaySync(read, SendState.FAILED, friendlyError(e)))
                    // No seven-day retry storm when offline, expired or rejected by the backend.
                    break
                }
            }
            return SyncResult(results)
        } finally { mutex.unlock() }
    }
}
