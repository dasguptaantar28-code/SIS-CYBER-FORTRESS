@echo off
title SIS Cyber Fortress - Debug APK Installer
setlocal
set APK="%~dp0app\build\outputs\apk\debug\app-debug.apk"
set SDK_ADB="%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
set MUMU_ADB="D:\Program Files\Netease\MuMuPlayer\nx_device\15.0\shell\adb.exe"

if not exist %APK% (
    echo [ERROR] app-debug.apk not found. Run: gradlew.bat assembleDebug
    exit /b 1
)

if exist %MUMU_ADB% (
    %MUMU_ADB% connect 127.0.0.1:16384 >nul 2>&1
    %MUMU_ADB% install -r -g %APK%
    %MUMU_ADB% shell am start -W -n com.sis.cyberfortress/.MainActivity
) else (
    %SDK_ADB% install -r -g %APK%
    %SDK_ADB% shell am start -W -n com.sis.cyberfortress/.MainActivity
)
endlocal
