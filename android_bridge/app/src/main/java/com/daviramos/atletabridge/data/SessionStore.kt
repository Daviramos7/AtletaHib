package com.daviramos.atletabridge.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import kotlinx.serialization.json.Json
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class SessionStore(context: Context) : AuthStore {
    private val prefs = context.getSharedPreferences("atleta_bridge_session", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    override fun save(auth: AuthResponse) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val encrypted = cipher.doFinal(json.encodeToString(AuthResponse.serializer(), auth).toByteArray(Charsets.UTF_8))
        check(prefs.edit().clear().putString("session", Base64.encodeToString(cipher.iv + encrypted, Base64.NO_WRAP)).commit())
    }
    override fun load(): AuthResponse? {
        return try {
            val encoded = prefs.getString("session", null)
            if (encoded != null) {
                val bytes = Base64.decode(encoded, Base64.NO_WRAP)
                val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
                json.decodeFromString<AuthResponse>(String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8))
            } else {
                // One-time upgrade of the previous plaintext session, without storing the password.
                val token = prefs.getString("access_token", null) ?: return null
                AuthResponse(token, prefs.getString("refresh_token", null),
                    AuthUser(prefs.getString("user_id", null), prefs.getString("email", null))).also(::save)
            }
        } catch (_: Exception) {
            // A removed/invalidated Keystore key requires sign-in, never a plaintext fallback.
            clear(); null
        }
    }
    override fun clear() { prefs.edit().clear().commit() }
    private companion object { const val ALIAS = "atleta_hib_session_v1" }
}
