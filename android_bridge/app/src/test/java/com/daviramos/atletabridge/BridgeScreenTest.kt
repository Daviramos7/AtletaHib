package com.daviramos.atletabridge

import android.graphics.Bitmap
import android.graphics.Canvas
import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import com.daviramos.atletabridge.health.Metric
import com.daviramos.atletabridge.ui.AtletaHibTheme
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], qualifiers = "w360dp-h800dp")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class BridgeScreenTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val connected = BridgeState(busy = false, available = true, permissions = Metric.entries.toSet(),
        permissionsChecked = true, connected = true, configured = true, message = "Pronto para sincronizar.")

    private fun show(state: BridgeState, scale: Float = 1f, onSync: (Int) -> Unit = {}) {
        compose.setContent {
            CompositionLocalProvider(LocalDensity provides Density(1f, scale)) {
                AtletaHibTheme { BridgeScreen(state, onSync = onSync) }
            }
        }
        compose.waitForIdle()
    }
    private fun snapshot(name: String) {
        val file = File("build/outputs/android-smoke/$name.png").apply { parentFile?.mkdirs() }
        compose.runOnIdle {
            val view = compose.activity.window.decorView
            val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
            view.draw(Canvas(bitmap))
            file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        }
    }
    @Test fun connectedHomeRendersAndSyncActionWorks() {
        var clicks = 0; show(connected, onSync = { clicks++ })
        compose.onNodeWithText("Sincronizar agora").performScrollTo().assertIsEnabled().performClick()
        assertEquals(1, clicks); snapshot("connected")
    }
    @Test fun sevenDayActionSitsWithTodayAndRequestsSevenDays() {
        val requested = mutableListOf<Int>(); show(connected, onSync = { requested += it })
        compose.onNodeWithText("Sincronizar agora").performScrollTo().performClick()
        compose.onNodeWithText("Sincronizar últimos 7 dias").performScrollTo().assertIsEnabled().assertHasClickAction().performClick()
        assertEquals(listOf(1, 7), requested); snapshot("connected-7-days")
    }
    @Test fun sevenDayActionIsDisabledWhileBusyAndShowsDayProgress() {
        val requested = mutableListOf<Int>()
        show(connected.copy(busy = true, message = "Sincronizando · dia 3 de 7…"), onSync = { requested += it })
        compose.onNodeWithText("Sincronizar últimos 7 dias").performScrollTo().assertIsNotEnabled()
        compose.onNodeWithText("Sincronizando · dia 3 de 7…").assertExists()
        assertTrue(requested.isEmpty()); snapshot("syncing-7-days")
    }
    @Test fun sevenDayActionIsDisabledWithoutHealthConnect() {
        show(connected.copy(available = false))
        compose.onNodeWithText("Sincronizar últimos 7 dias").performScrollTo().assertIsNotEnabled()
    }
    @Test fun sevenDayActionIsDisabledWithoutServer() {
        show(connected.copy(configured = false))
        compose.onNodeWithText("Sincronizar últimos 7 dias").performScrollTo().assertIsNotEnabled()
    }
    @Test fun sevenDayActionHasMinimumTouchHeight() {
        show(connected)
        compose.onNodeWithText("Sincronizar últimos 7 dias").performScrollTo()
        val bounds = compose.onNodeWithText("Sincronizar últimos 7 dias").getUnclippedBoundsInRoot()
        val height = (bounds.bottom - bounds.top).value; assertTrue("touch target $height", height >= 48f)
    }
    @Test fun sevenDayLabelRemainsReadableAtDoubleFontScale() {
        show(connected, 2f)
        compose.onNodeWithText("Sincronizar últimos 7 dias").performScrollTo().assertIsDisplayed()
        val layouts = mutableListOf<TextLayoutResult>()
        compose.onNodeWithText("Sincronizar últimos 7 dias").performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
        assertTrue(layouts.isNotEmpty()); assertReadable(layouts); snapshot("font-200-sync-7-days")
    }
    @Test fun busyDisablesSyncAndShowsProgress() {
        show(connected.copy(busy = true, message = "Sincronizando…"))
        compose.onNodeWithText("Aguarde…").performScrollTo().assertIsNotEnabled()
        compose.onNodeWithText("Sincronizando…").assertExists(); snapshot("syncing")
    }
    @Test fun offlineHasRetryWithoutPromisingQueue() {
        show(connected.copy(error = true, message = "Sem conexão. Não foi possível enviar os dados."))
        compose.onNodeWithText("Tentar sincronizar novamente").performScrollTo().assertIsEnabled()
        snapshot("offline")
    }
    @Test fun permissionLabelsRemainReadableAtDoubleFontScale() {
        show(connected.copy(permissions = emptySet(), requested = true), 2f)
        compose.onNodeWithText("Sincronizar agora").performScrollTo().assertIsDisplayed()
        val layouts = mutableListOf<TextLayoutResult>()
        compose.onNodeWithText("Sincronizar agora").performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
        snapshot("font-200-sync")
        assertTrue("Text layout missing", layouts.isNotEmpty())
        assertReadable(layouts)
        compose.onNodeWithText("Batimentos em repouso").performScrollTo().assertIsDisplayed()
        val permissionLayouts = mutableListOf<TextLayoutResult>()
        compose.onAllNodesWithText("! Não concedida ou revogada")[3]
            .performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(permissionLayouts) }
        assertTrue(permissionLayouts.isNotEmpty()); assertReadable(permissionLayouts)
        snapshot("font-200-permissions")
    }
    private fun assertReadable(layouts: List<TextLayoutResult>) {
        layouts.forEach { result ->
            // Native Skia/Compose rounds the layout size to physical pixels; tolerate only that subpixel difference.
            assertTrue(result.multiParagraph.height <= result.size.height + 1f)
            for (line in 0 until result.lineCount) {
                assertFalse(result.isLineEllipsized(line))
                assertTrue(result.getLineRight(line) <= result.size.width + 1f)
            }
        }
    }
    @Test fun disconnectedShowsDedicatedLoginWithoutSyncAction() {
        show(connected.copy(connected = false))
        compose.onNodeWithText("Entrar", useUnmergedTree = true).performScrollTo().assertExists()
        compose.onNodeWithText("Sincronizar agora").assertDoesNotExist()
        compose.onNodeWithContentDescription("Mostrar senha").assertExists()
        snapshot("login")
    }
}
