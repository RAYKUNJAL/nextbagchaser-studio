param(
  [string]$Email,
  [string]$Password
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot ".env"
$examplePath = Join-Path $repoRoot ".env.example"

if (-not (Test-Path $envPath)) {
  if (Test-Path $examplePath) {
    Copy-Item -LiteralPath $examplePath -Destination $envPath
  } else {
    New-Item -ItemType File -Path $envPath | Out-Null
  }
}

if (-not $Password) {
  $secure = Read-Host "Enter new Next Bag Chaser Studio owner password" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $Password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

if (-not $Password -or $Password.Length -lt 10) {
  throw "OWNER_PASSWORD must be at least 10 characters."
}

if (-not $Email) {
  $Email = Read-Host "Enter owner email for studio login"
}

if (-not $Email -or $Email -notmatch "^[^@\s]+@[^@\s]+\.[^@\s]+$") {
  throw "OWNER_EMAIL must be a valid email address."
}

$lines = @()
if (Test-Path $envPath) {
  $lines = Get-Content -LiteralPath $envPath
}

$updated = $false
$emailUpdated = $false
$next = foreach ($line in $lines) {
  if ($line -match "^OWNER_PASSWORD=") {
    $updated = $true
    "OWNER_PASSWORD=$Password"
  } elseif ($line -match "^OWNER_EMAIL=") {
    $emailUpdated = $true
    "OWNER_EMAIL=$Email"
  } else {
    $line
  }
}

if (-not $updated) {
  $next += "OWNER_PASSWORD=$Password"
}

if (-not $emailUpdated) {
  $next += "OWNER_EMAIL=$Email"
}

Set-Content -LiteralPath $envPath -Value $next -Encoding UTF8

Write-Host "OWNER_EMAIL and OWNER_PASSWORD updated in $envPath"
Write-Host "Restart the Next Bag Chaser Studio API/server for the new login to take effect."
