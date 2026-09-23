@echo off
echo ==============================================================================
echo STARTING PRIME AUTO BOT ECOSYSTEM
echo ==============================================================================

start "Prime Backend Engine" cmd /k "cd /d "%~dp0\..\backend" && npm run dev"
timeout /t 3 /nobreak >nul

start "Prime Desktop Control Center" cmd /k "cd /d "%~dp0\..\desktop_dashboard" && npm run dev"

echo Backend running on http://localhost:3000
echo Dashboard running on http://localhost:5173
