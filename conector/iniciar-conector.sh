#!/usr/bin/env bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  O Node.js não foi encontrado."
  echo "  Instale em https://nodejs.org e rode este arquivo de novo."
  echo
  exit 1
fi
( sleep 1; (command -v xdg-open >/dev/null && xdg-open http://localhost:8787) || (command -v open >/dev/null && open http://localhost:8787) ) >/dev/null 2>&1 &
node conector.mjs
