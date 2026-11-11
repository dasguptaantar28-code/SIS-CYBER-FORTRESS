# Known Limitations & Honest Platform Disclosures

1. **Android Package Visibility (Module 03 — Endpoint Guardian):**
   Android 11+ restricts cross-app enumeration. Rather than abusing privileged `QUERY_ALL_PACKAGES`, SIS Cyber Fortress declares standard `<queries>` for launcher-visible apps. System background services without launcher activities are intentionally excluded.

2. **Wi-Fi SSID & Security Type Restrictions (Module 04 — Network Sentinel):**
   Android restricts Wi-Fi SSID and security cipher inspection unless `ACCESS_FINE_LOCATION` is granted by the user. Web browsers do not expose Wi-Fi SSID/cipher APIs at all. When unavailable, Network Sentinel explicitly reports the OS restriction rather than fabricating values.

3. **Optional External Threat Feeds & Push Notifications:**
   - VirusTotal, Google Safe Browsing, HIBP external Range API, and Firebase Cloud Messaging require external credentials. When unconfigured, the Integration Status table honestly marks them as `UNCONFIGURED` or `LOCAL_ONLY`, and the platform operates cleanly using local IOC correlation, lexical analysis, k-anonymity benchmark prefixes, WebSocket alerts, and database notifications.
   - Geolocation Threat Map displays coordinates ONLY when geo-tagged events exist in PostgreSQL (`hasLiveGeoData: true`), or offers an explicitly labeled Sample Preview overlay with zero fake live attack telemetry.

4. **Non-Destructive Defensive Boundaries:**
   WebShield runs passive TLS/DNS/HTTP security header inspections exclusively on verified or admin-approved domains. Ransomware Guardian performs defensive readiness and backup checks only and never executes destructive payloads or real ransomware simulations. Remote device wipe is intentionally excluded from default scope.
