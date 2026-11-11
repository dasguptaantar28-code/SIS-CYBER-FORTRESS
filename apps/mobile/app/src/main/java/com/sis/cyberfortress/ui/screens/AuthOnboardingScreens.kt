package com.sis.cyberfortress.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sis.cyberfortress.BuildConfig
import com.sis.cyberfortress.R
import com.sis.cyberfortress.ui.theme.FortressCard
import com.sis.cyberfortress.ui.theme.SisColors
import com.sis.cyberfortress.ui.viewmodel.FortressUiState
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(
    uiState: FortressUiState,
    onNavigateOnboarding: () -> Unit,
    onNavigateLogin: () -> Unit,
    onNavigateDashboard: () -> Unit
) {
    LaunchedEffect(uiState.initialized, uiState.onboardingAccepted, uiState.isAuthenticated) {
        if (!uiState.initialized) return@LaunchedEffect
        delay(650)
        when {
            !uiState.onboardingAccepted -> onNavigateOnboarding()
            uiState.isAuthenticated -> onNavigateDashboard()
            else -> onNavigateLogin()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(listOf(SisColors.BgPrimary, SisColors.BgSecondary))
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Image(
                painter = painterResource(id = R.drawable.sis_fortress_logo),
                contentDescription = "SIS Cyber Fortress Logo",
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .size(128.dp)
                    .clip(RoundedCornerShape(28.dp))
                    .border(2.dp, SisColors.Cyan.copy(alpha = 0.6f), RoundedCornerShape(28.dp))
            )
            Spacer(modifier = Modifier.height(20.dp))
            Text(
                text = "SIS CYBER FORTRESS",
                color = SisColors.TextPrimary,
                fontSize = 24.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 1.5.sp
            )
            Text(
                text = "SECURE • MONITOR • PROTECT",
                color = SisColors.Cyan,
                fontSize = 11.sp,
                letterSpacing = 2.sp,
                modifier = Modifier.padding(top = 6.dp)
            )
            Spacer(modifier = Modifier.height(24.dp))
            CircularProgressIndicator(color = SisColors.Cyan, modifier = Modifier.size(28.dp))
        }
    }
}

