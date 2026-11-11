package com.sis.cyberfortress.core.network

import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface SisApiService {
    @POST("auth/login")
    suspend fun login(@Body body: LoginRequestDto): AuthResponseDto

    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequestDto): AuthResponseDto

    @POST("auth/mfa/verify")
    suspend fun verifyMfa(@Body body: MfaVerifyRequestDto): AuthResponseDto

    @POST("auth/refresh")
    suspend fun refresh(@Body body: RefreshRequestDto): AuthResponseDto

    @POST("auth/logout")
    suspend fun logout(): Map<String, Any>

    @GET("auth/me")
    suspend fun me(): AuthUserDto

    @GET("auth/identity-overview")
    suspend fun identityOverview(): IdentityOverviewDto

    @POST("auth/breach-check")
    suspend fun checkBreachPrefix(@Body body: BreachPrefixRequestDto): BreachPrefixResponseDto

    @GET("dashboard/overview")
    suspend fun dashboardOverview(): DashboardOverviewDto

    @GET("modules")
    suspend fun listModules(): List<ModuleItemDto>

    @POST("devices/register")
    suspend fun registerDevice(@Body body: RegisterDeviceRequestDto): DeviceDto

    @GET("devices")
    suspend fun listDevices(): List<DeviceDto>

    @POST("scans/phishing")
    suspend fun scanPhishing(@Body body: PhishingScanRequestDto): ScanResultDto

    @POST("scans/webshield")
    suspend fun scanWebShield(@Body body: WebShieldScanRequestDto): ScanResultDto

    @GET("scans")
    suspend fun listScans(@Query("moduleCode") moduleCode: String? = null): List<ScanJobDto>

    @GET("assets")
    suspend fun listAssets(): List<AssetDto>

    @POST("posture/network")
    suspend fun submitNetworkAssessment(@Body body: NetworkAssessmentRequestDto): NetworkAssessmentDto

    @GET("posture/network")
    suspend fun listNetworkAssessments(): List<NetworkAssessmentDto>

    @GET("vault/records")
    suspend fun listVaultRecords(): List<VaultRecordDto>

    @POST("vault/records")
    suspend fun createVaultRecord(@Body body: VaultRecordCreateDto): VaultRecordDto

    @DELETE("vault/records/{id}")
    suspend fun deleteVaultRecord(@Path("id") id: String): Map<String, Any>

    @GET("backups")
    suspend fun listBackups(): BackupsListResponseDto

    @POST("backups")
    suspend fun createBackup(@Body body: CreateBackupRequestDto): BackupJobDto

    @POST("backups/{id}/restore")
    suspend fun restoreBackup(@Path("id") id: String): Map<String, Any>

    @GET("alerts")
    suspend fun listAlerts(): List<SecurityAlertDto>

    @GET("threats/indicators")
    suspend fun listIndicators(@Query("search") search: String? = null): List<ThreatIndicatorDto>

    @GET("notifications")
    suspend fun listNotifications(): NotificationsResponseDto

    @PATCH("notifications/{id}/read")
    suspend fun markNotificationRead(@Path("id") id: String): NotificationItemDto

    @PATCH("notifications/read-all")
    suspend fun markAllNotificationsRead(): Map<String, Any>
}
