param(
  [string]$HostName = "5.78.105.83",
  [string]$User = "root",
  [string]$RemoteDir = "/root/Opaija",
  [string]$Domain = "https://studio.nextbagchaser.com/login"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$documentsDir = Split-Path -Parent $repoRoot
$archivePath = Join-Path $documentsDir "opaija-deploy.tgz"
$remote = "$User@$HostName"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,
    [string[]]$Arguments = @()
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath failed with exit code $LASTEXITCODE."
  }
}

Write-Host "Building local production bundle..."
Push-Location $repoRoot
try {
  Invoke-Checked "npm" @("run", "build")
} finally {
  Pop-Location
}

Write-Host "Creating deploy archive..."
if (Test-Path $archivePath) {
  Remove-Item -LiteralPath $archivePath -Force
}
Push-Location $documentsDir
try {
  tar -czf opaija-deploy.tgz `
    --exclude=Opaija/node_modules `
    --exclude=Opaija/.git `
    --exclude=Opaija/out `
    --exclude=Opaija/data `
    --exclude=Opaija/ops/projects `
    --exclude=Opaija/public/generated `
    --exclude=Opaija/public/voiceover `
    --exclude=Opaija/public/assets/video `
    --exclude=Opaija/public/assets/flipbook `
    --exclude=Opaija/public/assets/style-references `
    --exclude=Opaija/logs `
    --exclude=Opaija/.playwright-mcp `
    --exclude=Opaija/dist `
    --exclude=Opaija/dist-server `
    Opaija
} finally {
  Pop-Location
}

Write-Host "Uploading archive to $remote..."
Invoke-Checked "scp" @($archivePath, "${remote}:/root/opaija-deploy.tgz")

$remoteScript = @"
set -e
cd /root
rm -rf /root/opaija-runtime-backup
mkdir -p /root/opaija-runtime-backup
if [ -f /root/Opaija/.env ]; then cp /root/Opaija/.env /root/opaija-runtime-backup/.env; fi
if [ -d /root/Opaija/data ]; then cp -a /root/Opaija/data /root/opaija-runtime-backup/data; fi
if [ -d /root/Opaija/ops/projects ]; then mkdir -p /root/opaija-runtime-backup/ops && cp -a /root/Opaija/ops/projects /root/opaija-runtime-backup/ops/projects; fi
if [ -d /root/Opaija/public/generated ]; then mkdir -p /root/opaija-runtime-backup/public && cp -a /root/Opaija/public/generated /root/opaija-runtime-backup/public/generated; fi
if [ -d /root/Opaija/public/voiceover ]; then mkdir -p /root/opaija-runtime-backup/public && cp -a /root/Opaija/public/voiceover /root/opaija-runtime-backup/public/voiceover; fi
rm -rf /root/Opaija
tar -xzf /root/opaija-deploy.tgz
cd /root/Opaija
if [ -f /root/opaija-runtime-backup/.env ]; then
  cp /root/opaija-runtime-backup/.env /root/Opaija/.env
elif [ -f /root/.opaija.env ]; then
  cp /root/.opaija.env /root/Opaija/.env
fi
if [ -d /root/opaija-runtime-backup/data ]; then cp -a /root/opaija-runtime-backup/data /root/Opaija/data; fi
if [ -d /root/opaija-runtime-backup/ops/projects ]; then mkdir -p /root/Opaija/ops && cp -a /root/opaija-runtime-backup/ops/projects /root/Opaija/ops/projects; fi
if [ -d /root/opaija-runtime-backup/public/generated ]; then mkdir -p /root/Opaija/public && cp -a /root/opaija-runtime-backup/public/generated /root/Opaija/public/generated; fi
if [ -d /root/opaija-runtime-backup/public/voiceover ]; then mkdir -p /root/Opaija/public && cp -a /root/opaija-runtime-backup/public/voiceover /root/Opaija/public/voiceover; fi
npm ci
npm run build
pm2 delete opaija || true
pm2 start npm --name opaija --cwd /root/Opaija -- start --update-env
pm2 save
curl -I http://127.0.0.1:8787/api/health
curl -I $Domain
"@

Write-Host "Rebuilding and restarting Opaija on VPS..."
$remoteScript | ssh $remote "sh -s"
if ($LASTEXITCODE -ne 0) {
  throw "Remote deploy failed with exit code $LASTEXITCODE. The live server was not updated."
}

Write-Host "Verifying live login route..."
try {
  Invoke-WebRequest -Uri $Domain -Method Head -TimeoutSec 20 | Select-Object StatusCode,StatusDescription
} catch {
  Write-Warning $_.Exception.Message
}

Write-Host "Live deploy complete. Open $Domain"
