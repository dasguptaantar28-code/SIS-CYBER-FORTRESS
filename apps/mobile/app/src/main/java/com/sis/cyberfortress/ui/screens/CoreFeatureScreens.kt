package com.sis.cyberfortress.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.sis.cyberfortress.core.security.VaultCryptoManager
import com.sis.cyberfortress.ui.theme.FortressCard
import com.sis.cyberfortress.ui.theme.SisColors
import com.sis.cyberfortress.ui.theme.StatusPill
import com.sis.cyberfortress.ui.viewmodel.FortressUiState

@Composable
fun DeviceSecurityScreen(
    uiState: FortressUiState,
    onSyncDevice: () -> Unit
) {
    val posture = uiState.localPosture
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SisColors.BgPrimary)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text("SIS Endpoint Guardian", color = SisColors.TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        FortressCard(borderColor = SisColors.Cyan.copy(alpha = 0.4f)) {
            Text(
                posture?.policyDisclosure ?: "Respects Android 11+ package visibility restrictions.",
                color = SisColors.TextSecondary,
                fontSize = 12.sp
            )
        }

        if (posture != null) {
            FortressCard {
                Text(posture.deviceName, color = SisColors.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text("${posture.osVersion} • Patch: ${posture.securityPatchLevel}", color = SisColors.Cyan, fontSize = 12.sp)
                Spacer(modifier = Modifier.height(10.dp))
                Text("Screen Lock: ${if (posture.screenLockEnabled) "Enabled" else "Missing"}", color = SisColors.TextPrimary, fontSize = 13.sp)
                Text("Storage Encryption: ${if (posture.encryptionEnabled) "Active" else "Check Settings"}", color = SisColors.TextPrimary, fontSize = 13.sp)
                Text("Biometric Support: ${if (posture.biometricSupported) "Hardware Ready" else "Unavailable"}", color = SisColors.TextPrimary, fontSize = 13.sp)
                Text("Root Indicators: ${if (posture.isRootedOrCompromised) "Detected (Risk)" else "None Detected"}", color = if (posture.isRootedOrCompromised) SisColors.Danger else SisColors.Success, fontSize = 13.sp)
                Text("Permitted Apps Inspected: ${posture.installedAppCount} (${posture.highRiskPermissionCount} with 3+ sensitive permissions)", color = SisColors.TextSecondary, fontSize = 12.sp)
            }
        }

        Button(
            onClick = onSyncDevice,
            modifier = Modifier.fillMaxWidth().height(48.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = SisColors.PrimaryBlue)
        ) {
            Text("Sync Posture to Enterprise SOC")
        }

        posture?.visibleApps?.forEach { app ->
            FortressCard {
                Text(app.appName, color = SisColors.TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Text(app.packageName, color = SisColors.TextSecondary, fontSize = 11.sp)
                if (app.sensitivePermissions.isNotEmpty()) {
                    Text(
                        "Permissions: ${app.sensitivePermissions.joinToString(", ")}",
                        color = SisColors.Warning,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun PhishingScannerScreen(
    uiState: FortressUiState,
    onScanUrl: (String) -> Unit
) {
    var urlInput by remember { mutableStateOf("") }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SisColors.BgPrimary)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text("SIS Phishing Shield", color = SisColors.TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        FortressCard {
            OutlinedTextField(
                value = urlInput,
                onValueChange = { urlInput = it },
                label = { Text("Enter URL (https://...)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(10.dp))
            Button(
                onClick = { onScanUrl(urlInput) },
                enabled = urlInput.isNotBlank() && !uiState.loading,
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape = RoundedCornerShape(14.dp)
            ) {
                Text(if (uiState.loading) "Analyzing..." else "Scan Link for Phishing Indicators")
            }
        }

        uiState.lastPhishingResult?.let { res ->
            FortressCard(borderColor = if (res.riskLevel == "HIGH_RISK") SisColors.Danger else SisColors.Cyan) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Risk Score: ${res.riskScore}/100", color = SisColors.TextPrimary, fontWeight = FontWeight.Bold)
                    StatusPill(
                        text = res.riskLevel,
                        color = when (res.riskLevel) {
                            "HIGH_RISK" -> SisColors.Danger
                            "SUSPICIOUS" -> SisColors.Warning
                            else -> SisColors.Success
                        }
                    )
                }
                Spacer(modifier = Modifier.height(6.dp))
                Text(res.summary, color = SisColors.TextPrimary, fontSize = 13.sp)
                Text(res.verdictDisclaimer, color = SisColors.TextSecondary, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp))
            }
        }

        Text("Recent Scan History", color = SisColors.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
        uiState.phishingHistory.forEach { job ->
            FortressCard {
                Text(job.targetValue, color = SisColors.Cyan, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                job.result?.let { r ->
                    Text("${r.riskLevel} (${r.riskScore}/100) — ${r.summary}", color = SisColors.TextSecondary, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
fun NetworkSecurityScreen(
    uiState: FortressUiState,
    onSubmitCheck: (Map<String, Boolean>) -> Unit
) {
    val context = LocalContext.current
    var hasLocation by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { perms ->
        hasLocation = perms[Manifest.permission.ACCESS_FINE_LOCATION] == true
    }

    val checklist = remember {
        mutableStateMapOf(
            "avoidOpenPublicWifi" to true,
            "useTrustedVpn" to true,
            "httpsOnlyBrowsing" to true,
            "disableAutoConnect" to true
        )
    }

    val net = uiState.localNetwork
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SisColors.BgPrimary)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text("SIS Network Sentinel", color = SisColors.TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)

        if (net != null) {
            FortressCard(borderColor = if (net.isOpenOrUnsafe) SisColors.Danger else SisColors.Cyan) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(net.transportLabel, color = SisColors.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    StatusPill(
                        text = net.wifiSecurityType,
                        color = if (net.isOpenOrUnsafe) SisColors.Danger else SisColors.Success
                    )
                }
                Spacer(modifier = Modifier.height(6.dp))
                Text("VPN Active: ${if (net.isVpnActive) "Yes" else "No"} • Metered: ${if (net.isMetered) "Yes" else "No"}", color = SisColors.TextSecondary, fontSize = 12.sp)
                Text(net.ssidVisibilityNote, color = SisColors.Cyan, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
            }
        }

        if (!hasLocation) {
            OutlinedButton(
                onClick = {
                    permissionLauncher.launch(
                        arrayOf(
                            Manifest.permission.ACCESS_COARSE_LOCATION,
                            Manifest.permission.ACCESS_FINE_LOCATION
                        )
                    )
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Grant Optional Location Permission for Wi-Fi Security Inspection")
            }
        }

        FortressCard {
            Text("Network Hardening Checklist", color = SisColors.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            checklist.keys.toList().forEach { key ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = checklist[key] == true,
                        onCheckedChange = { checklist[key] = it }
                    )
                    Text(key.replace(Regex("([A-Z])"), " $1"), color = SisColors.TextPrimary, fontSize = 13.sp)
                }
            }
            Button(
                onClick = { onSubmitCheck(checklist.toMap()) },
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
            ) {
                Text("Sync Network Risk Assessment")
            }
        }

        uiState.networkHistory.take(5).forEach { h ->
            FortressCard {
                Text("${h.connectionType} (${h.wifiSecurityType}) — Risk ${h.riskScore}/100", color = SisColors.TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                if (h.warnings.isNotEmpty()) {
                    Text(h.warnings.joinToString(" "), color = SisColors.Warning, fontSize = 11.sp)
                }
            }
        }
    }
}

@Composable
fun VaultScreen(
    uiState: FortressUiState,
    isBiometricEnabled: Boolean,
    onUnlock: (String) -> Unit,
    onLock: () -> Unit,
    onAddVaultItem: (String, String, String) -> Unit,
    onDeleteVaultItem: (String) -> Unit
) {
    val context = LocalContext.current
    val activity = context as? FragmentActivity
    val hardwareBioAvailable = remember(activity) {
        activity != null && VaultCryptoManager.canUseBiometrics(activity)
    }
    var passphrase by remember { mutableStateOf("") }
    var bioVerified by remember(isBiometricEnabled, hardwareBioAvailable) {
        mutableStateOf(!isBiometricEnabled || !hardwareBioAvailable)
    }
    var bioError by remember { mutableStateOf<String?>(null) }

    var title by remember { mutableStateOf("") }
    var secret by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SisColors.BgPrimary)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text("SIS Vault Guardian", color = SisColors.TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        FortressCard {
            Text(
                "Client-side AES-256-GCM encryption + PBKDF2-SHA256. Zero plaintext ever leaves this Android device.",
                color = SisColors.TextSecondary,
                fontSize = 12.sp
            )
        }

        if (!uiState.vaultUnlocked) {
            if (!bioVerified && activity != null && VaultCryptoManager.canUseBiometrics(activity)) {
                FortressCard {
                    Text("Step 1: Biometric / Device Credential Gate", color = SisColors.Cyan, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(
                        onClick = {
                            VaultCryptoManager.promptBiometricUnlock(
                                activity = activity,
                                onSuccess = { bioVerified = true; bioError = null },
                                onError = { bioError = it }
                            )
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Fingerprint, contentDescription = null)
                        Text(" Verify Biometrics", modifier = Modifier.padding(start = 6.dp))
                    }
                    bioError?.let { Text(it, color = SisColors.Danger, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp)) }
                }
            }

            FortressCard {
                Text("Enter Vault PIN / Master Passphrase", color = SisColors.TextPrimary, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = passphrase,
                    onValueChange = { passphrase = it },
                    label = { Text("Master Passphrase (min 6 chars)") },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(10.dp))
                Button(
                    onClick = { onUnlock(passphrase) },
                    enabled = passphrase.length >= 6 && (bioVerified || !isBiometricEnabled),
                    modifier = Modifier.fillMaxWidth().height(48.dp)
                ) {
                    Icon(Icons.Default.Lock, contentDescription = null)
                    Text(" Unlock Vault", modifier = Modifier.padding(start = 6.dp))
                }
            }
        } else {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                StatusPill("ZERO-KNOWLEDGE UNLOCKED", SisColors.Success)
                OutlinedButton(onClick = onLock) { Text("Lock Vault") }
            }

            FortressCard {
                Text("Add Encrypted Credential / Note", color = SisColors.TextPrimary, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Title") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = secret, onValueChange = { secret = it }, label = { Text("Password / Secret Note") }, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(10.dp))
                Button(
                    onClick = {
                        onAddVaultItem("PASSWORD", title, secret)
                        title = ""
                        secret = ""
                    },
                    enabled = title.isNotBlank() && secret.isNotBlank(),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Encrypt & Save to Vault")
                }
            }

            uiState.vaultItems.forEach { item ->
                FortressCard {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(item.title, color = SisColors.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Text(item.secret, color = SisColors.Success, fontSize = 12.sp)
                        }
                        IconButton(onClick = { onDeleteVaultItem(item.id) }) {
                            Icon(Icons.Default.Delete, contentDescription = "Delete", tint = SisColors.Danger)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun BackupCenterScreen(
    uiState: FortressUiState,
    onCreateBackup: (String, String) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var content by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SisColors.BgPrimary)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text("SIS Cloud Backup Guardian", color = SisColors.TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)

        uiState.backups?.summary?.let { sum ->
            FortressCard {
                Text("Verified Backups: ${sum.verifiedCount} • Failed: ${sum.failedCount}", color = SisColors.TextPrimary, fontWeight = FontWeight.Bold)
                Text("Encrypted Footprint: ${sum.totalStorageBytes} bytes", color = SisColors.Cyan, fontSize = 12.sp)
            }
        }

        FortressCard {
            Text("Create Encrypted Backup Snapshot", color = SisColors.TextPrimary, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Backup Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(value = content, onValueChange = { content = it }, label = { Text("Data / Recovery Payload") }, modifier = Modifier.fillMaxWidth())
            Spacer(modifier = Modifier.height(10.dp))
            Button(
                onClick = {
                    onCreateBackup(name, content)
                    name = ""
                    content = ""
                },
                enabled = name.isNotBlank() && content.isNotBlank() && !uiState.loading,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Encrypt & Verify Backup")
            }
        }

        uiState.backups?.jobs?.forEach { job ->
            FortressCard {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(job.backupName, color = SisColors.TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    StatusPill(job.status, if (job.integrityVerified) SisColors.Success else SisColors.Warning)
                }
                Text("${job.encryptionAlgo} • ${job.totalBytes} B", color = SisColors.TextSecondary, fontSize = 12.sp)
                job.checksumSha256?.let {
                    Text("SHA-256: $it", color = SisColors.Cyan, fontSize = 10.sp)
                }
            }
        }
    }
}
