package com.sis.cyberfortress.core.security

import android.Manifest
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiInfo
import android.net.wifi.WifiManager
import android.os.Build
import androidx.biometric.BiometricManager
import androidx.core.content.ContextCompat
import java.io.File

data class InstalledAppSummary(
    val appName: String,
    val packageName: String,
    val sensitivePermissions: List<String>
)

data class LocalDevicePosture(
    val deviceName: String,
    val manufacturer: String,
    val model: String,
    val osVersion: String,
    val securityPatchLevel: String,
    val screenLockEnabled: Boolean,
    val biometricSupported: Boolean,
    val encryptionEnabled: Boolean,
    val isRootedOrCompromised: Boolean,
    val installedAppCount: Int,
    val highRiskPermissionCount: Int,
    val visibleApps: List<InstalledAppSummary>,
    val policyDisclosure: String
)

data class LocalNetworkSnapshot(
    val connectionType: String,
    val transportLabel: String,
    val isVpnActive: Boolean,
    val isMetered: Boolean,
    val wifiSecurityType: String,
    val ssidVisibilityNote: String,
    val isOpenOrUnsafe: Boolean
)

class DevicePostureScanner(private val context: Context) {

    fun scanDevicePosture(): LocalDevicePosture {
        val keyguard = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        val screenLockEnabled = keyguard.isDeviceSecure

        val bioResult = BiometricManager.from(context).canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG or
                BiometricManager.Authenticators.BIOMETRIC_WEAK
        )
        val biometricSupported = bioResult == BiometricManager.BIOMETRIC_SUCCESS

        // Android 10+ enforces file-based or full-disk encryption by CDD; API 26+ check
        val encryptionEnabled = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q || screenLockEnabled

        val rootIndicators = listOf(
            "/system/app/Superuser.apk",
            "/sbin/su",
            "/system/bin/su",
            "/system/xbin/su"
        ).any { File(it).exists() } || (Build.TAGS?.contains("test-keys") == true)

        val pm = context.packageManager
        val launcherIntent = Intent(Intent.ACTION_MAIN, null).addCategory(Intent.CATEGORY_LAUNCHER)
        val resolveList = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            pm.queryIntentActivities(launcherIntent, PackageManager.ResolveInfoFlags.of(0))
        } else {
            @Suppress("DEPRECATION")
            pm.queryIntentActivities(launcherIntent, 0)
        }

        val sensitiveSet = setOf(
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.READ_SMS
        )

        val appSummaries = mutableListOf<InstalledAppSummary>()
        var highRiskCount = 0
        val seenPackages = mutableSetOf<String>()

        for (ri in resolveList) {
            val pkgName = ri.activityInfo?.packageName ?: continue
            if (!seenPackages.add(pkgName)) continue
            try {
                val pkgInfo: PackageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    pm.getPackageInfo(
                        pkgName,
                        PackageManager.PackageInfoFlags.of(PackageManager.GET_PERMISSIONS.toLong())
                    )
                } else {
                    @Suppress("DEPRECATION")
                    pm.getPackageInfo(pkgName, PackageManager.GET_PERMISSIONS)
                }
                val isSystem = (pkgInfo.applicationInfo?.flags ?: 0) and ApplicationInfo.FLAG_SYSTEM != 0
                if (isSystem) continue

                val label = pkgInfo.applicationInfo?.loadLabel(pm)?.toString() ?: pkgName
                val requested = pkgInfo.requestedPermissions?.filter { it in sensitiveSet } ?: emptyList()
                if (requested.size >= 3) highRiskCount += 1

                appSummaries.add(
                    InstalledAppSummary(
                        appName = label,
                        packageName = pkgName,
                        sensitivePermissions = requested.map { it.substringAfterLast('.') }
                    )
                )
            } catch (_: Exception) {
                // Respect OS visibility restriction silently
            }
        }

        val patch = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Build.VERSION.SECURITY_PATCH
        } else {
            "Unavailable on API < 23"
        }

        return LocalDevicePosture(
            deviceName = "${Build.MANUFACTURER} ${Build.MODEL}",
            manufacturer = Build.MANUFACTURER,
            model = Build.MODEL,
            osVersion = "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})",
            securityPatchLevel = patch,
            screenLockEnabled = screenLockEnabled,
            biometricSupported = biometricSupported,
            encryptionEnabled = encryptionEnabled,
            isRootedOrCompromised = rootIndicators,
            installedAppCount = appSummaries.size,
            highRiskPermissionCount = highRiskCount,
            visibleApps = appSummaries.sortedByDescending { it.sensitivePermissions.size }.take(25),
            policyDisclosure = "Lists only non-system launcher apps permitted by Android 11+ <queries> visibility policy."
        )
    }

    fun inspectNetworkSnapshot(): LocalNetworkSnapshot {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val activeNetwork = cm.activeNetwork
        val caps = if (activeNetwork != null) cm.getNetworkCapabilities(activeNetwork) else null

        if (caps == null) {
            return LocalNetworkSnapshot(
                connectionType = "OFFLINE",
                transportLabel = "No Active Network",
                isVpnActive = false,
                isMetered = false,
                wifiSecurityType = "NONE",
                ssidVisibilityNote = "Device appears offline.",
                isOpenOrUnsafe = false
            )
        }

        val isWifi = caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
        val isCellular = caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
        val isVpn = caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
        val isMetered = !caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)

        val connectionType = when {
            isWifi -> "WIFI"
            isCellular -> "CELLULAR"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ETHERNET"
            else -> "OTHER"
        }

        var wifiSecurity = if (isWifi) "UNKNOWN" else "NOT_WIFI"
        var ssidNote = "Network details checked via ConnectivityManager."
        var isOpen = false

        if (isWifi) {
            val hasLocation = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

            if (!hasLocation) {
                ssidNote =
                    "Wi-Fi SSID and security cipher are hidden by Android OS until Location permission is granted."
            } else {
                val transportInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    caps.transportInfo as? WifiInfo
                } else {
                    null
                }
                val wifiMgr = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
                @Suppress("DEPRECATION")
                val info = transportInfo ?: wifiMgr.connectionInfo
                val ssid = info?.ssid?.replace("\"", "") ?: "<unknown>"

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && info != null) {
                    wifiSecurity = when (info.currentSecurityType) {
                        WifiInfo.SECURITY_TYPE_OPEN -> {
                            isOpen = true
                            "OPEN"
                        }
                        WifiInfo.SECURITY_TYPE_WEP -> {
                            isOpen = true
                            "WEP"
                        }
                        WifiInfo.SECURITY_TYPE_PSK -> "WPA2_PSK"
                        WifiInfo.SECURITY_TYPE_SAE -> "WPA3_SAE"
                        WifiInfo.SECURITY_TYPE_EAP, WifiInfo.SECURITY_TYPE_EAP_WPA3_ENTERPRISE -> "WPA_ENTERPRISE"
                        else -> "PROTECTED_OR_UNKNOWN"
                    }
                } else {
                    wifiSecurity = "SECURITY_TYPE_UNAVAILABLE_ON_API_${Build.VERSION.SDK_INT}"
                }
                ssidNote = "Connected SSID: $ssid (OS Location permission granted)."
            }
        }

        return LocalNetworkSnapshot(
            connectionType = connectionType,
            transportLabel = "$connectionType${if (isVpn) " + VPN" else ""}",
            isVpnActive = isVpn,
            isMetered = isMetered,
            wifiSecurityType = wifiSecurity,
            ssidVisibilityNote = ssidNote,
            isOpenOrUnsafe = isOpen
        )
    }
}
