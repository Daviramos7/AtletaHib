package com.daviramos.atletabridge

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.daviramos.atletabridge.data.AuthResponse
import com.daviramos.atletabridge.data.AuthUser
import com.daviramos.atletabridge.data.SessionStore
import com.daviramos.atletabridge.data.SupabaseRestClient
import com.daviramos.atletabridge.data.WearableDailyMetricUpsert
import com.daviramos.atletabridge.health.HealthConnectBridgeConfig
import com.daviramos.atletabridge.health.HealthConnectReader
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import kotlin.math.roundToInt

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    BridgeApp()
                }
            }
        }
    }
}

@Composable
fun BridgeApp() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val supabase = remember { SupabaseRestClient() }
    val health = remember { HealthConnectReader(context) }
    val sessionStore = remember { SessionStore(context) }

    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var auth by remember { mutableStateOf<AuthResponse?>(null) }
    var status by remember { mutableStateOf("Abrindo app...") }
    var lastSummary by remember { mutableStateOf<String?>(null) }
    var restoringSession by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        val saved = sessionStore.load()
        if (saved == null) {
            status = "Pronto para configurar."
            restoringSession = false
            return@LaunchedEffect
        }

        email = saved.email.orEmpty()
        saved.toAuthResponse()?.let { auth = it }
        status = "Sessão encontrada. Validando login salvo..."

        val refreshToken = saved.refreshToken
        if (refreshToken.isNullOrBlank()) {
            status = "Login salvo encontrado. Se a sincronização falhar, entre novamente."
            restoringSession = false
            return@LaunchedEffect
        }

        try {
            val refreshed = supabase.refreshSession(refreshToken)
            val normalized = AuthResponse(
                accessToken = refreshed.accessToken,
                refreshToken = refreshed.refreshToken ?: refreshToken,
                user = refreshed.user ?: AuthUser(id = saved.userId, email = saved.email)
            )
            auth = normalized
            sessionStore.save(email = normalized.user?.email ?: saved.email.orEmpty(), auth = normalized)
            status = "Login restaurado. Pode sincronizar."
        } catch (e: Exception) {
            auth = null
            sessionStore.clear()
            status = "Não consegui restaurar o login salvo. Entre novamente. Motivo: ${e.message ?: e::class.simpleName}"
        } finally {
            restoringSession = false
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = HealthConnectBridgeConfig.requestPermissionsContract
    ) { granted ->
        val missing = HealthConnectBridgeConfig.readPermissions - granted
        status = if (missing.isEmpty()) {
            "Permissões do Health Connect concedidas. Agora sincronize."
        } else if (granted.isNotEmpty()) {
            "Permissões parciais concedidas. O app vai sincronizar o que foi liberado. Pendentes: " +
                missing.map(HealthConnectBridgeConfig::friendlyName).sorted().joinToString(", ")
        } else {
            "Nenhuma permissão foi concedida. Abra o Health Connect e libere pelo menos passos/sono/treinos para este app."
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text("Atleta Híbrido Bridge", style = MaterialTheme.typography.headlineMedium)
        Text("Ponte Android para ler dados do Health Connect e enviar ao Supabase do Atleta Híbrido.")

        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("1. Conta", style = MaterialTheme.typography.titleMedium)

                if (auth != null) {
                    val connectedEmail = auth?.user?.email ?: email.ifBlank { "conta conectada" }
                    Text("Conectado como: $connectedEmail")
                    Text("O app vai lembrar esta sessão. A senha não fica salva no celular.")
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        OutlinedButton(
                            onClick = {
                                sessionStore.clear()
                                auth = null
                                password = ""
                                lastSummary = null
                                status = "Sessão local removida. Entre novamente para sincronizar."
                            },
                            modifier = Modifier.weight(1f)
                        ) { Text("Sair") }

                        Button(
                            onClick = {
                                scope.launch {
                                    val saved = sessionStore.load()
                                    val refreshToken = saved?.refreshToken
                                    if (refreshToken.isNullOrBlank()) {
                                        status = "Não há refresh token salvo. Saia e entre novamente."
                                        return@launch
                                    }

                                    try {
                                        status = "Atualizando sessão salva..."
                                        val refreshed = supabase.refreshSession(refreshToken)
                                        val normalized = AuthResponse(
                                            accessToken = refreshed.accessToken,
                                            refreshToken = refreshed.refreshToken ?: refreshToken,
                                            user = refreshed.user ?: AuthUser(id = saved.userId, email = saved.email)
                                        )
                                        auth = normalized
                                        sessionStore.save(email = normalized.user?.email ?: saved.email.orEmpty(), auth = normalized)
                                        status = "Sessão atualizada."
                                    } catch (e: Exception) {
                                        auth = null
                                        sessionStore.clear()
                                        status = "Sessão expirada. Entre novamente. Motivo: ${e.message ?: e::class.simpleName}"
                                    }
                                }
                            },
                            modifier = Modifier.weight(1f)
                        ) { Text("Atualizar sessão") }
                    }
                } else {
                    Text("Use o mesmo e-mail e senha do Atleta Híbrido Cloud. A senha não será salva.")
                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it },
                        label = { Text("E-mail") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Senha") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation()
                    )
                    Button(
                        onClick = {
                            scope.launch {
                                try {
                                    status = "Entrando no Supabase..."
                                    val signedIn = supabase.signIn(email.trim(), password)
                                    auth = signedIn
                                    password = ""
                                    sessionStore.save(email = signedIn.user?.email ?: email.trim(), auth = signedIn)
                                    status = "Login feito e sessão salva. Agora peça permissões do Health Connect."
                                } catch (e: Exception) {
                                    status = "Erro no login: ${e.message ?: e::class.simpleName}"
                                }
                            }
                        },
                        enabled = !restoringSession && email.isNotBlank() && password.isNotBlank(),
                        modifier = Modifier.fillMaxWidth()
                    ) { Text(if (restoringSession) "Verificando sessão..." else "Entrar") }
                }
            }
        }

        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("2. Permissões do Health Connect", style = MaterialTheme.typography.titleMedium)
                Text("Abra o Mi Fitness e permita escrever/sincronizar dados no Health Connect. Depois, permita este app ler esses dados.")
                Button(
                    onClick = {
                        scope.launch { status = "Abrindo tela de permissões do Health Connect..." }
                        if (!health.isAvailable()) {
                            status = "Health Connect não está disponível neste celular. Instale/atualize o Health Connect e tente de novo."
                            openHealthConnect(context)
                        } else {
                            permissionLauncher.launch(HealthConnectBridgeConfig.readPermissions)
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Pedir permissões") }

                Button(
                    onClick = {
                        status = "Abrindo pedido básico: passos, distância e calorias. Use esta opção se a tela completa não abrir."
                        if (!health.isAvailable()) {
                            openHealthConnect(context)
                        } else {
                            permissionLauncher.launch(HealthConnectBridgeConfig.basicPermissions)
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Pedir permissões básicas") }

                TextButton(
                    onClick = {
                        status = "Abrindo Conexão Saúde. Depois entre em Permissões de apps e procure Atleta Bridge."
                        openHealthConnect(context)
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Abrir Conexão Saúde") }
            }
        }

        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("3. Sincronizar", style = MaterialTheme.typography.titleMedium)
                Text("Envia passos, sono, frequência cardíaca, kcal ativas, minutos de treino e distância para wearable_daily_metrics.")

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    Button(
                        onClick = {
                            scope.launch {
                                syncDay(health, supabase, auth, LocalDate.now(), { status = it }, { lastSummary = it })
                            }
                        },
                        enabled = auth != null && !restoringSession,
                        modifier = Modifier.weight(1f)
                    ) { Text("Hoje") }

                    Button(
                        onClick = {
                            scope.launch {
                                for (i in 6 downTo 0) {
                                    syncDay(health, supabase, auth, LocalDate.now().minusDays(i.toLong()), { status = it }, { lastSummary = it })
                                }
                                status = "Últimos 7 dias sincronizados."
                            }
                        },
                        enabled = auth != null && !restoringSession,
                        modifier = Modifier.weight(1f)
                    ) { Text("7 dias") }
                }

                TextButton(onClick = { lastSummary = null }) { Text("Limpar resumo") }
            }
        }

        StatusCard(status = status, summary = lastSummary)
        Spacer(Modifier.height(20.dp))
    }
}

private fun openHealthConnect(context: android.content.Context) {
    val intents = listOf(
        Intent("androidx.health.ACTION_HEALTH_CONNECT_SETTINGS"),
        Intent("android.settings.APPLICATION_DETAILS_SETTINGS").apply {
            data = Uri.parse("package:com.google.android.apps.healthdata")
        },
        Intent(Intent.ACTION_VIEW).apply {
            data = Uri.parse("market://details?id=com.google.android.apps.healthdata")
        }
    )

    for (intent in intents) {
        try {
            context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            return
        } catch (_: ActivityNotFoundException) {
            // Try next fallback.
        } catch (_: Exception) {
            // Try next fallback.
        }
    }
}

private suspend fun syncDay(
    health: HealthConnectReader,
    supabase: SupabaseRestClient,
    auth: AuthResponse?,
    day: LocalDate,
    setStatus: (String) -> Unit,
    setSummary: (String) -> Unit
) {
    if (auth == null) {
        setStatus("Faça login antes de sincronizar.")
        return
    }
    try {
        setStatus("Lendo Health Connect em $day...")
        val hasAnyPermission = health.hasAnyReadPermission()
        if (!hasAnyPermission) {
            setStatus("Nenhuma permissão de leitura concedida no Health Connect. Peça permissões antes de sincronizar.")
            return
        }
        val summary = health.readDay(day)
        val userId = auth.user?.id
        if (userId.isNullOrBlank()) {
            setStatus("Login sem user_id retornado pelo Supabase. Saia e entre de novo antes de sincronizar.")
            return
        }
        val payload = WearableDailyMetricUpsert(
            userId = userId,
            metricDate = summary.date,
            provider = "mi_fitness",
            source = "health_connect_android_bridge",
            steps = summary.steps?.toInt(),
            sleepMinutes = summary.sleepMinutes?.toInt(),
            avgHeartRate = summary.avgHeartRate?.roundToInt(),
            restingHeartRate = summary.restingHeartRate?.roundToInt(),
            activeKcal = summary.activeKcal?.roundToInt(),
            workoutMinutes = summary.workoutMinutes?.toInt(),
            distanceKm = summary.distanceKm,
            notes = "Sincronizado pelo Android Bridge em ${Instant.now()}"
        )
        val response = supabase.upsertDailyMetric(auth.accessToken, payload)
        val permissionStatus = health.permissionStatusText()
        setStatus("Sincronização de $day concluída e enviada ao Supabase. HTTP ${response.status.value}.")
        setSummary(
            "Data: ${summary.date}\n" +
                "Permissões:\n$permissionStatus\n" +
                "Passos: ${summary.steps ?: 0}\n" +
                "Sono: ${summary.sleepMinutes ?: 0} min\n" +
                "FC média: ${summary.avgHeartRate ?: 0.0}\n" +
                "FC repouso: ${summary.restingHeartRate ?: 0.0}\n" +
                "Kcal ativas: ${summary.activeKcal ?: 0.0}\n" +
                "Treino: ${summary.workoutMinutes ?: 0} min\n" +
                "Distância: ${summary.distanceKm ?: 0.0} km"
        )
    } catch (e: Exception) {
        setStatus("Erro ao sincronizar $day: ${e.message ?: e::class.simpleName}")
    }
}

@Composable
private fun StatusCard(status: String, summary: String?) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Status", style = MaterialTheme.typography.titleMedium)
            Text(status)
            if (summary != null) {
                Text("Último resumo", style = MaterialTheme.typography.titleSmall)
                Text(summary)
            }
        }
    }
}
