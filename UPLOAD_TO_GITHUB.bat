@echo off
chcp 65001 > nul
title Prime Auto Bot - Upload to GitHub
color 0b
echo ========================================================
echo   🚀 PRIME AUTO BOT - AUTOMATED GITHUB DEPLOYMENT
echo ========================================================
echo.
echo  Target: https://github.com/body88t/prime-auto-bot
echo.
echo  Connecting and pushing code to GitHub...
echo.
powershell -ExecutionPolicy Bypass -File scripts\auto_push.ps1
echo.
echo ========================================================
pause
