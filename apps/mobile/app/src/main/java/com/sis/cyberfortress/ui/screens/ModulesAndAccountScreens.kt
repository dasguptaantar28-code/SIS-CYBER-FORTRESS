package com.sis.cyberfortress.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sis.cyberfortress.BuildConfig
import com.sis.cyberfortress.ui.theme.FortressCard
import com.sis.cyberfortress.ui.theme.SisColors
import com.sis.cyberfortress.ui.theme.StatusPill
import com.sis.cyberfortress.ui.viewmodel.FortressUiState

@Composable
fun ModulesHubScreen(
    uiState: FortressUiState,
    onOpenModule: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SisColors.BgPrimary)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("12 Cybersecurity Modules", color = SisColors.TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Text("Integrated defensive ecosystem backed by NestJS + PostgreSQL.", color = SisColors.TextSecondary, fontSize = 12.sp)

        uiState.modules.forEach { mod ->
            FortressCard(modifier = Modifier.fillMaxWidth().clickable { onOpenModule(mod.slug) }) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("${mod.number} • ${mod.name}", color = SisColors.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text(mod.description, color = SisColors.TextSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                    }
                    StatusPill(mod.healthStatus, if (mod.healthStatus == "HEALTHY") SisColors.Success else SisColors.Warning)
                }
                Spacer(modifier = Modifier.height(6.dp))
                Text("Posture: ${mod.postureScore}% • Open Alerts: ${mod.openAlertCount}", color = SisColors.Cyan, fontSize = 11.sp)
            }
        }
    }
}

