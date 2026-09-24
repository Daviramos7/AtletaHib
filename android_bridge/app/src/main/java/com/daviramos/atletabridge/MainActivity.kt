package com.daviramos.atletabridge

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import com.daviramos.atletabridge.data.SendState
import com.daviramos.atletabridge.health.*
import com.daviramos.atletabridge.ui.AtletaHibTheme
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // Health data and credentials must not appear in screenshots/recent-app previews in release.
        if (!BuildConfig.DEBUG) window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        setContent { AtletaHibTheme { BridgeApp() } }
    }
}

@Composable
fun BridgeApp(model: BridgeViewModel = viewModel()) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val launcher = rememberLauncherForActivityResult(HealthConnectBridgeConfig.requestPermissionsContract) {
        model.refreshPermissions()
    }
    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_RESUME) model.refreshPermissions() }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer) }
    }
    BridgeScreen(model.state, model::signIn, model::signOut, model::sync, {
        try {
            if (model.state.available) {
                model.permissionRequested()
                launcher.launch(HealthConnectBridgeConfig.readPermissions)
            } else if (!openHealthConnect(context)) model.notifyPermissionError()
        } catch (_: Exception) { model.notifyPermissionError() }
    }, { if (!openHealthConnect(context)) model.notifyPermissionError() })
}

