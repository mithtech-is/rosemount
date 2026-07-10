#!/bin/bash
# Switch the live Rosemount HQ dashboard UI between saved versions — no rebuild needed.
#   Usage (inside WSL):  bash rmdash-ui.sh original     # revert to the pre-polish UI
#                        bash rmdash-ui.sh polished     # the polished UI
#                        bash rmdash-ui.sh list         # show available versions
set -e
PUB=~/frappe-bench/apps/rosemount_dashboard/rosemount_dashboard/public
cd "$PUB"

case "$1" in
  original|polished)
    SRC="rmdash-$1"
    if [ ! -d "$SRC" ]; then echo "No saved version '$SRC' in $PUB"; exit 1; fi
    rm -rf rmdash && cp -r "$SRC" rmdash
    cd ~/frappe-bench && bench --site rosemount clear-cache >/dev/null 2>&1 || true
    echo "Now serving the '$1' UI. Hard-refresh the browser (Ctrl+Shift+R)."
    ;;
  list|"")
    echo "Available saved versions in $PUB:"; ls -d rmdash-* 2>/dev/null | sed 's#.*/##'
    echo; echo "Usage: bash rmdash-ui.sh [original|polished]"
    ;;
  *)
    echo "Unknown option '$1'. Use: original | polished | list"; exit 1
    ;;
esac
