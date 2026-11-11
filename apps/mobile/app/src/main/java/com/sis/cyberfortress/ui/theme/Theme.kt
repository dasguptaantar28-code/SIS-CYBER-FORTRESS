package com.sis.cyberfortress.ui.theme

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

object SisColors {
    val BgPrimary = Color(0xFF050B18)
    val BgSecondary = Color(0xFF0B1730)
    val CardBg = Color(0xFF10213F)
    val CardBorder = Color(0xFF1B335E)
    val PrimaryBlue = Color(0xFF087BFF)
    val Cyan = Color(0xFF00D4FF)
    val Success = Color(0xFF00D69A)
    val Warning = Color(0xFFFFB547)
    val Danger = Color(0xFFFF4560)
    val TextPrimary = Color(0xFFF3F7FF)
    val TextSecondary = Color(0xFF96A8C5)
}

private val DarkPalette = darkColorScheme(
    primary = SisColors.PrimaryBlue,
    secondary = SisColors.Cyan,
    background = SisColors.BgPrimary,
    surface = SisColors.BgSecondary,
    surfaceVariant = SisColors.CardBg,
    onPrimary = Color.White,
    onBackground = SisColors.TextPrimary,
    onSurface = SisColors.TextPrimary,
    error = SisColors.Danger
)

@Composable
fun SisCyberFortressTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkPalette,
        content = content
    )
}

@Composable
fun FortressCard(
    modifier: Modifier = Modifier,
    borderColor: Color = SisColors.CardBorder,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = SisColors.CardBg.copy(alpha = 0.92f)),
        border = BorderStroke(1.dp, borderColor.copy(alpha = 0.7f))
    ) {
        Column(modifier = Modifier.padding(16.dp), content = content)
    }
}

@Composable
fun StatusPill(text: String, color: Color) {
    Surface(
        shape = RoundedCornerShape(50),
        color = color.copy(alpha = 0.16f),
        border = BorderStroke(1.dp, color.copy(alpha = 0.45f))
    ) {
        Text(
            text = text.replace("_", " "),
            color = color,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
        )
    }
}
