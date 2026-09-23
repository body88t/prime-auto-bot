@echo off
echo ==============================================================================
echo PRIME AUTO BOT - FULL SYSTEM BUILD PIPELINE
echo ==============================================================================

echo [1/3] Building Core Backend Service...
cd /d "%~dp0\..\backend"
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Backend build failed.
    exit /b %ERRORLEVEL%
)

echo [2/3] Verifying Mobile App Dependencies...
cd /d "%~dp0\..\mobile_app"
call flutter pub get
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Flutter pub get failed.
    exit /b %ERRORLEVEL%
)

echo [3/3] Building Desktop Control Center...
cd /d "%~dp0\..\desktop_dashboard"
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Desktop Dashboard build failed.
    exit /b %ERRORLEVEL%
)

echo ==============================================================================
echo ALL COMPONENTS BUILT SUCCESSFULLY!
echo ==============================================================================
cd /d "%~dp0\.."
pause