@Composable
fun BridgeScreen(
    state: BridgeState,
    onSignIn: (String, String) -> Unit = { _, _ -> }, onSignOut: () -> Unit = {},
    onSync: (Int) -> Unit = {}, onPermissions: () -> Unit = {}, onHealthSettings: () -> Unit = {}
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var details by remember { mutableStateOf(false) }
    var logoutConfirm by remember { mutableStateOf(false) }
    LaunchedEffect(state.connected) { if (state.connected) password = "" }
    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(Modifier.fillMaxSize().safeDrawingPadding().imePadding().verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Image(painterResource(R.drawable.atleta_hib_logo_horizontal), "Atleta Hib",
                Modifier.fillMaxWidth().height(48.dp), contentScale = ContentScale.Fit)
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Conectar saúde", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.semantics { heading() })
                Text("Envie as métricas do Health Connect para sua conta.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Section("Sincronização") {
                StatusLine("Health Connect", if (state.available) "✓ Disponível" else "! Instale ou atualize")
                StatusLine("Conta", if (state.connected) "✓ Sessão salva" else "! Entre para conectar")
                StatusLine("Servidor", state.backendStatus)
                Text("Última sincronização completa: ${formatSyncTime(state.lastSync)}", style = MaterialTheme.typography.bodyMedium)
                if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                Text((if (state.error) "! " else if (state.result != null) "✓ " else "") + state.message,
                    color = if (state.error) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
                Button(onClick = { onSync(1) }, enabled = !state.busy && state.connected && state.available && state.configured,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) {
                    Text(if (state.busy) "Aguarde…" else if (state.error && state.connected) "Tentar sincronizar novamente" else "Sincronizar agora")
                }
                TextButton(onClick = { onSync(7) }, enabled = !state.busy && state.connected && state.available && state.configured,
                    modifier = Modifier.fillMaxWidth()) { Text("Sincronizar últimos 7 dias") }
                if (!state.configured) Text("! Servidor não configurado neste APK.", color = MaterialTheme.colorScheme.error)
                state.result?.let { result ->
                    Text("${result.sent} resumo(s) enviado(s) · ${result.unchanged} sem alteração", style = MaterialTheme.typography.labelLarge)
                    Metric.entries.forEach { metric ->
                        val readings = result.days.mapNotNull { day -> day.read.metrics[metric]?.let { day to it } }
                        val label = when {
                            readings.any { it.second.state == ReadState.ERROR } -> "! Falha na leitura"
                            readings.any { it.second.state == ReadState.NO_PERMISSION } -> "! Permissão necessária"
                            readings.any { it.second.state == ReadState.AVAILABLE && it.first.send == SendState.FAILED } -> "! Lido; envio não confirmado"
                            readings.any { it.second.state == ReadState.AVAILABLE && it.first.send == SendState.SENT } -> "✓ Atualizado"
                            readings.any { it.second.state == ReadState.AVAILABLE } -> "✓ Já atualizado"
                            else -> "— Sem dados no período"
                        }
                        StatusLine(metric.label, label)
                    }
                }
            }
            if (!state.connected) Section("Sua conta") {
                Text("Use o e-mail e a senha do Atleta Hib.")
                OutlinedTextField(email, { email = it }, label = { Text("E-mail") }, singleLine = true,
                    enabled = !state.busy, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), modifier = Modifier.fillMaxWidth())
                OutlinedTextField(password, { password = it }, label = { Text("Senha") }, singleLine = true,
                    enabled = !state.busy, visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), modifier = Modifier.fillMaxWidth())
                Button(onClick = { onSignIn(email, password); password = "" },
                    enabled = !state.busy && state.configured && email.isNotBlank() && password.isNotBlank(), modifier = Modifier.fillMaxWidth()) { Text("Entrar") }
                Text("Sua senha não é salva no celular.", style = MaterialTheme.typography.bodyMedium)
            }
            Section("Permissões") {
                Text("No Mi Fitness, permita o envio ao Health Connect. Aqui, escolha o que o Atleta Hib pode ler.", style = MaterialTheme.typography.bodyMedium)
                Metric.entries.forEach { metric ->
                    StatusLine(metric.label, when {
                        !state.available -> "— Health Connect indisponível"
                        !state.permissionsChecked -> "— Não foi possível verificar"
                        metric in state.permissions -> "✓ Permitido"
                        state.requested -> "! Não concedida ou revogada"
                        else -> "! Ainda não solicitada"
                    })
                }
                OutlinedButton(onClick = onPermissions, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) { Text("Abrir permissões") }
                TextButton(onClick = onHealthSettings, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) { Text("Abrir Health Connect") }
            }
            TextButton(onClick = { details = !details }, modifier = Modifier.fillMaxWidth()) {
                Text(if (details) "Ocultar detalhes" else "Ver detalhes da conexão")
            }
            if (details) Section("Detalhes da conexão") {
                Text("Versão ${BuildConfig.VERSION_NAME} · build ${BuildConfig.VERSION_CODE}")
                Text("Sincronização manual. Não há envio automático nem fila offline.")
                Text("Batimentos: todas as amostras válidas compõem uma média diária. O servidor não armazena cada amostra separadamente.")
                state.result?.days?.forEach { day ->
                    val hr = day.read.metrics[Metric.HEART_RATE]
                    if (hr != null) {
                        Text("${day.read.date}: ${hr.records} registro(s), ${hr.samples} amostra(s) lida(s), ${hr.validSamples} válida(s), ${hr.ignoredSamples} ignorada(s).")
                        Text("Resumo diário: ${when (day.send) {
                            SendState.SENT -> "enviado"; SendState.UNCHANGED -> "sem alteração"; SendState.NO_DATA -> "sem dados para enviar"; SendState.FAILED -> "envio não confirmado"
                        }}")
                        if (BuildConfig.DEBUG && hr.origins.isNotEmpty()) Text("Origens: ${hr.origins.sorted().joinToString()}")
                    }
                }
                Text("O acesso é somente de leitura no Health Connect. Nenhum registro é apagado. Você pode revogar permissões nas configurações.")
            }
            if (state.connected) TextButton(onClick = { logoutConfirm = true }, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) { Text("Sair de todos os dispositivos") }
        }
        if (logoutConfirm) AlertDialog(onDismissRequest = { logoutConfirm = false },
            title = { Text("Sair de todos os dispositivos?") },
            text = { Text("Seus dados permanecem salvos. Outras sessões serão encerradas ao renovar o acesso.") },
            confirmButton = { TextButton(onClick = { logoutConfirm = false; onSignOut() }) { Text("Sair") } },
            dismissButton = { TextButton(onClick = { logoutConfirm = false }) { Text("Cancelar") } })
    }
}

@Composable
private fun Section(title: String, content: @Composable ColumnScope.() -> Unit) {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge, modifier = Modifier.semantics { heading() })
            content()
        }
    }
}

@Composable
private fun StatusLine(label: String, status: String) {
    // Vertical pairs keep long permission labels readable at 200% font scale and narrow widths.
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, style = MaterialTheme.typography.labelLarge)
        Text(status, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

private fun formatSyncTime(value: String?): String = value?.let {
    try { DateTimeFormatter.ofPattern("dd/MM · HH:mm").withZone(ZoneId.systemDefault()).format(Instant.parse(it)) }
    catch (_: Exception) { "Ainda não realizada" }
} ?: "Ainda não realizada"

private fun openHealthConnect(context: Context): Boolean {
    val action = if (Build.VERSION.SDK_INT >= 34) "android.health.connect.action.HEALTH_HOME_SETTINGS"
        else "androidx.health.ACTION_HEALTH_CONNECT_SETTINGS"
    val intents = listOf(Intent(action), Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.google.android.apps.healthdata")))
    for (intent in intents) try {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); return true
    } catch (_: ActivityNotFoundException) { /* Try the next supported destination. */ }
      catch (_: SecurityException) { /* Restricted provider; try the store. */ }
    return false
}
