package com.daviramos.atletabridge.data

import android.content.Context

class SessionStore(context: Context) {
    private val prefs = context.getSharedPreferences("atleta_bridge_session", Context.MODE_PRIVATE)

    fun save(email: String, auth: AuthResponse) {
        prefs.edit()
            .putString(KEY_EMAIL, email.ifBlank { auth.user?.email.orEmpty() })
            .putString(KEY_ACCESS_TOKEN, auth.accessToken)
            .putString(KEY_REFRESH_TOKEN, auth.refreshToken)
            .putString(KEY_USER_ID, auth.user?.id)
            .apply()
    }

    fun load(): SavedSession? {
        val accessToken = prefs.getString(KEY_ACCESS_TOKEN, null)?.takeIf { it.isNotBlank() }
        val refreshToken = prefs.getString(KEY_REFRESH_TOKEN, null)?.takeIf { it.isNotBlank() }
        val userId = prefs.getString(KEY_USER_ID, null)?.takeIf { it.isNotBlank() }
        val email = prefs.getString(KEY_EMAIL, null)?.takeIf { it.isNotBlank() }

        if (accessToken == null && refreshToken == null) return null

        return SavedSession(
            email = email,
            accessToken = accessToken,
            refreshToken = refreshToken,
            userId = userId
        )
    }

    fun clear() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val KEY_EMAIL = "email"
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_USER_ID = "user_id"
    }
}

data class SavedSession(
    val email: String?,
    val accessToken: String?,
    val refreshToken: String?,
    val userId: String?
) {
    fun toAuthResponse(): AuthResponse? {
        val token = accessToken?.takeIf { it.isNotBlank() } ?: return null
        return AuthResponse(
            accessToken = token,
            refreshToken = refreshToken,
            user = AuthUser(id = userId, email = email)
        )
    }
}
