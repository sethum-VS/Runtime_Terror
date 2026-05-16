#!/usr/bin/env bash
# VoiceTale — local dev: provision Python venv + Node deps, then start FastAPI + Next.js.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${ROOT}/backend"
FRONTEND_DIR="${ROOT}/frontend"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

die() {
  echo "error: $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

echo "==> VoiceTale run ($(uname -s))"

require_cmd python3
require_cmd node
require_cmd npm

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "warn: ffmpeg not found on PATH. Docker image installs it; local audio tooling may need: brew install ffmpeg" >&2
fi

# ----- Backend -----
echo "==> Backend: venv + dependencies"
cd "${BACKEND_DIR}"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
# shellcheck source=/dev/null
source .venv/bin/activate
python -m pip install --upgrade pip >/dev/null
pip install -r requirements.txt

if [[ ! -f .env ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example .env
    echo "warn: created backend/.env from .env.example — add API keys before expecting full pipeline." >&2
  else
    die "backend/.env missing and no .env.example to copy"
  fi
fi

BACK_PID=""
FRONT_PID=""

cleanup() {
  echo ""
  echo "==> Shutting down"
  [[ -n "${BACK_PID}" ]] && kill "${BACK_PID}" 2>/dev/null || true
  [[ -n "${FRONT_PID}" ]] && kill "${FRONT_PID}" 2>/dev/null || true
  [[ -n "${BACK_PID}" ]] && wait "${BACK_PID}" 2>/dev/null || true
  [[ -n "${FRONT_PID}" ]] && wait "${FRONT_PID}" 2>/dev/null || true
  echo "==> Stopped."
}
# Single EXIT trap avoids duplicate cleanup on Ctrl+C (INT) + EXIT.
trap cleanup EXIT

echo "==> Starting FastAPI (http://127.0.0.1:${BACKEND_PORT})"
uvicorn app.main:app --reload --host 127.0.0.1 --port "${BACKEND_PORT}" &
BACK_PID=$!

# ----- Frontend -----
echo "==> Frontend: npm dependencies"
cd "${FRONTEND_DIR}"
if [[ ! -f .env.local ]]; then
  if [[ -f .env.local.example ]]; then
    cp .env.local.example .env.local
    echo "warn: created frontend/.env.local from .env.local.example" >&2
  fi
fi
npm install

echo "==> Starting Next.js (http://127.0.0.1:${FRONTEND_PORT})"
# Next.js 15 respects PORT
PORT="${FRONTEND_PORT}" npm run dev &
FRONT_PID=$!

echo ""
echo "----------------------------------------------------------------"
echo "  Backend:  http://127.0.0.1:${BACKEND_PORT}  (API docs: /docs)"
echo "  Frontend: http://127.0.0.1:${FRONTEND_PORT}"
echo "  Press Ctrl+C to stop both servers."
echo "----------------------------------------------------------------"
wait
