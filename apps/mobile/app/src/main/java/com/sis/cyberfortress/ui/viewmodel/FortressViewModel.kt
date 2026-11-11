package com.sis.cyberfortress.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.sis.cyberfortress.BuildConfig
import com.sis.cyberfortress.core.network.AssetDto
import com.sis.cyberfortress.core.network.AuthUserDto
import com.sis.cyberfortress.core.network.BackupEntryDto
import com.sis.cyberfortress.core.network.BackupsListResponseDto
import com.sis.cyberfortress.core.network.BreachPrefixRequestDto
import com.sis.cyberfortress.core.network.BreachPrefixResponseDto
import com.sis.cyberfortress.core.network.CreateBackupRequestDto
import com.sis.cyberfortress.core.network.DashboardOverviewDto
import com.sis.cyberfortress.core.network.DeviceDto
import com.sis.cyberfortress.core.network.IdentityOverviewDto
import com.sis.cyberfortress.core.network.LoginRequestDto
import com.sis.cyberfortress.core.network.MfaVerifyRequestDto
import com.sis.cyberfortress.core.network.ModuleItemDto
import com.sis.cyberfortress.core.network.NetworkAssessmentDto
import com.sis.cyberfortress.core.network.NetworkAssessmentRequestDto
import com.sis.cyberfortress.core.network.NetworkModule
import com.sis.cyberfortress.core.network.NotificationsResponseDto
import com.sis.cyberfortress.core.network.PhishingScanRequestDto
import com.sis.cyberfortress.core.network.RegisterDeviceRequestDto
import com.sis.cyberfortress.core.network.RegisterRequestDto
import com.sis.cyberfortress.core.network.ScanJobDto
import com.sis.cyberfortress.core.network.ScanResultDto
import com.sis.cyberfortress.core.network.SecurityAlertDto
import com.sis.cyberfortress.core.network.SisApiService
import com.sis.cyberfortress.core.network.ThreatIndicatorDto
import com.sis.cyberfortress.core.network.VaultRecordCreateDto
import com.sis.cyberfortress.core.network.VaultRecordDto
import com.sis.cyberfortress.core.network.WebShieldScanRequestDto
import com.sis.cyberfortress.core.security.DevicePostureScanner
import com.sis.cyberfortress.core.security.LocalDevicePosture
import com.sis.cyberfortress.core.security.LocalNetworkSnapshot
import com.sis.cyberfortress.core.security.SecurePrefsManager
import com.sis.cyberfortress.core.security.VaultCryptoManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.security.MessageDigest

data class DecryptedVaultUiItem(
    val id: String,
    val recordType: String,
    val title: String,
    val secret: String,
    val createdAt: String
)

data class FortressUiState(
    val initialized: Boolean = false,
    val onboardingAccepted: Boolean = false,
    val isAuthenticated: Boolean = false,
    val mfaChallengeToken: String? = null,
    val currentUser: AuthUserDto? = null,
    val apiBaseUrl: String = BuildConfig.DEFAULT_API_URL,
    val loading: Boolean = false,
    val errorMessage: String? = null,
    val infoMessage: String? = null,
    val dashboard: DashboardOverviewDto? = null,
    val modules: List<ModuleItemDto> = emptyList(),
    val localPosture: LocalDevicePosture? = null,
    val localNetwork: LocalNetworkSnapshot? = null,
    val devices: List<DeviceDto> = emptyList(),
    val phishingHistory: List<ScanJobDto> = emptyList(),
    val lastPhishingResult: ScanResultDto? = null,
    val assets: List<AssetDto> = emptyList(),
    val webShieldHistory: List<ScanJobDto> = emptyList(),
    val networkHistory: List<NetworkAssessmentDto> = emptyList(),
    val vaultUnlocked: Boolean = false,
    val vaultPassphrase: String = "",
    val vaultItems: List<DecryptedVaultUiItem> = emptyList(),
    val backups: BackupsListResponseDto? = null,
    val alerts: List<SecurityAlertDto> = emptyList(),
    val notifications: NotificationsResponseDto? = null,
    val threatIndicators: List<ThreatIndicatorDto> = emptyList(),
    val identityOverview: IdentityOverviewDto? = null,
    val lastBreachCheck: BreachPrefixResponseDto? = null
)

