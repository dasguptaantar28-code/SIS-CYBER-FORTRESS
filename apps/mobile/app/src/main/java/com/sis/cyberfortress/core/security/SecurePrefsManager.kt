package com.sis.cyberfortress.core.security

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.sis.cyberfortress.BuildConfig
import java.util.UUID

class SecurePrefsManager(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "sis_fortress_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun getAccessToken(): String? = prefs.getString("access_token", null)
    fun getRefreshToken(): String? = prefs.getString("refresh_token", null)

    fun saveTokens(accessToken: String, refreshToken: String) {
        prefs.edit()
            .putString("access_token", accessToken)
            .putString("refresh_token", refreshToken)
            .apply()
    }

    fun clearSession() {
        prefs.edit()
            .remove("access_token")
            .remove("refresh_token")
            .remove("user_email")
            .apply()
    }

    fun saveUserEmail(email: String) {
        prefs.edit().putString("user_email", email).apply()
    }

    fun getUserEmail(): String? = prefs.getString("user_email", null)

    fun isOnboardingAccepted(): Boolean = prefs.getBoolean("onboarding_accepted", false)
    fun setOnboardingAccepted(accepted: Boolean) {
        prefs.edit().putBoolean("onboarding_accepted", accepted).apply()
    }

    fun isBiometricVaultEnabled(): Boolean = prefs.getBoolean("biometric_vault", true)
    fun setBiometricVaultEnabled(enabled: Boolean) {
        prefs.edit().putBoolean("biometric_vault", enabled).apply()
    }

    fun getOrCreateDeviceIdentifier(): String {
        val existing = prefs.getString("device_uuid", null)
        if (existing != null) return existing
        val created = "android-${UUID.randomUUID()}"
        prefs.edit().putString("device_uuid", created).apply()
        return created
    }

    fun getApiBaseUrl(): String {
        if (!BuildConfig.ALLOW_CUSTOM_API_URL) return BuildConfig.DEFAULT_API_URL
        return prefs.getString("api_base_url", BuildConfig.DEFAULT_API_URL)
            ?: BuildConfig.DEFAULT_API_URL
    }

    fun setApiBaseUrl(url: String): Boolean {
        if (!BuildConfig.ALLOW_CUSTOM_API_URL) return false
        val trimmed = url.trim()
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            return false
        }
        val normalized = if (trimmed.endsWith("/")) trimmed else "$trimmed/"
        return try {
            java.net.URI(normalized).toURL()
            prefs.edit().putString("api_base_url", normalized).apply()
            true
        } catch (_: Exception) {
            false
        }
    }
}
