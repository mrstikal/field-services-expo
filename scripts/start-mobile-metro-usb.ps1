param(
  [int]$Port = 8081
)

$ErrorActionPreference = "Stop"

Set-Location "$PSScriptRoot\..\apps\mobile"

# Clean stale Metro cache before startup.
Remove-Item ".expo" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\metro-*" -Recurse -Force -ErrorAction SilentlyContinue

# Keep localhost USB flow, but disable Expo auth prompts in CLI.
$env:EXPO_OFFLINE = "1"

pnpm exec expo start --localhost --port $Port --clear
