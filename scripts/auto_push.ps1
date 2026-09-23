$maxAttempts = 150
$attempt = 0

Write-Host "Monitoring for GitHub repository creation on https://github.com/body88t/prime-auto-bot..."

while ($attempt -lt $maxAttempts) {
    $output = git push -u origin main 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0 -or $output -match "set up to track" -or $output -match "Everything up-to-date") {
        Write-Host "✅ SUCCESS: Code has been pushed to GitHub successfully!"
        Write-Host $output
        exit 0
    }
    Start-Sleep -Seconds 4
    $attempt++
}

Write-Host "Timeout waiting for repository creation."
