#!/usr/bin/env bash
# Copies dist/ into the user's GNOME Shell extensions directory.
set -euo pipefail

cd "$(dirname "$0")/.."
uuid=$(node -p "require('./static/metadata.json').uuid")
target="$HOME/.local/share/gnome-shell/extensions/$uuid"

rm -rf "$target"
mkdir -p "$target"
cp -r dist/. "$target"
echo "Installed to $target"
echo "On Wayland, log out and back in to load it, then run: gnome-extensions enable $uuid"
