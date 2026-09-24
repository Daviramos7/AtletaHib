package com.daviramos.atletabridge

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.daviramos.atletabridge.data.*
import com.daviramos.atletabridge.health.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

data class BridgeState(
    val busy: Boolean = true,
    val available: Boolean = false,
    val permissions: Set<Metric> = emptySet(),
    val permissionsChecked: Boolean = false,
    val requested: Boolean = false,
    val connected: Boolean = false,
    val configured: Boolean = false,
    val backendStatus: String = "Ainda não verificado",
    val message: String = "Abrindo aplicativo…",
    val error: Boolean = false,
    val result: SyncResult? = null,
    val lastSync: String? = null
)

class BridgeViewModel(application: Application) : AndroidViewModel(application) {
    private val backend = SupabaseRestClient()
    private val health = HealthConnectReader(application)
    private val store = SessionStore(application)
    private val prefs = application.getSharedPreferences("bridge_status", 0)
    private lateinit var session: AuthSession
    private lateinit var coordinator: SyncCoordinator
    var state by mutableStateOf(BridgeState())
        private set

    init {
        viewModelScope.launch {
            session = withContext(Dispatchers.IO) { AuthSession(backend, store) }
            coordinator = SyncCoordinator(DailyReader(health), backend, session)
            state = state.copy(busy = false, connected = session.current != null, configured = backend.isConfigured(),
                requested = prefs.getBoolean("permissions_requested", false), lastSync = lastSync(),
                message = if (session.current != null) "Sessão salva. Sincronize para verificar a conexão." else "Entre na sua conta para sincronizar.")
            refreshPermissions()
        }
    }

    private fun lastSync(): String? = session.current?.user?.id?.let { prefs.getString("last_sync_$it", null) }

    fun refreshPermissions() {
        viewModelScope.launch {
            try {
                val available = health.isAvailable()
                val permissions = withContext(Dispatchers.IO) { health.grantedMetrics() }
                state = state.copy(available = available, permissions = permissions, permissionsChecked = true)
            } catch (e: CancellationException) { throw e
            } catch (_: Exception) {
                state = state.copy(permissionsChecked = false, error = true,
                    message = "Não foi possível conferir as permissões. Abra o Health Connect e tente novamente.")
            }
        }
    }

    fun permissionRequested() {
        prefs.edit().putBoolean("permissions_requested", true).apply()
        state = state.copy(requested = true)
    }
    fun notifyPermissionError() {
        state = state.copy(error = true, message = "Não foi possível abrir as permissões. Abra o Health Connect nas configurações do celular.")
    }

    fun signIn(email: String, password: String) {
        if (state.busy || !::session.isInitialized) return
        state = state.copy(busy = true, error = false, message = "Entrando…")
        viewModelScope.launch {
            try {
                withContext(Dispatchers.IO) { session.signIn(email.trim(), password) }
                state = state.copy(connected = true, backendStatus = "Conta autenticada", lastSync = lastSync(),
                    message = "Conta conectada. Confira as permissões e sincronize.")
            } catch (e: CancellationException) { throw e
            } catch (e: Exception) {
                val message = if (e is BackendFailure && e.status in setOf(400, 401))
                    "Não foi possível entrar. Confira e-mail, senha e a confirmação da conta." else friendlyError(e)
                state = state.copy(error = true, message = message)
            } finally { state = state.copy(busy = false) }
        }
    }

    fun signOut() {
        if (state.busy || !::session.isInitialized) return
        state = state.copy(busy = true)
        viewModelScope.launch {
            try {
                withContext(Dispatchers.IO) { session.signOutGlobal() }
                state = state.copy(connected = false, lastSync = null, result = null, error = false,
                    backendStatus = "Não conectado", message = "Você saiu. Outras sessões serão encerradas ao renovar o acesso.")
            } catch (e: CancellationException) { throw e
            } catch (_: Exception) {
                state = state.copy(connected = session.current != null, error = true,
                    message = if (session.current != null) "Não foi possível revogar as sessões. Você continua conectado; confira a conexão e tente sair novamente."
                    else "Sessão local encerrada. Não foi possível confirmar a revogação em outros dispositivos.")
            } finally { state = state.copy(busy = false) }
        }
    }

    fun sync(count: Int = 1) {
        if (state.busy || !state.connected || !state.available || !::coordinator.isInitialized) return
        state = state.copy(busy = true, error = false, result = null, message = "Sincronizando…")
        viewModelScope.launch {
            try {
                val zone = ZoneId.systemDefault()
                val today = LocalDate.now(zone)
                val days = (count - 1 downTo 0).map { today.minusDays(it.toLong()) }
                val result = withContext(Dispatchers.IO) {
                    coordinator.sync(days, zone) { current, total ->
                        viewModelScope.launch { state = state.copy(message = "Sincronizando · dia $current de $total…") }
                    }
                }
                val failed = result.days.firstOrNull { it.send == SendState.FAILED }
                if (!result.partial && result.days.any { it.send == SendState.SENT || it.send == SendState.UNCHANGED }) {
                    session.current?.user?.id?.let { prefs.edit().putString("last_sync_$it", Instant.now().toString()).apply() }
                }
                state = state.copy(result = result, error = result.partial, connected = session.current != null,
                    lastSync = lastSync(), message = if (failed != null) "Sincronização parcial. ${failed.error}" else result.message,
                    backendStatus = when {
                        failed != null -> "Envio não confirmado"
                        result.sent + result.unchanged > 0 -> "Conexão verificada"
                        else -> "Sem envio nesta tentativa"
                    })
            } catch (e: CancellationException) { throw e
            } catch (e: Exception) {
                state = state.copy(error = true, message = friendlyError(e), backendStatus = "Não verificado nesta tentativa")
            } finally { state = state.copy(busy = false); refreshPermissions() }
        }
    }

    override fun onCleared() { backend.close(); super.onCleared() }
}
