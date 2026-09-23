@echo off
chcp 65001 >nul
title PRIME AUTO BOT - لوحة التحكم
cls
echo فتح لوحة التحكم Desktop Dashboard...
start "" "%~dp0desktop_dashboard\release\win-unpacked\Prime Auto Bot Dashboard.exe"
