try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
    [Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime] | Out-Null
    $vault = New-Object Windows.Security.Credentials.PasswordVault
    $creds = $vault.RetrieveAll()
    foreach ($c in $creds) {
        if ($c.Resource -match 'git' -or $c.Resource -match 'github') {
            $c.RetrievePassword()
            Write-Output "FOUND: Resource=$($c.Resource) User=$($c.UserName) Pass=$($c.Password.Substring(0, [Math]::Min(6, $c.Password.Length)))..."
        }
    }
} catch {
    Write-Output "Error: $_"
}
