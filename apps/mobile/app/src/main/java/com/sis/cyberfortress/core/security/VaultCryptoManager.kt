package com.sis.cyberfortress.core.security

import android.util.Base64
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import org.json.JSONObject
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/**
 * Zero-Knowledge Client-Side Cryptography for Module 05 (SIS Vault Guardian).
 * Interoperable with Web Crypto API implementation (PBKDF2-SHA256 600,000 rounds + AES-256-GCM).
 */
object VaultCryptoManager {
    private const val KDF_ITERATIONS = 600_000
    private const val KEY_LENGTH_BITS = 256
    private const val GCM_TAG_BITS = 128

    data class EncryptedVaultBlob(
        val encryptedTitle: String,
        val ciphertext: String,
        val iv: String,
        val authTag: String,
        val salt: String,
        val kdfAlgorithm: String = "PBKDF2-SHA256",
        val kdfIterations: Int = KDF_ITERATIONS
    )

    private fun deriveKey(passphrase: String, salt: ByteArray): SecretKeySpec {
        val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        val spec = PBEKeySpec(passphrase.toCharArray(), salt, KDF_ITERATIONS, KEY_LENGTH_BITS)
        val secretBytes = factory.generateSecret(spec).encoded
        return SecretKeySpec(secretBytes, "AES")
    }

    fun encrypt(passphrase: String, title: String, payloadJson: String): EncryptedVaultBlob {
        val rng = SecureRandom()
        val salt = ByteArray(16).also { rng.nextBytes(it) }
        val titleIv = ByteArray(12).also { rng.nextBytes(it) }
        val bodyIv = ByteArray(12).also { rng.nextBytes(it) }

        val key = deriveKey(passphrase, salt)

        val titleCipher = Cipher.getInstance("AES/GCM/NoPadding").apply {
            init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(GCM_TAG_BITS, titleIv))
        }
        val titleEncrypted = titleCipher.doFinal(title.toByteArray(Charsets.UTF_8))

        val bodyCipher = Cipher.getInstance("AES/GCM/NoPadding").apply {
            init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(GCM_TAG_BITS, bodyIv))
        }
        val bodyCombined = bodyCipher.doFinal(payloadJson.toByteArray(Charsets.UTF_8))
        val cipherOnly = bodyCombined.copyOfRange(0, bodyCombined.size - 16)
        val authTag = bodyCombined.copyOfRange(bodyCombined.size - 16, bodyCombined.size)

        val titleJson = JSONObject().apply {
            put("iv", Base64.encodeToString(titleIv, Base64.NO_WRAP))
            put("ct", Base64.encodeToString(titleEncrypted, Base64.NO_WRAP))
        }.toString()

        return EncryptedVaultBlob(
            encryptedTitle = titleJson,
            ciphertext = Base64.encodeToString(cipherOnly, Base64.NO_WRAP),
            iv = Base64.encodeToString(bodyIv, Base64.NO_WRAP),
            authTag = Base64.encodeToString(authTag, Base64.NO_WRAP),
            salt = Base64.encodeToString(salt, Base64.NO_WRAP)
        )
    }

    fun decrypt(
        passphrase: String,
        encryptedTitleJson: String,
        ciphertextB64: String,
        ivB64: String,
        authTagB64: String,
        saltB64: String
    ): Pair<String, String> {
        val salt = Base64.decode(saltB64, Base64.DEFAULT)
        val key = deriveKey(passphrase, salt)

        val titleObj = JSONObject(encryptedTitleJson)
        val titleIv = Base64.decode(titleObj.getString("iv"), Base64.DEFAULT)
        val titleCt = Base64.decode(titleObj.getString("ct"), Base64.DEFAULT)

        val titleCipher = Cipher.getInstance("AES/GCM/NoPadding").apply {
            init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(GCM_TAG_BITS, titleIv))
        }
        val titlePlain = String(titleCipher.doFinal(titleCt), Charsets.UTF_8)

        val cipherOnly = Base64.decode(ciphertextB64, Base64.DEFAULT)
        val tag = Base64.decode(authTagB64, Base64.DEFAULT)
        val combined = cipherOnly + tag
        val bodyIv = Base64.decode(ivB64, Base64.DEFAULT)

        val bodyCipher = Cipher.getInstance("AES/GCM/NoPadding").apply {
            init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(GCM_TAG_BITS, bodyIv))
        }
        val bodyPlain = String(bodyCipher.doFinal(combined), Charsets.UTF_8)

        return titlePlain to bodyPlain
    }

    fun canUseBiometrics(activity: FragmentActivity): Boolean {
        val mgr = BiometricManager.from(activity)
        val result = mgr.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG or
                BiometricManager.Authenticators.DEVICE_CREDENTIAL
        )
        return result == BiometricManager.BIOMETRIC_SUCCESS
    }

    fun promptBiometricUnlock(
        activity: FragmentActivity,
        title: String = "Unlock SIS Vault Guardian",
        subtitle: String = "Authenticate with biometrics or device credential",
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        val executor = ContextCompat.getMainExecutor(activity)
        val prompt = BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    onSuccess()
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    onError(errString.toString())
                }
            }
        )
        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG or
                    BiometricManager.Authenticators.DEVICE_CREDENTIAL
            )
            .build()
        prompt.authenticate(info)
    }
}
