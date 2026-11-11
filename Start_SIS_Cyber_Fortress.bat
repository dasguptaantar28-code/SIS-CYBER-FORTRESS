@echo off
title SIS Cyber Fortress - Full Ecosystem Launcher
color 0B
echo =======================================================================
echo             SIS CYBER FORTRESS - LOCAL ECOSYSTEM LAUNCHER
echo =======================================================================
echo.

set ROOT=%~dp0
if not exist "%ROOT%.env" (
    echo [INFO] Creating local .env from .env.example...
    copy "%ROOT%.env.example" "%ROOT%.env" >nul
)

echo [1/4] Starting Local PostgreSQL Wire Server (Port 5432)...
start "SIS Local PostgreSQL" cmd /k "cd /d "%ROOT%apps\api" && npx tsx src/scripts/dev-with-local-pg.ts --migrate-and-seed"

timeout /t 4 /nobreak >nul

echo [2/4] Starting NestJS Backend API (Port 4000)...
start "SIS Backend API" cmd /k "cd /d "%ROOT%apps\api" && npm run start"

timeout /t 3 /nobreak >nul

echo [3/4] Starting Next.js Super Admin Web Portal (Port 3000)...
start "SIS Web Portal" cmd /k "cd /d "%ROOT%" && npm --workspace=@sis/web run start"

echo [4/4] Setting up MuMuPlayer ADB reverse bridge (if running)...
set MUMU_ADB="D:\Program Files\Netease\MuMuPlayer\nx_device\15.0\shell\adb.exe"
if exist %MUMU_ADB% (
    %MUMU_ADB% connect 127.0.0.1:16384 >nul 2>&1
    %MUMU_ADB% -s 127.0.0.1:16384 reverse tcp:4000 tcp:4000 >nul 2>&1
)

echo.
echo =======================================================================
echo   ALL SERVICES LAUNCHED:
echo     - Web Portal:  http://localhost:3000
echo     - Backend API: http://localhost:4000/api/v1
echo     - Swagger UI:  http://localhost:4000/api/docs
echo     - Android APK: Connects automatically via http://10.0.2.2:4000/api/v1/
echo =======================================================================
echo.
pause
