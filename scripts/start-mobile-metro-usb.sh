#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-8081}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}/apps/mobile"

# Clean stale Metro cache before startup.
rm -rf .expo
rm -rf "${TMPDIR:-/tmp}"/metro-*

# Keep localhost USB flow, but disable Expo auth prompts in CLI.
export EXPO_OFFLINE=1

pnpm exec expo start --localhost --port "${PORT}" --clear