class FortressViewModel(application: Application) : AndroidViewModel(application) {
    private val prefs = SecurePrefsManager(application)
    private val scanner = DevicePostureScanner(application)
    private var api: SisApiService = NetworkModule.createApiService(prefs)

    private val _state = MutableStateFlow(
        FortressUiState(
            onboardingAccepted = prefs.isOnboardingAccepted(),
            apiBaseUrl = prefs.getApiBaseUrl()
        )
    )
    val state: StateFlow<FortressUiState> = _state.asStateFlow()

    init {
        bootstrapSession()
    }

    fun clearBanner() {
        _state.value = _state.value.copy(errorMessage = null, infoMessage = null)
    }

    private fun parseError(e: Exception, fallback: String = "Network or server error"): String {
        if (e is retrofit2.HttpException) {
            val raw = runCatching { e.response()?.errorBody()?.string() }.getOrNull()
            if (!raw.isNullOrBlank()) {
                val parsed = runCatching {
                    val obj = JSONObject(raw)
                    val msg = obj.opt("message")
                    when (msg) {
                        is org.json.JSONArray -> (0 until msg.length()).joinToString(", ") { msg.optString(it) }
                        else -> msg?.toString()
                    }
                }.getOrNull()
                if (!parsed.isNullOrBlank()) return parsed
            }
            return "Server returned HTTP ${e.code()}"
        }
        return e.localizedMessage ?: fallback
    }

    fun updateApiBaseUrl(url: String) {
        val ok = prefs.setApiBaseUrl(url)
        if (!ok) {
            _state.value = _state.value.copy(
                errorMessage = "Invalid API URL. Must start with http:// or https:// (e.g. http://10.0.2.2:4000/api/v1/)"
            )
            return
        }
        api = NetworkModule.createApiService(prefs)
        _state.value = _state.value.copy(
            apiBaseUrl = prefs.getApiBaseUrl(),
            errorMessage = null,
            infoMessage = "API endpoint set to ${prefs.getApiBaseUrl()}"
        )
    }

    fun acceptOnboarding() {
        prefs.setOnboardingAccepted(true)
        _state.value = _state.value.copy(onboardingAccepted = true)
    }

