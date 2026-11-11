package com.sis.cyberfortress

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.sis.cyberfortress.core.worker.SecuritySyncWorker
import java.util.concurrent.TimeUnit

class SisFortressApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
        scheduleBackgroundSync()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "sis_security_alerts",
                "SIS Security Alerts & Backup Notices",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Alerts from SIS Cyber Fortress SOC, Phishing Shield, and Cloud Backup."
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun scheduleBackgroundSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
        val request = PeriodicWorkRequestBuilder<SecuritySyncWorker>(6, TimeUnit.HOURS)
            .setConstraints(constraints)
            .build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "sis_posture_sync",
            ExistingPeriodicWorkPolicy.KEEP,
            request
        )
    }
}
