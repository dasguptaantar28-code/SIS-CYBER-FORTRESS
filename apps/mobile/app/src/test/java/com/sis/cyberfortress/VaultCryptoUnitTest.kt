package com.sis.cyberfortress

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.security.MessageDigest
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

class VaultCryptoUnitTest {
    @Test
    fun aesGcmRoundTripAndIntegrityVerification() {
        val salt = ByteArray(16) { 0x2A }
        val iv = ByteArray(12) { 0x11 }
        val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        val spec = PBEKeySpec("FortressPin#2026".toCharArray(), salt, 10000, 256)
        val key = SecretKeySpec(factory.generateSecret(spec).encoded, "AES")

        val plaintext = "Zero-Knowledge Vault Secret"
        val encCipher = Cipher.getInstance("AES/GCM/NoPadding")
        encCipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(128, iv))
        val sealed = encCipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))

        val decCipher = Cipher.getInstance("AES/GCM/NoPadding")
        decCipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, iv))
        val unsealed = String(decCipher.doFinal(sealed), Charsets.UTF_8)

        assertEquals(plaintext, unsealed)
    }

    @Test
    fun kAnonymityPrefixDoesNotExposeFullPasswordHash() {
        val sha1 = MessageDigest.getInstance("SHA-1")
            .digest("password".toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02X".format(it) }
        val prefix = sha1.take(5)
        assertEquals(5, prefix.length)
        assertEquals("5BAA6", prefix)
        assertFalse(prefix.contains("password"))
        assertTrue(sha1.length == 40)
    }
}
