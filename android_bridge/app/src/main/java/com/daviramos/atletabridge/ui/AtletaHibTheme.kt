package com.daviramos.atletabridge.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val HibLime = Color(0xFFB8FF00)
val HibBackground = Color(0xFF070A09)
val HibSurface = Color(0xFF101513)
val HibSurfaceRaised = Color(0xFF171D1A)
val HibText = Color(0xFFF5F8F3)
val HibMuted = Color(0xFF9DA8A2)
val HibDanger = Color(0xFFFFB4AB)
val HibSuccess = Color(0xFF86EFAC)
val HibWarning = Color(0xFFFDE68A)

private val HibColors = darkColorScheme(
    primary = HibLime,
    onPrimary = Color(0xFF071000),
    primaryContainer = Color(0xFF273800),
    onPrimaryContainer = Color(0xFFD9FF73),
    background = HibBackground,
    onBackground = HibText,
    surface = HibSurface,
    onSurface = HibText,
    surfaceVariant = HibSurfaceRaised,
    onSurfaceVariant = HibMuted,
    outline = Color(0xFF3A443F),
    error = HibDanger,
    onError = Color(0xFF690005)
)

private val HibTypography = Typography(
    headlineLarge = TextStyle(fontSize = 34.sp, lineHeight = 35.sp, fontWeight = FontWeight.Black, letterSpacing = (-1.2).sp),
    headlineMedium = TextStyle(fontSize = 27.sp, lineHeight = 29.sp, fontWeight = FontWeight.Black, letterSpacing = (-0.8).sp),
    titleLarge = TextStyle(fontSize = 21.sp, lineHeight = 25.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.35).sp),
    titleMedium = TextStyle(fontSize = 17.sp, lineHeight = 22.sp, fontWeight = FontWeight.Bold),
    bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 24.sp, fontWeight = FontWeight.Medium),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 21.sp, fontWeight = FontWeight.Medium),
    labelLarge = TextStyle(fontSize = 14.sp, lineHeight = 18.sp, fontWeight = FontWeight.ExtraBold)
)

@Composable
fun AtletaHibTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = HibColors, typography = HibTypography, content = content)
}