@Composable
fun ModuleDetailScreen(
    slug: String,
    uiState: FortressUiState,
    onNavigate: (String) -> Unit,
    onRunWebShieldScan: (String) -> Unit,
    onCheckBreachPrefix: (String) -> Unit
) {
    val mod = uiState.modules.find { it.slug == slug }
    var pwCandidate by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SisColors.BgPrimary)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text(mod?.name ?: slug.uppercase(), color = SisColors.TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        FortressCard {
            Text(mod?.description ?: "Integrated security module.", color = SisColors.TextSecondary, fontSize = 13.sp)
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatusPill(mod?.healthStatus ?: "ACTIVE", SisColors.Success)
                StatusPill("SCORE ${mod?.postureScore ?: 100}%", SisColors.Cyan)
            }
        }

        when (slug) {
            "identity-guardian" -> {
                FortressCard {
                    Text("Identity Score: ${uiState.identityOverview?.identitySecurityScore ?: 0}%", color = SisColors.Success, fontWeight = FontWeight.Bold)
                    Text("Active Sessions: ${uiState.identityOverview?.activeSessions ?: 1}", color = SisColors.TextPrimary, fontSize = 13.sp)
                    Text("Provider Mode: ${uiState.identityOverview?.breachProviderStatus ?: "LOCAL_K_ANON_ONLY"}", color = SisColors.TextSecondary, fontSize = 12.sp)
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedTextField(
                        value = pwCandidate,
                        onValueChange = { pwCandidate = it },
                        label = { Text("k-Anonymity Breach Check (Local SHA-1 Prefix)") },
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(
                        onClick = {
                            onCheckBreachPrefix(pwCandidate)
                            pwCandidate = ""
                        },
                        enabled = pwCandidate.isNotBlank(),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Check 5-Char Hash Prefix Safely")
                    }
                    uiState.lastBreachCheck?.let { res ->
                        Text(
                            "${res.providerStatus}: ${res.suffixCount} suffix entries returned for prefix ${res.prefix}. ${res.privacyNote}",
                            color = SisColors.Cyan,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                    }
                }
            }
            "phishing-shield" -> Button(onClick = { onNavigate("phishing") }, modifier = Modifier.fillMaxWidth()) { Text("Open Phishing URL Scanner") }
            "endpoint-guardian" -> Button(onClick = { onNavigate("device_security") }, modifier = Modifier.fillMaxWidth()) { Text("Open Endpoint Device Posture") }
            "network-sentinel" -> Button(onClick = { onNavigate("network_security") }, modifier = Modifier.fillMaxWidth()) { Text("Open Network Sentinel Inspector") }
            "vault-guardian" -> Button(onClick = { onNavigate("vault") }, modifier = Modifier.fillMaxWidth()) { Text("Open Zero-Knowledge Vault") }
            "cloud-backup" -> Button(onClick = { onNavigate("backup_center") }, modifier = Modifier.fillMaxWidth()) { Text("Open Encrypted Backup Center") }
            "webshield" -> {
                FortressCard {
                    Text("Authorized Assets (${uiState.assets.count { it.isApprovedForScan }} Approved)", color = SisColors.TextPrimary, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))
                    uiState.assets.filter { it.isApprovedForScan }.forEach { asset ->
                        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(asset.name, color = SisColors.TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                Text(asset.targetUrl, color = SisColors.Cyan, fontSize = 11.sp)
                            }
                            Button(onClick = { onRunWebShieldScan(asset.id) }) { Text("Scan") }
                        }
                    }
                }
                uiState.webShieldHistory.forEach { scan ->
                    FortressCard {
                        Text(scan.targetValue, color = SisColors.Cyan, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        scan.result?.let { Text("${it.riskLevel}: ${it.summary}", color = SisColors.TextSecondary, fontSize = 12.sp) }
                    }
                }
            }
            "threat-intelligence" -> {
                Text("Active Threat IOCs (${uiState.threatIndicators.size})", color = SisColors.TextPrimary, fontWeight = FontWeight.Bold)
                uiState.threatIndicators.forEach { ioc ->
                    FortressCard {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("${ioc.indicatorType}: ${ioc.value}", color = SisColors.Cyan, fontSize = 12.sp, modifier = Modifier.weight(1f))
                            StatusPill(ioc.severity, SisColors.Warning)
                        }
                        Text("${ioc.threatCategory} • Confidence ${ioc.confidence}%", color = SisColors.TextSecondary, fontSize = 11.sp)
                    }
                }
            }
            else -> {
                // Ransomware Guardian, Digital Forensics, Access Guardian, Cyber SOC
                FortressCard {
                    Text("Recent SOC Alerts (${uiState.alerts.size})", color = SisColors.TextPrimary, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(6.dp))
                    uiState.alerts.take(8).forEach { a ->
                        Text("• [${a.severity}] ${a.title} (${a.status})", color = SisColors.TextSecondary, fontSize = 12.sp, modifier = Modifier.padding(vertical = 2.dp))
                    }
                }
                if (slug == "ransomware-guardian") {
                    FortressCard {
                        val verified = uiState.backups?.summary?.verifiedCount ?: 0
                        Text("Verified Backups Available: $verified", color = if (verified > 0) SisColors.Success else SisColors.Warning, fontWeight = FontWeight.Bold)
                        Text("Ransomware readiness is tied directly to verified AES-256-GCM backups. Never run destructive payloads.", color = SisColors.TextSecondary, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

@Composable
fun NotificationsScreen(
    uiState: FortressUiState,
    onMarkRead: (String) -> Unit
) {
    val resp = uiState.notifications
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SisColors.BgPrimary)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Security Notifications", color = SisColors.TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Text("FCM Push: ${resp?.pushProviderStatus ?: "LOCAL_STORE"} • Unread: ${resp?.unreadCount ?: 0}", color = SisColors.TextSecondary, fontSize = 12.sp)

        val list = resp?.items ?: emptyList()
        if (list.isEmpty()) {
            FortressCard { Text("No notifications yet.", color = SisColors.TextSecondary) }
        } else {
            list.forEach { n ->
                FortressCard(borderColor = if (!n.isRead) SisColors.Cyan else SisColors.CardBorder) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(n.title, color = SisColors.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp, modifier = Modifier.weight(1f))
                        StatusPill(n.severity, if (n.severity == "HIGH" || n.severity == "CRITICAL") SisColors.Danger else SisColors.Cyan)
                    }
                    Text(n.message, color = SisColors.TextSecondary, fontSize = 12.sp, modifier = Modifier.padding(vertical = 4.dp))
                    if (!n.isRead) {
                        OutlinedButton(onClick = { onMarkRead(n.id) }) { Text("Mark Read") }
                    }
                }
            }
        }
    }
}

@Composable
fun ActivityHistoryScreen(uiState: FortressUiState) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SisColors.BgPrimary)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Account Activity History", color = SisColors.TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        val history = uiState.identityOverview?.loginHistory ?: emptyList()
        if (history.isEmpty()) {
            FortressCard { Text("No login activity loaded yet.", color = SisColors.TextSecondary) }
        } else {
            history.forEach { h ->
                FortressCard {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(h.emailAttempted, color = SisColors.TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                        StatusPill(if (h.success) "SUCCESS" else "FAILED", if (h.success) SisColors.Success else SisColors.Danger)
                    }
                    Text("IP: ${h.ipAddress ?: "N/A"} • ${h.createdAt}", color = SisColors.TextSecondary, fontSize = 11.sp)
                }
            }
        }
    }
}

