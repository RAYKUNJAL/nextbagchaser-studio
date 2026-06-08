param(
  [string]$HostName = "5.78.105.83",
  [string]$User = "root",
  [string]$Domain = "https://studio.nextbagchaser.com/login",
  [int]$ChunkSizeMb = 4
)

$ErrorActionPreference = "Stop"

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

function Split-File {
  param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,
    [Parameter(Mandatory = $true)]
    [string]$OutputDir,
    [Parameter(Mandatory = $true)]
    [int]$ChunkSizeBytes
  )

  if (Test-Path $OutputDir) {
    Remove-Item -LiteralPath $OutputDir -Recurse -Force
  }
  New-Item -ItemType Directory -Path $OutputDir | Out-Null

  $buffer = New-Object byte[] $ChunkSizeBytes
  $stream = [System.IO.File]::OpenRead($InputPath)
  try {
    $index = 0
    while (($read = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
      $partPath = Join-Path $OutputDir ("part-{0:D4}" -f $index)
      $out = [System.IO.File]::OpenWrite($partPath)
      try {
        $out.Write($buffer, 0, $read)
      } finally {
        $out.Close()
      }
      $index += 1
    }
  } finally {
    $stream.Close()
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$documentsDir = Split-Path -Parent $repoRoot
$archivePath = Join-Path $documentsDir "opaija-deploy.tgz"
$partsDir = Join-Path $documentsDir "opaija-deploy-parts"
$remoteScriptPath = Join-Path $documentsDir "opaija-remote-deploy.sh"
$remote = "$User@$HostName"
$remotePartsDir = "/root/opaija-deploy-parts"

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
  Invoke-Checked "tar" @(
    "-czf", "opaija-deploy.tgz",
    "--exclude=Opaija/node_modules",
    "--exclude=Opaija/.git",
    "--exclude=Opaija/out",
    "--exclude=Opaija/data",
    "--exclude=Opaija/ops/projects",
    "--exclude=Opaija/public/generated",
    "--exclude=Opaija/public/voiceover",
    "--exclude=Opaija/public/assets/video",
    "--exclude=Opaija/public/assets/flipbook",
    "--exclude=Opaija/public/assets/style-references",
    "--exclude=Opaija/logs",
    "--exclude=Opaija/.playwright-mcp",
    "--exclude=Opaija/dist",
    "--exclude=Opaija/dist-server",
    "Opaija"
  )
} finally {
  Pop-Location
}

$archive = Get-Item $archivePath
Write-Host ("Archive ready: {0:N1} MB" -f ($archive.Length / 1MB))

Write-Host "Splitting archive into $ChunkSizeMb MB parts..."
Split-File -InputPath $archivePath -OutputDir $partsDir -ChunkSizeBytes ($ChunkSizeMb * 1MB)
$parts = Get-ChildItem -LiteralPath $partsDir -File | Sort-Object Name
Write-Host "Created $($parts.Count) parts."

Write-Host "Preparing remote upload folder..."
Invoke-Checked "ssh" @("-tt", $remote, "rm -rf $remotePartsDir /root/opaija-deploy.tgz /root/opaija-remote-deploy.sh && mkdir -p $remotePartsDir")

foreach ($part in $parts) {
  Write-Host "Uploading $($part.Name)..."
  Invoke-Checked "scp" @($part.FullName, "${remote}:$remotePartsDir/$($part.Name)")
}

$remoteScript = @"
set -e
cd /root
cat $remotePartsDir/part-* > /root/opaija-deploy.tgz
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

Set-Content -LiteralPath $remoteScriptPath -Value $remoteScript -Encoding UTF8
Write-Host "Uploading remote deploy script..."
Invoke-Checked "scp" @($remoteScriptPath, "${remote}:/root/opaija-remote-deploy.sh")

Write-Host "Rebuilding and restarting app on VPS..."
Invoke-Checked "ssh" @("-tt", $remote, "bash /root/opaija-remote-deploy.sh")

Write-Host "Verifying live studio route..."
try {
  Invoke-WebRequest -Uri $Domain -Method Head -UseBasicParsing -TimeoutSec 20 | Select-Object StatusCode,StatusDescription
} catch {
  Write-Warning $_.Exception.Message
}

Write-Host "Chunked live deploy complete. Open $Domain"
