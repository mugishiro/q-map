#!/usr/bin/env bash
set -euo pipefail

# Quick helper to run the frontend dev server on the SSH host.
# - Binds to 0.0.0.0 so it is reachable via SSH port-forward.
# - Installs dependencies on first run.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="${ROOT_DIR}/frontend"
PORT="${PORT:-5173}"
HOST="0.0.0.0"

echo "Frontend dir: ${FRONTEND_DIR}"

if [ ! -d "${FRONTEND_DIR}/node_modules" ]; then
  echo "node_modules not found. Running npm install..."
  (cd "${FRONTEND_DIR}" && npm install)
fi

server_host="$(hostname -f 2>/dev/null || hostname)"
echo "Starting Vite dev server on ${HOST}:${PORT}"
echo "From your local machine, create a tunnel and open the browser:"
echo "  ssh -N -L ${PORT}:localhost:${PORT} ${USER}@${server_host}"
echo "  then open http://localhost:${PORT}"
echo

cd "${FRONTEND_DIR}"
npm run dev -- --host "${HOST}" --port "${PORT}"
