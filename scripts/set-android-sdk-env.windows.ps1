param(
  [string]$SdkPath
)

$ErrorActionPreference = "Stop"

function Resolve-AndroidSdkPath {
  param(
    [string]$ExplicitPath
  )

  $candidates = @()

  if ($ExplicitPath) {
    $candidates += $ExplicitPath
  }

  if ($env:ANDROID_HOME) {
    $candidates += $env:ANDROID_HOME
  }

  if ($env:ANDROID_SDK_ROOT) {
    $candidates += $env:ANDROID_SDK_ROOT
  }

  $candidates += @(
    "$env:LOCALAPPDATA\Android\Sdk",
    "C:\Android\Sdk",
    "D:\Android\Sdk",
    "E:\Android\Sdk"
  )

  foreach ($candidate in $candidates | Where-Object { $_ } | Select-Object -Unique) {
    $platformTools = Join-Path $candidate "platform-tools"
    $platforms = Join-Path $candidate "platforms"

    if ((Test-Path $platformTools) -and (Test-Path $platforms)) {
      return $candidate
    }
  }

  return $null
}

function Add-PathEntry {
  param(
    [string]$CurrentPath,
    [string]$Entry
  )

  $normalizedEntries = ($CurrentPath -split ';' | Where-Object { $_.Trim() }) |
    ForEach-Object { $_.TrimEnd('\') }

  if ($normalizedEntries -contains $Entry.TrimEnd('\')) {
    return $CurrentPath
  }

  if ([string]::IsNullOrWhiteSpace($CurrentPath)) {
    return $Entry
  }

  return "$CurrentPath;$Entry"
}

$resolvedSdkPath = Resolve-AndroidSdkPath -ExplicitPath $SdkPath

if (-not $resolvedSdkPath) {
  Write-Error @"
Android SDK was not found.

Install Android Studio and Android SDK first, then rerun:
  pnpm android:sdk:windows

Or pass the path explicitly:
  powershell -ExecutionPolicy Bypass -File .\scripts\set-android-sdk-env.windows.ps1 -SdkPath "C:\Users\<you>\AppData\Local\Android\Sdk"
"@
}

$platformToolsPath = Join-Path $resolvedSdkPath "platform-tools"
$currentUserPath = [Environment]::GetEnvironmentVariable("Path", "User")
$updatedUserPath = Add-PathEntry -CurrentPath $currentUserPath -Entry $platformToolsPath
$repoRoot = Split-Path $PSScriptRoot -Parent
$localPropertiesPath = Join-Path $repoRoot "apps\mobile\android\local.properties"
$escapedSdkPath = $resolvedSdkPath -replace '\\', '\\'

[Environment]::SetEnvironmentVariable("ANDROID_HOME", $resolvedSdkPath, "User")
[Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", $resolvedSdkPath, "User")
[Environment]::SetEnvironmentVariable("Path", $updatedUserPath, "User")

$env:ANDROID_HOME = $resolvedSdkPath
$env:ANDROID_SDK_ROOT = $resolvedSdkPath
$env:Path = Add-PathEntry -CurrentPath $env:Path -Entry $platformToolsPath

Set-Content -Path $localPropertiesPath -Value "sdk.dir=$escapedSdkPath" -Encoding UTF8

Write-Host "[android:sdk:windows] ANDROID_HOME set to: $resolvedSdkPath"
Write-Host "[android:sdk:windows] ANDROID_SDK_ROOT set to: $resolvedSdkPath"
Write-Host "[android:sdk:windows] Added to user PATH: $platformToolsPath"
Write-Host "[android:sdk:windows] Wrote Android local.properties: $localPropertiesPath"
Write-Host "[android:sdk:windows] Restart PowerShell or your IDE to pick up the persisted PATH."
