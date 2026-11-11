package com.sis.cyberfortress.ui.navigation

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.sis.cyberfortress.ui.screens.ActivityHistoryScreen
import com.sis.cyberfortress.ui.screens.BackupCenterScreen
import com.sis.cyberfortress.ui.screens.DashboardScreen
import com.sis.cyberfortress.ui.screens.DeviceSecurityScreen
import com.sis.cyberfortress.ui.screens.HelpSupportScreen
import com.sis.cyberfortress.ui.screens.LoginScreen
import com.sis.cyberfortress.ui.screens.MfaVerificationScreen
import com.sis.cyberfortress.ui.screens.ModuleDetailScreen
import com.sis.cyberfortress.ui.screens.ModulesHubScreen
import com.sis.cyberfortress.ui.screens.NetworkSecurityScreen
import com.sis.cyberfortress.ui.screens.NotificationsScreen
import com.sis.cyberfortress.ui.screens.OnboardingScreen
import com.sis.cyberfortress.ui.screens.PhishingScannerScreen
import com.sis.cyberfortress.ui.screens.ProfileScreen
import com.sis.cyberfortress.ui.screens.RegisterScreen
import com.sis.cyberfortress.ui.screens.SettingsScreen
import com.sis.cyberfortress.ui.screens.SplashScreen
import com.sis.cyberfortress.ui.screens.VaultScreen
import com.sis.cyberfortress.ui.theme.SisColors
import com.sis.cyberfortress.ui.viewmodel.FortressViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SisNavGraph(viewModel: FortressViewModel) {
    val navController = rememberNavController()
    val uiState by viewModel.state.collectAsState()
    val backStack by navController.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route

    val topLevelRoutes = setOf("dashboard", "modules", "vault", "phishing", "profile")
    val showBottomBar = uiState.isAuthenticated && currentRoute in topLevelRoutes
    val subScreenTitles = mapOf(
        "module/{slug}" to "Security Module",
        "device_security" to "Device Security",
        "network_security" to "Network Sentinel",
        "backup_center" to "Backup Center",
        "notifications" to "Notifications",
        "activity_history" to "Activity History",
        "settings" to "Settings",
        "help" to "Help & Disclosures"
    )
    val subTitle = subScreenTitles[currentRoute]

    Scaffold(
        containerColor = SisColors.BgPrimary,
        topBar = {
            if (uiState.isAuthenticated && subTitle != null) {
                TopAppBar(
                    title = { Text(subTitle, color = SisColors.TextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold) },
                    navigationIcon = {
                        IconButton(onClick = { navController.popBackStack() }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = SisColors.Cyan)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = SisColors.BgSecondary)
                )
            }
        },
        bottomBar = {
            if (showBottomBar) {
                NavigationBar(containerColor = SisColors.BgSecondary) {
                    val navItems = listOf(
                        Triple("dashboard", "Home", Icons.Default.Dashboard),
                        Triple("modules", "Modules", Icons.Default.Shield),
                        Triple("phishing", "Scan", Icons.Default.Security),
                        Triple("vault", "Vault", Icons.Default.Lock),
                        Triple("profile", "Profile", Icons.Default.Person)
                    )
                    navItems.forEach { (route, label, icon) ->
                        NavigationBarItem(
                            selected = currentRoute == route,
                            onClick = {
                                navController.navigate(route) {
                                    launchSingleTop = true
                                }
                            },
                            icon = { Icon(icon, contentDescription = label) },
                            label = { Text(label) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = SisColors.Cyan,
                                selectedTextColor = SisColors.Cyan,
                                unselectedIconColor = SisColors.TextSecondary,
                                unselectedTextColor = SisColors.TextSecondary,
                                indicatorColor = SisColors.CardBg
                            )
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        Column(modifier = Modifier.padding(innerPadding)) {
            if (uiState.isAuthenticated && (uiState.errorMessage != null || uiState.infoMessage != null)) {
                val isErr = uiState.errorMessage != null
                val bannerColor = if (isErr) SisColors.Danger else SisColors.Success
                Surface(
                    color = bannerColor.copy(alpha = 0.16f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = uiState.errorMessage ?: uiState.infoMessage.orEmpty(),
                            color = bannerColor,
                            fontSize = 12.sp,
                            modifier = Modifier.weight(1f)
                        )
                        IconButton(onClick = { viewModel.clearBanner() }) {
                            Icon(Icons.Default.Close, contentDescription = "Dismiss", tint = bannerColor)
                        }
                    }
                }
            }

            NavHost(
                navController = navController,
                startDestination = "splash"
            ) {
                composable("splash") {
                    SplashScreen(
                        uiState = uiState,
                        onNavigateOnboarding = {
                            navController.navigate("onboarding") { popUpTo("splash") { inclusive = true } }
                        },
                        onNavigateLogin = {
                            navController.navigate("login") { popUpTo("splash") { inclusive = true } }
                        },
                        onNavigateDashboard = {
                            navController.navigate("dashboard") { popUpTo("splash") { inclusive = true } }
                        }
                    )
                }

                composable("onboarding") {
                    OnboardingScreen(
                        onAcceptAndContinue = {
                            viewModel.acceptOnboarding()
                            navController.navigate("login") { popUpTo("onboarding") { inclusive = true } }
                        }
                    )
                }

                composable("login") {
                    LaunchedEffect(uiState.isAuthenticated, uiState.mfaChallengeToken) {
                        if (uiState.isAuthenticated) {
                            navController.navigate("dashboard") { popUpTo("login") { inclusive = true } }
                        } else if (uiState.mfaChallengeToken != null) {
                            navController.navigate("mfa")
                        }
                    }
                    LoginScreen(
                        uiState = uiState,
                        onLogin = { email, pw -> viewModel.login(email, pw) },
                        onUpdateServerUrl = { viewModel.updateApiBaseUrl(it) },
                        onNavigateRegister = { navController.navigate("register") }
                    )
                }

                composable("register") {
                    LaunchedEffect(uiState.isAuthenticated) {
                        if (uiState.isAuthenticated) {
                            navController.navigate("dashboard") { popUpTo("register") { inclusive = true } }
                        }
                    }
                    RegisterScreen(
                        uiState = uiState,
                        onRegister = { name, email, pw -> viewModel.register(name, email, pw) },
                        onBackToLogin = { navController.popBackStack() }
                    )
                }

                composable("mfa") {
                    LaunchedEffect(uiState.isAuthenticated) {
                        if (uiState.isAuthenticated) {
                            navController.navigate("dashboard") { popUpTo("login") { inclusive = true } }
                        }
                    }
                    MfaVerificationScreen(
                        uiState = uiState,
                        onVerify = { code -> viewModel.verifyMfa(code) }
                    )
                }

                composable("dashboard") {
                    DashboardScreen(
                        uiState = uiState,
                        onRefresh = { viewModel.refreshAllTelemetry() },
                        onNavigate = { route -> navController.navigate(route) }
                    )
                }

                composable("modules") {
                    ModulesHubScreen(
                        uiState = uiState,
                        onOpenModule = { slug -> navController.navigate("module/$slug") }
                    )
                }

                composable(
                    route = "module/{slug}",
                    arguments = listOf(navArgument("slug") { type = NavType.StringType })
                ) { entry ->
                    val slug = entry.arguments?.getString("slug") ?: "cyber-soc"
                    ModuleDetailScreen(
                        slug = slug,
                        uiState = uiState,
                        onNavigate = { navController.navigate(it) },
                        onRunWebShieldScan = { viewModel.runWebShieldScan(it) },
                        onCheckBreachPrefix = { viewModel.checkBreachPrefixLocal(it) }
                    )
                }

                composable("device_security") {
                    DeviceSecurityScreen(uiState = uiState, onSyncDevice = { viewModel.syncDevicePosture() })
                }

                composable("phishing") {
                    PhishingScannerScreen(uiState = uiState, onScanUrl = { viewModel.scanPhishingUrl(it) })
                }

                composable("network_security") {
                    NetworkSecurityScreen(uiState = uiState, onSubmitCheck = { viewModel.submitNetworkCheck(it) })
                }

                composable("vault") {
                    VaultScreen(
                        uiState = uiState,
                        isBiometricEnabled = viewModel.isBiometricEnabled(),
                        onUnlock = { viewModel.unlockVault(it) },
                        onLock = { viewModel.lockVault() },
                        onAddVaultItem = { type, t, s -> viewModel.addVaultItem(type, t, s) },
                        onDeleteVaultItem = { viewModel.deleteVaultItem(it) }
                    )
                }

                composable("backup_center") {
                    BackupCenterScreen(uiState = uiState, onCreateBackup = { n, c -> viewModel.createBackup(n, c) })
                }

                composable("notifications") {
                    NotificationsScreen(uiState = uiState, onMarkRead = { viewModel.markNotificationRead(it) })
                }

                composable("activity_history") {
                    ActivityHistoryScreen(uiState = uiState)
                }

                composable("profile") {
                    ProfileScreen(
                        uiState = uiState,
                        onNavigate = { navController.navigate(it) },
                        onLogout = {
                            viewModel.logout()
                            navController.navigate("login") { popUpTo("dashboard") { inclusive = true } }
                        }
                    )
                }

                composable("settings") {
                    var bioEnabled by remember { mutableStateOf(viewModel.isBiometricEnabled()) }
                    SettingsScreen(
                        uiState = uiState,
                        biometricEnabled = bioEnabled,
                        onToggleBiometric = {
                            bioEnabled = it
                            viewModel.setBiometricEnabled(it)
                        },
                        onUpdateServerUrl = { viewModel.updateApiBaseUrl(it) }
                    )
                }

                composable("help") {
                    HelpSupportScreen()
                }
            }
        }
    }
}
