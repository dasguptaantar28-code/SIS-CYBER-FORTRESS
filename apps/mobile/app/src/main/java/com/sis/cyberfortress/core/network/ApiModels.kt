package com.sis.cyberfortress.core.network

data class AuthUserDto(
    val id: String,
    val organizationId: String,
    val organizationName: String,
    val email: String,
    val fullName: String,
    val status: String,
    val mfaEnabled: Boolean,
    val roles: List<String>,
    val permissions: List<String>,
    val passkeyCount: Int? = 0
)

data class AuthResponseDto(
    val mfaRequired: Boolean = false,
    val challengeToken: String? = null,
    val message: String? = null,
    val clientType: String? = null,
    val sessionId: String? = null,
    val user: AuthUserDto? = null,
    val accessToken: String? = null,
    val refreshToken: String? = null
)

data class LoginRequestDto(
    val email: String,
    val password: String,
    val clientType: String = "android",
    val deviceName: String
)

data class RegisterRequestDto(
    val fullName: String,
    val email: String,
    val password: String,
    val clientType: String = "android",
    val deviceName: String
)

data class MfaVerifyRequestDto(
    val challengeToken: String,
    val code: String,
    val clientType: String = "android",
    val deviceName: String
)

data class RefreshRequestDto(val refreshToken: String)

data class BreachPrefixRequestDto(val sha1Prefix: String)

data class BreachPrefixResponseDto(
    val prefix: String,
    val providerStatus: String,
    val liveExternalLookup: Boolean,
    val suffixCount: Int,
    val suffixes: List<BreachSuffixDto>,
    val privacyNote: String,
    val checkedAt: String
)

data class BreachSuffixDto(val suffix: String, val count: Int)

data class DashboardKpisDto(
    val totalModules: Int,
    val activeModules: Int,
    val registeredDevices: Int,
    val compliantDevices: Int,
    val openSecurityAlerts: Int,
    val blockedThreats: Int,
    val activeIncidents: Int,
    val backupStatus: String,
    val lastBackupAt: String?,
    val overallSecurityPosture: Int
)

data class ModuleItemDto(
    val id: String,
    val code: String,
    val slug: String,
    val number: String,
    val name: String,
    val shortName: String,
    val category: String,
    val description: String,
    val platformSupport: String,
    val isEnabled: Boolean,
    val healthStatus: String,
    val postureScore: Int,
    val openAlertCount: Int
)

data class RecentActivityDto(
    val id: String,
    val timestamp: String,
    val event: String,
    val sourceModule: String,
    val moduleSlug: String,
    val severity: String,
    val status: String,
    val target: String
)

data class DashboardOverviewDto(
    val generatedAt: String,
    val demoSeedActive: Boolean,
    val kpis: DashboardKpisDto,
    val modules: List<ModuleItemDto>,
    val recentActivities: List<RecentActivityDto>
)

data class RegisterDeviceRequestDto(
    val deviceName: String,
    val platform: String = "ANDROID",
    val manufacturer: String,
    val model: String,
    val osVersion: String,
    val securityPatchLevel: String,
    val appVersion: String,
    val deviceIdentifier: String,
    val isRootedOrCompromised: Boolean,
    val screenLockEnabled: Boolean,
    val biometricSupported: Boolean,
    val encryptionEnabled: Boolean,
    val installedAppCount: Int,
    val highRiskPermissionCount: Int,
    val postureDetails: Map<String, Any>
)

data class DeviceDto(
    val id: String,
    val deviceName: String,
    val platform: String,
    val osVersion: String?,
    val complianceStatus: String,
    val postureScore: Int,
    val lastSeenAt: String
)

data class PhishingScanRequestDto(val url: String)

data class ScanFindingDto(
    val code: String?,
    val title: String,
    val severity: String,
    val detail: String,
    val remediation: String?
)

data class ScanResultDto(
    val id: String,
    val riskLevel: String,
    val riskScore: Int,
    val summary: String,
    val verdictDisclaimer: String,
    val findings: List<ScanFindingDto>?,
    val falsePositiveReported: Boolean = false
)

data class ScanJobDto(
    val id: String,
    val moduleCode: String,
    val targetValue: String,
    val providerStatus: String,
    val createdAt: String,
    val result: ScanResultDto?
)

data class AssetDto(
    val id: String,
    val name: String,
    val targetUrl: String,
    val domain: String,
    val ownershipStatus: String,
    val isApprovedForScan: Boolean
)

data class WebShieldScanRequestDto(val assetId: String)

data class NetworkAssessmentRequestDto(
    val connectionType: String,
    val transportLabel: String,
    val isVpnActive: Boolean,
    val isMetered: Boolean,
    val wifiSecurityType: String,
    val ssidVisibilityNote: String,
    val checklistState: Map<String, Boolean>
)

data class NetworkAssessmentDto(
    val id: String,
    val connectionType: String,
    val wifiSecurityType: String,
    val isOpenOrUnsafe: Boolean,
    val riskScore: Int,
    val warnings: List<String>,
    val createdAt: String
)

data class VaultRecordCreateDto(
    val recordType: String,
    val encryptedTitle: String,
    val ciphertext: String,
    val iv: String,
    val authTag: String,
    val salt: String,
    val kdfAlgorithm: String,
    val kdfIterations: Int,
    val clientType: String = "android"
)

data class VaultRecordDto(
    val id: String,
    val recordType: String,
    val encryptedTitle: String,
    val ciphertext: String,
    val iv: String,
    val authTag: String,
    val salt: String,
    val createdAt: String
)

data class BackupEntryDto(val relativePath: String, val content: String)
data class CreateBackupRequestDto(
    val backupName: String,
    val scheduleType: String = "MANUAL",
    val entries: List<BackupEntryDto>
)

data class BackupJobDto(
    val id: String,
    val backupName: String,
    val status: String,
    val encryptionAlgo: String,
    val totalBytes: Int,
    val fileCount: Int,
    val integrityVerified: Boolean,
    val checksumSha256: String?,
    val createdAt: String
)

data class BackupsListResponseDto(
    val jobs: List<BackupJobDto>,
    val summary: BackupSummaryDto
)

data class BackupSummaryDto(
    val totalJobs: Int,
    val verifiedCount: Int,
    val failedCount: Int,
    val totalStorageBytes: Int
)

data class SecurityAlertDto(
    val id: String,
    val title: String,
    val description: String,
    val severity: String,
    val status: String,
    val category: String,
    val createdAt: String
)

data class NotificationItemDto(
    val id: String,
    val title: String,
    val message: String,
    val severity: String,
    val moduleCode: String,
    val isRead: Boolean,
    val createdAt: String
)

data class NotificationsResponseDto(
    val items: List<NotificationItemDto>,
    val unreadCount: Int,
    val pushProviderStatus: String
)

data class ThreatIndicatorDto(
    val id: String,
    val indicatorType: String,
    val value: String,
    val threatCategory: String,
    val severity: String,
    val confidence: Int
)

data class LoginActivityDto(
    val id: String,
    val emailAttempted: String,
    val success: Boolean,
    val isSuspicious: Boolean,
    val ipAddress: String?,
    val createdAt: String
)

data class IdentityOverviewDto(
    val identitySecurityScore: Int,
    val activeSessions: Int,
    val suspiciousLoginCount: Int,
    val breachProviderStatus: String,
    val loginHistory: List<LoginActivityDto>
)
