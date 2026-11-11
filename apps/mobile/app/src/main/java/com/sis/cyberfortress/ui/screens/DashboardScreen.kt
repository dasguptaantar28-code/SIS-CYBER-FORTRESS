package com.sis.cyberfortress.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sis.cyberfortress.R
import com.sis.cyberfortress.ui.theme.FortressCard
import com.sis.cyberfortress.ui.theme.SisColors
import com.sis.cyberfortress.ui.theme.StatusPill
import com.sis.cyberfortress.ui.viewmodel.FortressUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    uiState: FortressUiState,
    onRefresh: () -> Unit,
    onNavigate: (String) -> Unit
) {
    val kpis = uiState.dashboard?.kpis
    val postureScore = kpis?.overallSecurityPosture ?: 0

    PullToRefreshBox(
        isRefreshing = uiState.loading,
        onRefresh = onRefresh,
        modifier = Modifier
            .fillMaxSize()
            .background(SisColors.BgPrimary)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Top Branding Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Image(
                        painter = painterResource(id = R.drawable.sis_fortress_logo),
                        contentDescription = "SIS Cyber Fortress",
                        modifier = Modifier
                            .size(44.dp)
                            .clip(RoundedCornerShape(12.dp))
                    )
                    Column {
                        Text("SIS CYBER FORTRESS", color = SisColors.TextPrimary, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
                        Text(
                            text = "Welcome, ${uiState.currentUser?.fullName?.substringBefore(" ") ?: "Defender"}",
                            color = SisColors.Cyan,
                            fontSize = 12.sp
                        )
                    }
                }
                Row {
                    IconButton(onClick = onRefresh) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = SisColors.Cyan)
                    }
                    IconButton(onClick = { onNavigate("notifications") }) {
                        Icon(Icons.Default.Notifications, contentDescription = "Notifications", tint = SisColors.TextPrimary)
                    }
                }
            }

            if (uiState.errorMessage != null) {
                FortressCard(borderColor = SisColors.Danger) {
                    Text(uiState.errorMessage, color = SisColors.Danger, fontSize = 12.sp)
                }
            }

            // Security Score Hero Card
            FortressCard(borderColor = SisColors.Cyan.copy(alpha = 0.45f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(100.dp)) {
                        Canvas(modifier = Modifier.size(90.dp)) {
                            drawArc(
                                color = SisColors.CardBorder,
                                startAngle = 0f,
                                sweepAngle = 360f,
                                useCenter = false,
                                style = Stroke(width = 12f)
                            )
                            drawArc(
                                color = SisColors.Success,
                                startAngle = -90f,
                                sweepAngle = (postureScore / 100f) * 360f,
                                useCenter = false,
                                style = Stroke(width = 12f, cap = StrokeCap.Round)
                            )
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("$postureScore%", color = SisColors.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                            Text("POSTURE", color = SisColors.TextSecondary, fontSize = 9.sp)
                        }
                    }

                    Column(modifier = Modifier.weight(1f).padding(start = 16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Ecosystem Protection", color = SisColors.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text(
                            "Modules Active: ${kpis?.activeModules ?: 0}/${kpis?.totalModules ?: 12}",
                            color = SisColors.TextSecondary,
                            fontSize = 12.sp
                        )
                        Text(
                            "Open Alerts: ${kpis?.openSecurityAlerts ?: 0} • Devices: ${kpis?.registeredDevices ?: 0}",
                            color = SisColors.TextSecondary,
                            fontSize = 12.sp
                        )
                        StatusPill(
                            text = "Backup: ${kpis?.backupStatus ?: "UNKNOWN"}",
                            color = if (kpis?.backupStatus == "HEALTHY") SisColors.Success else SisColors.Warning
                        )
                    }
                }
            }

            // Device Security Snapshot
            val localPosture = uiState.localPosture
            FortressCard {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column {
                        Text("This Device Status", color = SisColors.TextSecondary, fontSize = 11.sp)
                        Text(localPosture?.deviceName ?: "Android Endpoint", color = SisColors.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text(localPosture?.osVersion ?: "", color = SisColors.Cyan, fontSize = 12.sp)
                    }
                    StatusPill(
                        text = if (localPosture?.isRootedOrCompromised == true) "AT RISK" else "PROTECTED",
                        color = if (localPosture?.isRootedOrCompromised == true) SisColors.Danger else SisColors.Success
                    )
                }
            }

            // 8 Quick Actions Grid
            Text("Quick Security Tools", color = SisColors.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            val quickTools = listOf(
                Triple("Scan Phishing", Icons.Default.Warning, "phishing"),
                Triple("Website Safety", Icons.Default.Language, "module/webshield"),
                Triple("Secure Vault", Icons.Default.Lock, "vault"),
                Triple("Device Check", Icons.Default.PhoneAndroid, "device_security"),
                Triple("Network Guard", Icons.Default.Wifi, "network_security"),
                Triple("Threat Alerts", Icons.Default.Shield, "module/cyber-soc"),
                Triple("Backup Center", Icons.Default.Cloud, "backup_center"),
                Triple("Activity Log", Icons.Default.History, "activity_history")
            )
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                quickTools.chunked(2).forEach { rowItems ->
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        rowItems.forEach { (label, icon, route) ->
                            QuickActionTile(
                                label = label,
                                icon = icon,
                                onClick = { onNavigate(route) },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }

            // Module Overview Shortcut
            FortressCard(modifier = Modifier.fillMaxWidth().clickable { onNavigate("modules") }) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column {
                        Text("All 12 Cybersecurity Modules", color = SisColors.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text("Tap to inspect module status & workflows", color = SisColors.TextSecondary, fontSize = 12.sp)
                    }
                    Text("Open →", color = SisColors.Cyan, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
            }

            // Recent Activity Feed
            Text("Recent Security Activity", color = SisColors.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            val activities = uiState.dashboard?.recentActivities ?: emptyList()
            if (activities.isEmpty()) {
                FortressCard {
                    Text("No recent SOC events recorded yet.", color = SisColors.TextSecondary, fontSize = 13.sp)
                }
            } else {
                activities.take(5).forEach { act ->
                    FortressCard {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(act.event, color = SisColors.TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                Text("${act.sourceModule} • ${act.target}", color = SisColors.TextSecondary, fontSize = 11.sp)
                            }
                            StatusPill(
                                text = act.severity,
                                color = when (act.severity) {
                                    "CRITICAL", "HIGH" -> SisColors.Danger
                                    "MEDIUM" -> SisColors.Warning
                                    else -> SisColors.Cyan
                                }
                            )
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@Composable
private fun QuickActionTile(
    label: String,
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    FortressCard(modifier = modifier.clickable { onClick() }) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(icon, contentDescription = label, tint = SisColors.Cyan, modifier = Modifier.size(22.dp))
            Text(label, color = SisColors.TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}
