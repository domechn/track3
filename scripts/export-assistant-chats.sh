#!/usr/bin/env bash
set -euo pipefail

out_path="${1:-$HOME/Desktop/track3-assistant-full-$(date +%F).json}"
app_data_dir="${2:-$HOME/Library/Application Support/dev.track3.track3}"

corepack yarn --silent tauri --version >/dev/null 2>&1 || true

cargo run --manifest-path src-tauri/Cargo.toml --bin export-assistant-chats -- \
  --app-data-dir "$app_data_dir" \
  --out "$out_path"

echo "JSON exported to: $out_path"
