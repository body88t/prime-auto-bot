@echo off
chcp 65001 >nul
title PRIME AUTO BOT - تشغيل النظام بالكامل
cls
echo ==============================================================================
echo           ⚡ نظام PRIME AUTO BOT - نظام التحقق والأتمتة الذكي ⚡
echo ==============================================================================
echo.
echo [1/2] جاري تشغيل السيرفر الخلفي (Backend Engine)...
echo       - منفذ السيرفر: http://localhost:3000
echo       - رمز الواتساب (QR Code) سيظهر أيضاً في نافذة السيرفر للمسح.
echo.

start "PRIME AUTO BOT - Backend Engine" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo جاري الانتظار 4 ثوانٍ لتهيئة السيرفر وقاعدة البيانات...
timeout /t 4 /nobreak >nul

echo.
echo [2/2] جاري فتح لوحة التحكم الرئيسية (Desktop Dashboard EXE)...
start "" "%~dp0desktop_dashboard\release\win-unpacked\Prime Auto Bot Dashboard.exe"

echo.
echo ==============================================================================
echo  ✓ تم تشغيل النظام بنجاح!
echo  ✓ نافذة السيرفر تعمل في الخلفية لمعالجة رسائل البنوك وواتساب.
echo  ✓ لوحة التحكم مفتوحة أمامك الآن.
echo ==============================================================================
echo.
pause
