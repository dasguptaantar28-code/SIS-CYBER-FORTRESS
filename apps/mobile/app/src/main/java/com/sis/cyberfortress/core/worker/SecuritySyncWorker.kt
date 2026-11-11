package com.sis.cyberfortress.core.worker

import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.sis.cyberfortress.BuildConfig
import com.sis.cyberfortress.R
import com.sis.cyberfortress.core.network.NetworkModule
import com.sis.cyberfortress.core.network.RegisterDeviceRequestDto
import com.sis.cyberfortress.core.security.DevicePostureScanner
import com.sis.cyberfortress.core.security.SecurePrefsManager

class SecuritySyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val prefs = SecurePrefsManager(applicationContext)
        if (prefs.getAccessToken().isNullOrBlank()) return Result.success()

        return try {
            val api = NetworkModule.createApiService(prefs)
            val scanner = DevicePostureScanner(applicationContext)
            val posture = scanner.scanDevicePosture()

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

            val notifs = api.listNotifications()
            if (notifs.unreadCount > 0) {
                showLocalSecurityNotice(
                    "SIS Cyber Fortress Alerts",
                    "You have ${notifs.unreadCount} unread security notification(s)."
                )
            }
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }

    private fun showLocalSecurityNotice(title: String, message: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                applicationContext,
                android.Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) return
        }
        val mgr = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notice = NotificationCompat.Builder(applicationContext, "sis_security_alerts")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()
        mgr.notify(1001, notice)
    }
}