@Composable
fun OnboardingScreen(onAcceptAndContinue: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SisColors.BgPrimary)
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Spacer(modifier = Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Image(
                painter = painterResource(id = R.drawable.sis_fortress_logo),
                contentDescription = "Logo",
                modifier = Modifier
                    .size(56.dp)
                    .clip(RoundedCornerShape(14.dp))
            )
            Column {
                Text("SIS Cyber Fortress", color = SisColors.TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text("12-in-1 Enterprise Cybersecurity", color = SisColors.Cyan, fontSize = 12.sp)
            }
        }

        FortressCard {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Icon(Icons.Default.VerifiedUser, contentDescription = null, tint = SisColors.Success)
                Text("Privacy & Transparency First", color = SisColors.TextPrimary, fontWeight = FontWeight.Bold)
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "We never perform covert monitoring, bypass Android OS permissions, or collect plaintext Vault passwords. Device posture & network checks operate strictly with your explicit consent.",
                color = SisColors.TextSecondary,
                fontSize = 13.sp,
                lineHeight = 19.sp
            )
        }

        FortressCard {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Icon(Icons.Default.Lock, contentDescription = null, tint = SisColors.Cyan)
                Text("Zero-Knowledge AES-256-GCM Vault", color = SisColors.TextPrimary, fontWeight = FontWeight.Bold)
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Session tokens are encrypted via Android Keystore (AES256-GCM). Vault secrets are encrypted locally before syncing—even Super Admins cannot view your plaintext vault.",
                color = SisColors.TextSecondary,
                fontSize = 13.sp,
                lineHeight = 19.sp
            )
        }

        FortressCard {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Icon(Icons.Default.Security, contentDescription = null, tint = SisColors.PrimaryBlue)
                Text("Runtime Permission Rationale", color = SisColors.TextPrimary, fontWeight = FontWeight.Bold)
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "• Internet & Network State: Sync security telemetry & phishing scans.\n• Biometrics: Optional unlock for Vault Guardian.\n• Location (Optional): Needed only if you choose to inspect Wi-Fi SSID/security in Network Sentinel.",
                color = SisColors.TextSecondary,
                fontSize = 13.sp,
                lineHeight = 20.sp
            )
        }

        Spacer(modifier = Modifier.height(8.dp))
        Button(
            onClick = onAcceptAndContinue,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = SisColors.PrimaryBlue)
        ) {
            Text("Accept Privacy Notice & Continue", fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun LoginScreen(
    uiState: FortressUiState,
    onLogin: (String, String) -> Unit,
    onUpdateServerUrl: (String) -> Unit,
    onNavigateRegister: () -> Unit
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var serverUrl by remember(uiState.apiBaseUrl) { mutableStateOf(uiState.apiBaseUrl) }
    var showServerEditor by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SisColors.BgPrimary)
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Image(
            painter = painterResource(id = R.drawable.sis_fortress_logo),
            contentDescription = "SIS Cyber Fortress",
            modifier = Modifier
                .size(84.dp)
                .clip(RoundedCornerShape(20.dp))
        )
        Spacer(modifier = Modifier.height(14.dp))
        Text("Sign In", color = SisColors.TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Text("Shared Enterprise Account (Android + Web)", color = SisColors.TextSecondary, fontSize = 12.sp)
        Spacer(modifier = Modifier.height(20.dp))

        if (uiState.errorMessage != null) {
            FortressCard(borderColor = SisColors.Danger, modifier = Modifier.fillMaxWidth()) {
                Text(uiState.errorMessage, color = SisColors.Danger, fontSize = 13.sp)
            }
            Spacer(modifier = Modifier.height(12.dp))
        }

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(12.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(18.dp))

        Button(
            onClick = { onLogin(email, password) },
            enabled = !uiState.loading && email.isNotBlank() && password.isNotBlank(),
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = SisColors.PrimaryBlue)
        ) {
            Text(if (uiState.loading) "Signing In..." else "Sign In", fontWeight = FontWeight.Bold)
        }

        TextButton(onClick = onNavigateRegister) {
            Text("Create a New Account", color = SisColors.Cyan)
        }

        if (BuildConfig.ALLOW_CUSTOM_API_URL) {
            TextButton(onClick = { showServerEditor = !showServerEditor }) {
                Text("Configure API Server URL", color = SisColors.TextSecondary, fontSize = 12.sp)
            }
            if (showServerEditor) {
                FortressCard(modifier = Modifier.fillMaxWidth()) {
                    Text("Backend REST Endpoint (Debug)", color = SisColors.Cyan, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = serverUrl,
                        onValueChange = { serverUrl = it },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedButton(onClick = { onUpdateServerUrl(serverUrl) }) {
                        Text("Save Endpoint")
                    }
                }
            }
        }
    }
}

@Composable
fun RegisterScreen(
    uiState: FortressUiState,
    onRegister: (String, String, String) -> Unit,
    onBackToLogin: () -> Unit
) {
    var fullName by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SisColors.BgPrimary)
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("Create Account", color = SisColors.TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Text("Minimum 10 chars with upper, lower, digit, and symbol.", color = SisColors.TextSecondary, fontSize = 12.sp, textAlign = TextAlign.Center)
        Spacer(modifier = Modifier.height(16.dp))

        if (uiState.errorMessage != null) {
            FortressCard(borderColor = SisColors.Danger, modifier = Modifier.fillMaxWidth()) {
                Text(uiState.errorMessage, color = SisColors.Danger, fontSize = 13.sp)
            }
            Spacer(modifier = Modifier.height(12.dp))
        }

        OutlinedTextField(value = fullName, onValueChange = { fullName = it }, label = { Text("Full Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(12.dp))
        OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Work Email") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(12.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Strong Password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(18.dp))

        Button(
            onClick = { onRegister(fullName, email, password) },
            enabled = !uiState.loading,
            modifier = Modifier.fillMaxWidth().height(50.dp),
            shape = RoundedCornerShape(14.dp)
        ) {
            Text(if (uiState.loading) "Creating..." else "Register Account")
        }
        TextButton(onClick = onBackToLogin) {
            Text("Already registered? Sign In", color = SisColors.Cyan)
        }
    }
}

@Composable
fun MfaVerificationScreen(
    uiState: FortressUiState,
    onVerify: (String) -> Unit
) {
    var code by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SisColors.BgPrimary)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("MFA Verification", color = SisColors.TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(8.dp))
        Text("Enter the 6-digit TOTP code from your authenticator app.", color = SisColors.TextSecondary, fontSize = 13.sp, textAlign = TextAlign.Center)
        Spacer(modifier = Modifier.height(20.dp))

        if (uiState.errorMessage != null) {
            FortressCard(borderColor = SisColors.Danger, modifier = Modifier.fillMaxWidth()) {
                Text(uiState.errorMessage, color = SisColors.Danger, fontSize = 13.sp)
            }
            Spacer(modifier = Modifier.height(12.dp))
        }

        OutlinedTextField(
            value = code,
            onValueChange = { if (it.length <= 6) code = it },
            label = { Text("6-Digit Code") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(16.dp))
        Button(
            onClick = { onVerify(code) },
            enabled = code.length == 6 && !uiState.loading,
            modifier = Modifier.fillMaxWidth().height(50.dp),
            shape = RoundedCornerShape(14.dp)
        ) {
            Text("Verify & Unlock")
        }
    }
}