    fun bootstrapSession() {
        viewModelScope.launch {
            val localPosture = withContext(Dispatchers.Default) { scanner.scanDevicePosture() }
            val localNet = withContext(Dispatchers.Default) { scanner.inspectNetworkSnapshot() }

            val hasToken = !prefs.getAccessToken().isNullOrBlank()
            if (!hasToken) {
                _state.value = _state.value.copy(
                    initialized = true,
                    isAuthenticated = false,
                    localPosture = localPosture,
                    localNetwork = localNet
                )
                return@launch
            }

            try {
                val me = api.me()
                _state.value = _state.value.copy(
                    initialized = true,
                    isAuthenticated = true,
                    currentUser = me,
                    localPosture = localPosture,
                    localNetwork = localNet
                )
                refreshAllTelemetry()
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    initialized = true,
                    isAuthenticated = false,
                    localPosture = localPosture,
                    localNetwork = localNet
                )
            }
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, errorMessage = null)
            try {
                val deviceName = "${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL}"
                val res = api.login(
                    LoginRequestDto(
                        email = email.trim(),
                        password = password,
                        deviceName = deviceName
                    )
                )
                if (res.mfaRequired && res.challengeToken != null) {
                    _state.value = _state.value.copy(
                        loading = false,
                        mfaChallengeToken = res.challengeToken
                    )
                } else if (res.accessToken != null && res.refreshToken != null) {
                    prefs.saveTokens(res.accessToken, res.refreshToken)
                    prefs.saveUserEmail(email.trim())
                    _state.value = _state.value.copy(
                        loading = false,
                        isAuthenticated = true,
                        mfaChallengeToken = null,
                        currentUser = res.user
                    )
                    syncDevicePosture()
                    refreshAllTelemetry()
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    loading = false,
                    errorMessage = parseError(e, "Login failed. Verify server URL & credentials.")
                )
            }
        }
    }

    fun register(fullName: String, email: String, password: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, errorMessage = null)
            try {
                val deviceName = "${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL}"
                val res = api.register(
                    RegisterRequestDto(
                        fullName = fullName.trim(),
                        email = email.trim(),
                        password = password,
                        deviceName = deviceName
                    )
                )
                if (res.accessToken != null && res.refreshToken != null) {
                    prefs.saveTokens(res.accessToken, res.refreshToken)
                    prefs.saveUserEmail(email.trim())
                    _state.value = _state.value.copy(
                        loading = false,
                        isAuthenticated = true,
                        currentUser = res.user
                    )
                    syncDevicePosture()
                    refreshAllTelemetry()
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    loading = false,
                    errorMessage = parseError(e, "Registration failed.")
                )
            }
        }
    }

    fun verifyMfa(code: String) {
        val token = _state.value.mfaChallengeToken ?: return
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, errorMessage = null)
            try {
                val deviceName = "${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL}"
                val res = api.verifyMfa(
                    MfaVerifyRequestDto(
                        challengeToken = token,
                        code = code.trim(),
                        deviceName = deviceName
                    )
                )
                if (res.accessToken != null && res.refreshToken != null) {
                    prefs.saveTokens(res.accessToken, res.refreshToken)
                    _state.value = _state.value.copy(
                        loading = false,
                        isAuthenticated = true,
                        mfaChallengeToken = null,
                        currentUser = res.user
                    )
                    syncDevicePosture()
                    refreshAllTelemetry()
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    loading = false,
                    errorMessage = parseError(e, "Invalid TOTP verification code.")
                )
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            runCatching { api.logout() }
            prefs.clearSession()
            _state.value = FortressUiState(
                initialized = true,
                onboardingAccepted = prefs.isOnboardingAccepted(),
                apiBaseUrl = prefs.getApiBaseUrl(),
                localPosture = _state.value.localPosture,
                localNetwork = _state.value.localNetwork
            )
        }
    }

    fun refreshAllTelemetry() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, errorMessage = null)
            try {
                val posture = withContext(Dispatchers.Default) { scanner.scanDevicePosture() }
                val net = withContext(Dispatchers.Default) { scanner.inspectNetworkSnapshot() }

                val dashboard = api.dashboardOverview()
                val devices = api.listDevices()
                val alerts = api.listAlerts()
                val notifs = api.listNotifications()
                val phishing = api.listScans("PHISHING_SHIELD")
                val webScans = api.listScans("WEBSHIELD")
                val assets = runCatching { api.listAssets() }.getOrDefault(emptyList())
                val backups = runCatching { api.listBackups() }.getOrNull()
                val netHistory = runCatching { api.listNetworkAssessments() }.getOrDefault(emptyList())
                val iocs = runCatching { api.listIndicators() }.getOrDefault(emptyList())
                val identity = runCatching { api.identityOverview() }.getOrNull()

                _state.value = _state.value.copy(
                    loading = false,
                    localPosture = posture,
                    localNetwork = net,
                    dashboard = dashboard,
                    modules = dashboard.modules,
                    devices = devices,
                    alerts = alerts,
                    notifications = notifs,
                    phishingHistory = phishing,
                    webShieldHistory = webScans,
                    assets = assets,
                    backups = backups,
                    networkHistory = netHistory,
                    threatIndicators = iocs,
                    identityOverview = identity
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    loading = false,
                    errorMessage = parseError(e, "Unable to sync with backend API.")
                )
            }
        }
    }

    fun syncDevicePosture() {
        viewModelScope.launch {
            try {
                val posture = withContext(Dispatchers.Default) { scanner.scanDevicePosture() }
                api.registerDevice(
                    RegisterDeviceRequestDto(
                        deviceName = posture.deviceName,
                        manufacturer = posture.manufacturer,
                        model = posture.model,
                        osVersion = posture.osVersion,
                        securityPatchLevel = posture.securityPatchLevel,
                        appVersion = BuildConfig.VERSION_NAME,
                        deviceIdentifier = prefs.getOrCreateDeviceIdentifier(),
                        isRootedOrCompromised = posture.isRootedOrCompromised,
                        screenLockEnabled = posture.screenLockEnabled,
                        biometricSupported = posture.biometricSupported,
                        encryptionEnabled = posture.encryptionEnabled,
                        installedAppCount = posture.installedAppCount,
                        highRiskPermissionCount = posture.highRiskPermissionCount,
                        postureDetails = mapOf("policyDisclosure" to posture.policyDisclosure)
                    )
                )
                val updatedDevices = api.listDevices()
                _state.value = _state.value.copy(
                    localPosture = posture,
                    devices = updatedDevices,
                    infoMessage = "Device posture synced to Endpoint Guardian."
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(errorMessage = parseError(e, "Device sync failed."))
            }
        }
    }

    fun scanPhishingUrl(url: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, errorMessage = null)
            try {
                val result = api.scanPhishing(PhishingScanRequestDto(url.trim()))
                val history = api.listScans("PHISHING_SHIELD")
                _state.value = _state.value.copy(
                    loading = false,
                    lastPhishingResult = result,
                    phishingHistory = history,
                    infoMessage = "Phishing scan completed: ${result.riskLevel}"
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(loading = false, errorMessage = parseError(e))
            }
        }
    }

    fun runWebShieldScan(assetId: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, errorMessage = null)
            try {
                val res = api.scanWebShield(WebShieldScanRequestDto(assetId))
                val history = api.listScans("WEBSHIELD")
                _state.value = _state.value.copy(
                    loading = false,
                    webShieldHistory = history,
                    infoMessage = "WebShield scan completed: ${res.riskLevel}"
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(loading = false, errorMessage = parseError(e))
            }
        }
    }

    fun submitNetworkCheck(checklist: Map<String, Boolean>) {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, errorMessage = null)
            try {
                val net = withContext(Dispatchers.Default) { scanner.inspectNetworkSnapshot() }
                api.submitNetworkAssessment(
                    NetworkAssessmentRequestDto(
                        connectionType = net.connectionType,
                        transportLabel = net.transportLabel,
                        isVpnActive = net.isVpnActive,
                        isMetered = net.isMetered,
                        wifiSecurityType = net.wifiSecurityType,
                        ssidVisibilityNote = net.ssidVisibilityNote,
                        checklistState = checklist
                    )
                )
                val history = api.listNetworkAssessments()
                _state.value = _state.value.copy(
                    loading = false,
                    localNetwork = net,
                    networkHistory = history,
                    infoMessage = "Network security assessment saved."
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(loading = false, errorMessage = parseError(e))
            }
        }
    }

    fun unlockVault(passphrase: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, errorMessage = null)
            try {
                val records = api.listVaultRecords()
                val decrypted = withContext(Dispatchers.Default) {
                    records.map { r ->
                        try {
                            val (title, bodyJson) = VaultCryptoManager.decrypt(
                                passphrase = passphrase,
                                encryptedTitleJson = r.encryptedTitle,
                                ciphertextB64 = r.ciphertext,
                                ivB64 = r.iv,
                                authTagB64 = r.authTag,
                                saltB64 = r.salt
                            )
                            val secret = JSONObject(bodyJson).optString("secret", bodyJson)
                            DecryptedVaultUiItem(r.id, r.recordType, title, secret, r.createdAt)
                        } catch (_: Exception) {
                            DecryptedVaultUiItem(
                                r.id,
                                r.recordType,
                                "Locked Item",
                                "(Encrypted with a different Master Passphrase)",
                                r.createdAt
                            )
                        }
                    }
                }
                _state.value = _state.value.copy(
                    loading = false,
                    vaultUnlocked = true,
                    vaultPassphrase = passphrase,
                    vaultItems = decrypted
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(loading = false, errorMessage = parseError(e))
            }
        }
    }

    fun lockVault() {
        _state.value = _state.value.copy(
            vaultUnlocked = false,
            vaultPassphrase = "",
            vaultItems = emptyList()
        )
    }

    fun addVaultItem(recordType: String, title: String, secret: String) {
        val pass = _state.value.vaultPassphrase
        if (pass.isBlank()) return
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, errorMessage = null)
            try {
                val encrypted = withContext(Dispatchers.Default) {
                    val body = JSONObject().apply { put("secret", secret) }.toString()
                    VaultCryptoManager.encrypt(pass, title, body)
                }
                api.createVaultRecord(
                    VaultRecordCreateDto(
                        recordType = recordType,
                        encryptedTitle = encrypted.encryptedTitle,
                        ciphertext = encrypted.ciphertext,
                        iv = encrypted.iv,
                        authTag = encrypted.authTag,
                        salt = encrypted.salt,
                        kdfAlgorithm = encrypted.kdfAlgorithm,
                        kdfIterations = encrypted.kdfIterations
                    )
                )
                unlockVault(pass)
                _state.value = _state.value.copy(infoMessage = "Encrypted item saved to Vault Guardian.")
            } catch (e: Exception) {
                _state.value = _state.value.copy(loading = false, errorMessage = parseError(e))
            }
        }
    }

    fun deleteVaultItem(id: String) {
        val pass = _state.value.vaultPassphrase
        viewModelScope.launch {
            runCatching { api.deleteVaultRecord(id) }
            if (pass.isNotBlank()) unlockVault(pass)
        }
    }

    fun createBackup(name: String, content: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, errorMessage = null)
            try {
                api.createBackup(
                    CreateBackupRequestDto(
                        backupName = name.trim(),
                        entries = listOf(BackupEntryDto("mobile/recovery-note.txt", content))
                    )
                )
                val list = api.listBackups()
                _state.value = _state.value.copy(
                    loading = false,
                    backups = list,
                    infoMessage = "Backup encrypted & verified via SHA-256."
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(loading = false, errorMessage = parseError(e))
            }
        }
    }

    fun checkBreachPrefixLocal(candidatePassword: String) {
        viewModelScope.launch {
            try {
                val prefix = withContext(Dispatchers.Default) {
                    val digest = MessageDigest.getInstance("SHA-1")
                        .digest(candidatePassword.toByteArray(Charsets.UTF_8))
                    digest.joinToString("") { "%02X".format(it) }.take(5)
                }
                val res = api.checkBreachPrefix(BreachPrefixRequestDto(prefix))
                _state.value = _state.value.copy(lastBreachCheck = res)
            } catch (e: Exception) {
                _state.value = _state.value.copy(errorMessage = parseError(e))
            }
        }
    }

    fun markNotificationRead(id: String) {
        viewModelScope.launch {
            runCatching { api.markNotificationRead(id) }
            runCatching { api.listNotifications() }.onSuccess { res ->
                _state.value = _state.value.copy(notifications = res)
            }
        }
    }

    fun isBiometricEnabled(): Boolean = prefs.isBiometricVaultEnabled()
    fun setBiometricEnabled(enabled: Boolean) = prefs.setBiometricVaultEnabled(enabled)
}
