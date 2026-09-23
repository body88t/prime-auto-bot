@echo off
chcp 65001 >nul
title PRIME AUTO BOT - تشغيل 24/7 المستمر
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\run-24-7.ps1"
pause
