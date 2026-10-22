#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_PYTHON="$BACKEND_DIR/.venv/bin/python"
BACKEND_PID=""
FRONTEND_PID=""

find_free_port() {
  python3 -c '
import socket, sys
start = int(sys.argv[1])
for port in range(start, min(start + 100, 65536)):
    sock = socket.socket()
    try:
        sock.bind(("127.0.0.1", port))
    except OSError:
        continue
    else:
        print(port)
        sock.close()
        break
else:
    raise SystemExit(f"No free local port found starting at {start}")
' "$1"
}

stop_process_tree() {
  local process_id="$1"
  local child_id
  while IFS= read -r child_id; do
    [[ -z "$child_id" ]] || stop_process_tree "$child_id"
  done < <(pgrep -P "$process_id" 2>/dev/null || true)
  kill "$process_id" 2>/dev/null || true
}

cleanup() {
  trap - INT TERM EXIT
  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    stop_process_tree "$FRONTEND_PID"
  fi
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    stop_process_tree "$BACKEND_PID"
  fi
  [[ -z "$FRONTEND_PID" ]] || wait "$FRONTEND_PID" 2>/dev/null || true
  [[ -z "$BACKEND_PID" ]] || wait "$BACKEND_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

if ! command -v python3 >/dev/null 2>&1; then
  echo "Error: python3 is required to run the backend." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm (Node.js) is required to run the frontend." >&2
  exit 1
fi

if [[ ! -x "$BACKEND_PYTHON" ]]; then
  echo "Creating backend virtual environment and installing Python dependencies..."
  python3 -m venv "$BACKEND_DIR/.venv"
  "$BACKEND_PYTHON" -m pip install -r "$BACKEND_DIR/requirements.txt"
elif ! "$BACKEND_PYTHON" -c 'import fastapi, uvicorn, numpy, PIL' >/dev/null 2>&1; then
  echo "Installing missing backend dependencies..."
  "$BACKEND_PYTHON" -m pip install -r "$BACKEND_DIR/requirements.txt"
fi

if [[ ! -x "$FRONTEND_DIR/node_modules/.bin/vite" ]]; then
  echo "Installing frontend dependencies..."
  npm --prefix "$FRONTEND_DIR" install
fi

BACKEND_PORT="$(find_free_port 8000)"
FRONTEND_PORT="$(find_free_port 5173)"

(
  cd "$BACKEND_DIR"
  source "$BACKEND_DIR/.venv/bin/activate"
  exec python -m uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT" --reload
) &
BACKEND_PID=$!

(
  cd "$FRONTEND_DIR"
  export VITE_API_URL="http://127.0.0.1:$BACKEND_PORT"
  export VITE_DEMO_MODE=false
  exec npm run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT" --strictPort
) &
FRONTEND_PID=$!

printf 'Starting local development servers (backend virtual environment activated):\n'
printf '  Frontend: http://127.0.0.1:%s\n' "$FRONTEND_PORT"
printf '  Backend:  http://127.0.0.1:%s\n' "$BACKEND_PORT"
printf '  API docs: http://127.0.0.1:%s/docs\n' "$BACKEND_PORT"
printf '\nPress Ctrl+C to stop both servers.\n\n'

while true; do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    set +e
    wait "$BACKEND_PID"
    status=$?
    set -e
    exit "$status"
  fi
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    set +e
    wait "$FRONTEND_PID"
    status=$?
    set -e
    exit "$status"
  fi
  sleep 1
done