@Composable
fun ProfileScreen(
    uiState: FortressUiState,
    onNavigate: (String) -> Unit,
    onLogout: () -> Unit
) {
    val user = uiState.currentUser
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SisColors.BgPrimary)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text("Account Profile", color = SisColors.TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        FortressCard {
            Text(user?.fullName ?: "Signed In User", color = SisColors.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 17.sp)
            Text(user?.email ?: "", color = SisColors.Cyan, fontSize = 13.sp)
            Spacer(modifier = Modifier.height(6.dp))
            Text("Organization: ${user?.organizationName ?: "SIS Enterprise"}", color = SisColors.TextSecondary, fontSize = 12.sp)
            Text("Roles: ${user?.roles?.joinToString(", ") ?: "USER"}", color = SisColors.TextSecondary, fontSize = 12.sp)
            Text("MFA Status: ${if (user?.mfaEnabled == true) "TOTP Active" else "Not Enabled"}", color = if (user?.mfaEnabled == true) SisColors.Success else SisColors.Warning, fontSize = 12.sp)
        }

        OutlinedButton(onClick = { onNavigate("settings") }, modifier = Modifier.fillMaxWidth()) { Text("App & Security Settings") }
        OutlinedButton(onClick = { onNavigate("help") }, modifier = Modifier.fillMaxWidth()) { Text("Help & Privacy Disclosures") }
        Button(onClick = onLogout, modifier = Modifier.fillMaxWidth()) { Text("Sign Out Securely") }
    }
}

@Composable
fun SettingsScreen(
    uiState: FortressUiState,
    biometricEnabled: Boolean,
    onToggleBiometric: (Boolean) -> Unit,
    onUpdateServerUrl: (String) -> Unit
) {
    var url by remember(uiState.apiBaseUrl) { mutableStateOf(uiState.apiBaseUrl) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SisColors.BgPrimary)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text("Settings", color = SisColors.TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        FortressCard {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Biometric Prompt for Vault", color = SisColors.TextPrimary, fontWeight = FontWeight.SemiBold)
                    Text("Require fingerprint or device lock before Vault PIN.", color = SisColors.TextSecondary, fontSize = 12.sp)
                }
                Switch(checked = biometricEnabled, onCheckedChange = onToggleBiometric)
            }
        }

        if (BuildConfig.ALLOW_CUSTOM_API_URL) {
            FortressCard {
                Text("API Base URL (Debug Build)", color = SisColors.Cyan, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = url, onValueChange = { url = it }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(8.dp))
                Button(onClick = { onUpdateServerUrl(url) }, modifier = Modifier.fillMaxWidth()) { Text("Save API Endpoint") }
            }
        }
    }
}

@Composable
fun HelpSupportScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SisColors.BgPrimary)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Help, Ethics & OS Limitations", color = SisColors.TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        FortressCard {
            Text("Authorized Defensive Use Only", color = SisColors.Cyan, fontWeight = FontWeight.Bold)
            Text(
                "SIS Cyber Fortress operates exclusively on owned or authorized devices and verified domains. We never bypass Android OS restrictions, root controls, or uninstall protections.",
                color = SisColors.TextSecondary,
                fontSize = 13.sp
            )
        }
        FortressCard {
            Text("Android OS Visibility Disclosures", color = SisColors.Cyan, fontWeight = FontWeight.Bold)
            Text(
                "• Installed app inventory inspects only standard launcher-visible packages.\n• Wi-Fi SSID & cipher types require optional Location permission on Android.\n• Vault Guardian secrets remain encrypted client-side with AES-256-GCM.",
                color = SisColors.TextSecondary,
                fontSize = 13.sp
            )
        }
    }
}
