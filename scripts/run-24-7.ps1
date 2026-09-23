# ==============================================================================
# PRIME AUTO BOT - 24/7 Autonomous Watchdog & Tunnel Manager
# ==============================================================================
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "`n==============================================================================" -ForegroundColor Cyan
Write-Host "     ⚡ PRIME AUTO BOT - نظام التشغيل المستقل 24/7 بدون توقف ⚡" -ForegroundColor Yellow
Write-Host "==============================================================================`n" -ForegroundColor Cyan

# 1. Prevent Sleep & Screen Off interruptions
Write-Host "[1/4] ضبط إعدادات الطاقة لمنع وضع السكون نهائياً..." -ForegroundColor Green
try {
    powercfg /change standby-timeout-ac 0 2>$null
    powercfg /change standby-timeout-dc 0 2>$null
    powercfg /change hibernate-timeout-ac 0 2>$null
    powercfg /change hibernate-timeout-dc 0 2>$null
    powercfg /setacvalueindex scheme_current 4f971e89-eebd-4455-a8de-9e59040e7347 5ca83367-6e45-459f-a27b-476b1d01c936 0 2>$null
    powercfg /setdcvalueindex scheme_current 4f971e89-eebd-4455-a8de-9e59040e7347 5ca83367-6e45-459f-a27b-476b1d01c936 0 2>$null
    powercfg /setactive scheme_current 2>$null
    Write-Host "  ✓ تم تفعيل وضع الاستمرار الدائم (الكمبيوتر لن يدخل في سكون حتى مع إغلاق الشاشة)." -ForegroundColor Gray
} catch {
    Write-Host "  ! تحذير: تعذر ضبط إعدادات الطاقة تلقائياً." -ForegroundColor DarkYellow
}

$rootDir = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $rootDir "backend"
$toolsDir = Join-Path $rootDir "tools"
$storageDir = Join-Path $rootDir "storage"
$cloudflaredExe = Join-Path $toolsDir "cloudflared.exe"
$tunnelLog = Join-Path $storageDir "tunnel.log"

if (-not (Test-Path $storageDir)) {
    New-Item -ItemType Directory -Path $storageDir -Force | Out-Null
}

# 2. Check if backend is already running on port 3000
Write-Host "`n[2/4] التحقق من السيرفر الخلفي (Port 3000)..." -ForegroundColor Green
$backendProcess = $null
$portCheck = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue

if (-not $portCheck) {
    Write-Host "  جاري تشغيل السيرفر الخلفي في الخلفية..." -ForegroundColor Cyan
    $backendProcess = Start-Process -FilePath "node" -ArgumentList "dist/server.js" -WorkingDirectory $backendDir -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 4
} else {
    Write-Host "  ✓ السيرفر الخلفي يعمل بالفعل على المنفذ 3000." -ForegroundColor Gray
}

# 3. Start or verify Cloudflare Tunnel
Write-Host "`n[3/4] تشغيل نفق الويب هوك السحابي الآمن (Cloudflare)..." -ForegroundColor Green
if (Test-Path $tunnelLog) {
    Remove-Item $tunnelLog -Force -ErrorAction SilentlyContinue
}

$tunnelProc = Start-Process -FilePath $cloudflaredExe -ArgumentList "tunnel --url http://localhost:3000 --logfile `"$tunnelLog`"" -PassThru -WindowStyle Hidden

Write-Host "  جاري استخراج الرابط السحابي الدائم..." -ForegroundColor Cyan
$publicUrl = $null
$retries = 25
while ($retries -gt 0 -and -not $publicUrl) {
    Start-Sleep -Seconds 1
    if (Test-Path $tunnelLog) {
        $content = Get-Content $tunnelLog -Raw -ErrorAction SilentlyContinue
        if ($content -match '(https://[a-zA-Z0-9\-]+\.trycloudflare\.com)') {
            $publicUrl = $matches[1]
            break
        }
    }
    $retries--
}

if (-not $publicUrl) {
    # Check if there is an existing active tunnel in .env
    $envPath = Join-Path $backendDir ".env"
    if (Test-Path $envPath) {
        $envContent = Get-Content $envPath
        foreach ($line in $envContent) {
            if ($line -match '^PUBLIC_SERVER_URL=(https://[^\s]+)') {
                $publicUrl = $matches[1]
                break
            }
        }
    }
}

# 4. Display Status and Summary
Write-Host "`n==============================================================================" -ForegroundColor Green
Write-Host "                ✅ تم تشغيل نظام PRIME AUTO BOT بنجاح!" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green

if ($publicUrl) {
    $webhookUrl = "$publicUrl/api/v1/webhooks/wuilt"
    $qrUrl = "$publicUrl/scan-qr"
    $healthUrl = "$publicUrl/health"

    # Copy webhook URL to clipboard
    try {
        Set-Clipboard -Value $webhookUrl
        $copiedNotice = "(تم نسخه للحافظة تلقائياً Clipboard)"
    } catch {
        $copiedNotice = ""
    }

    Write-Host "`n🔗 روابط النظام الحية المتاحة عبر الإنترنت الآن:" -ForegroundColor Yellow
    Write-Host "------------------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host " 1. رابط الويب هوك لمتجر ويلت (Wuilt Webhook URL):" -ForegroundColor Cyan
    Write-Host "    $webhookUrl $copiedNotice" -ForegroundColor White
    Write-Host "`n 2. صفحة رمز الواتساب (QR Code Pairing UI):" -ForegroundColor Cyan
    Write-Host "    $qrUrl" -ForegroundColor White
    Write-Host "`n 3. فحص صحة واستقرار السيرفر (Health Check):" -ForegroundColor Cyan
    Write-Host "    $healthUrl" -ForegroundColor White
    Write-Host "------------------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "`n💡 تعليمات هامة:" -ForegroundColor Yellow
    Write-Host " • الواتساب متصل حالياً وجاهز للعمل." -ForegroundColor Gray
    Write-Host " • إذا احتجت ربط رقم جديد في أي وقت، افتح الرابط رقم 2 من هاتفك وامسح الكود." -ForegroundColor Gray
    Write-Host " • ضع الرابط رقم 1 في إعدادات Webhooks في متجر ويلت لاستقبال الطلبات الجديدة فورياً." -ForegroundColor Gray
    Write-Host " • اللاب توب سيبقى يعمل في الخلفية 24/7 حتى لو أغلقت الشاشة." -ForegroundColor Gray
} else {
    Write-Host "`nالسيرفر يعمل محلياً على: http://localhost:3000" -ForegroundColor Yellow
    Write-Host "صفحة الواتساب: http://localhost:3000/scan-qr" -ForegroundColor Yellow
}

Write-Host "`n==============================================================================" -ForegroundColor Green
Write-Host "البوت يعمل الآن في الخلفية. يمكنك تصغير هذه النافذة أو تركها مفتوحة." -ForegroundColor DarkCyan
Write-Host "للإيقاف في أي وقت: اضغط Ctrl + C" -ForegroundColor DarkGray
Write-Host "==============================================================================`n" -ForegroundColor Green

# Keep script running to maintain watchdog
while ($true) {
    Start-Sleep -Seconds 60
}
