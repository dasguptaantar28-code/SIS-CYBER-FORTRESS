package com.sis.cyberfortress.core.network

import com.google.gson.Gson
import com.sis.cyberfortress.BuildConfig
import com.sis.cyberfortress.core.security.SecurePrefsManager
import okhttp3.Authenticator
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object NetworkModule {
    private val gson = Gson()

    fun createApiService(prefs: SecurePrefsManager): SisApiService {
        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BASIC
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
            redactHeader("Authorization")
        }

        val refreshLock = Any()

        val client = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .addInterceptor { chain ->
                val original = chain.request()
                val token = prefs.getAccessToken()
                val reqBuilder = original.newBuilder()
                    .header("X-Client-Platform", "android")
                if (!token.isNullOrBlank() && original.header("Authorization") == null) {
                    reqBuilder.header("Authorization", "Bearer $token")
                }
                chain.proceed(reqBuilder.build())
            }
            .authenticator(object : Authenticator {
                override fun authenticate(route: Route?, response: Response): Request? {
                    if (response.request.url.encodedPath.contains("auth/refresh") ||
                        response.request.url.encodedPath.contains("auth/login")
                    ) {
                        return null
                    }
                    synchronized(refreshLock) {
                        val refreshToken = prefs.getRefreshToken() ?: return null
                        val refreshUrl = "${prefs.getApiBaseUrl()}auth/refresh"
                        val body = gson.toJson(RefreshRequestDto(refreshToken))
                            .toRequestBody("application/json".toMediaType())
                        val refreshReq = Request.Builder()
                            .url(refreshUrl)
                            .header("X-Client-Platform", "android")
                            .post(body)
                            .build()

                        val tempClient = OkHttpClient.Builder().build()
                        val refreshRes = tempClient.newCall(refreshReq).execute()
                        if (!refreshRes.isSuccessful) {
                            prefs.clearSession()
                            return null
                        }
                        val parsed = gson.fromJson(
                            refreshRes.body?.string(),
                            AuthResponseDto::class.java
                        ) ?: return null

                        val newAccess = parsed.accessToken ?: return null
                        val newRefresh = parsed.refreshToken ?: refreshToken
                        prefs.saveTokens(newAccess, newRefresh)

                        return response.request.newBuilder()
                            .header("Authorization", "Bearer $newAccess")
                            .build()
                    }
                }
            })
            .addInterceptor(logging)
            .build()

        return Retrofit.Builder()
            .baseUrl(prefs.getApiBaseUrl())
            .client(client)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
            .create(SisApiService::class.java)
    }
}
