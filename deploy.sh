#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
case "${1:-start}" in
  setup) make setup build ;;
  start) exec .venv/bin/python run_web_app.py ;;
  *) echo 'Usage: ./deploy.sh [setup|start]' >&2; exit 2 ;;
esac
