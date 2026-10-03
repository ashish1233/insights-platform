#!/usr/bin/env bash
#
# Start everything needed to look at the hub in a browser, and leave it running.
#
#   ./scripts/run-hub.sh        then open http://localhost:5100
#
# Installs what is missing on first run. Ctrl-C stops everything it started.
#
# Expects the six repositories checked out side by side — see the README's
# "Getting the code".

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
SDK="$ROOT/insights-sdk-python"
PY="$SDK/.venv/bin/python"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
die()  { printf '  \033[31m✗\033[0m %s\n' "$*"; exit 1; }

PIDS=()
cleanup() {
  printf '\n\033[1mstopping\033[0m\n'
  for pid in ${PIDS+"${PIDS[@]}"}; do kill "$pid" 2>/dev/null; done
  wait 2>/dev/null
}
trap cleanup EXIT INT TERM

for d in "$SDK" "$ROOT/insights-ui-kit" "$ROOT/finance-spend-explorer" \
         "$ROOT/people-analytics-dashboard"; do
  [[ -d "$d" ]] || die "Missing $d — the six repositories must sit side by side."
done
command -v uv   >/dev/null || die "uv is not installed: https://docs.astral.sh/uv/"
command -v npm  >/dev/null || die "npm is not installed."

for port in 5100 5173 5174 8000 8081 8082 8083; do
  if lsof -ti "tcp:$port" >/dev/null 2>&1; then
    die "Port $port is in use. Free them: lsof -ti tcp:5100,tcp:5173,tcp:5174,tcp:8000,tcp:8081,tcp:8082,tcp:8083 | xargs kill -9"
  fi
done

say "preparing (first run only)"
if [[ ! -x "$PY" ]]; then
  printf '  installing the SDK… '
  (cd "$SDK" && uv venv -q .venv && uv pip install -q --python .venv/bin/python -e ".[dev]") \
    && echo done || die "SDK install failed"
fi
if [[ ! -x "$ROOT/people-analytics-dashboard/backend/.venv/bin/python" ]]; then
  printf '  installing the dashboard backend… '
  (cd "$ROOT/people-analytics-dashboard/backend" && uv venv -q .venv \
     && uv pip install -q --python .venv/bin/python -e "$SDK" -e .) \
    && echo done || die "dashboard install failed"
fi
# The UI kit must be built before anything that imports it, and npm workspaces
# are deliberately not used here — these are separate repositories (ADR-1).
for pkg in "$ROOT/insights-ui-kit" "$HERE/packages/shell" \
           "$ROOT/finance-spend-explorer/frontend" \
           "$ROOT/people-analytics-dashboard/frontend"; do
  if [[ ! -d "$pkg/node_modules" ]]; then
    printf '  npm install in %s… ' "$(basename "$(dirname "$pkg")")/$(basename "$pkg")"
    (cd "$pkg" && npm install --silent >/dev/null 2>&1) && echo done || die "npm install failed in $pkg"
  fi
done
if [[ ! -d "$ROOT/insights-ui-kit/dist" ]]; then
  printf '  building the UI kit… '
  (cd "$ROOT/insights-ui-kit" && npm run build >/dev/null 2>&1) && echo done || die "ui-kit build failed"
fi

LOGS="$(mktemp -d)"
start() { # name, port, command...
  local name="$1" port="$2"; shift 2
  ( "$@" >"$LOGS/$name.log" 2>&1 ) &
  PIDS+=($!)
  for _ in $(seq 160); do
    curl -sf -o /dev/null "http://localhost:$port" && { ok "$name on :$port"; return 0; }
    sleep 0.25
  done
  printf '  \033[31m✗\033[0m %s did not start:\n' "$name"; sed 's/^/      /' "$LOGS/$name.log" | tail -15
  exit 1
}

say "stubbed infrastructure"
for svc in idp:8081 warehouse:8082 auditlog:8083; do
  n="${svc%%:*}"; p="${svc##*:}"
  ( cd "$HERE/stubs/$n" && "$PY" -m uvicorn "${n}_stub:app" --port "$p" --log-level error \
      >"$LOGS/$n.log" 2>&1 ) &
  PIDS+=($!)
done
for svc in idp:8081 warehouse:8082 auditlog:8083; do
  n="${svc%%:*}"; p="${svc##*:}"
  for _ in $(seq 160); do curl -sf -o /dev/null "localhost:$p/health" && break; sleep 0.25; done
  curl -sf -o /dev/null "localhost:$p/health" && ok "$n on :$p" \
    || { printf '  ✗ %s failed:\n' "$n"; tail -12 "$LOGS/$n.log" | sed 's/^/      /'; exit 1; }
done

say "applications"
( cd "$ROOT/people-analytics-dashboard/backend" \
  && INSIGHTS_TENANT_ID=people-analytics INSIGHTS_TIER=restricted \
     INSIGHTS_IDP_URL=http://localhost:8081 \
     INSIGHTS_WAREHOUSE_URL=http://localhost:8082 \
     INSIGHTS_AUDIT_URL=http://localhost:8083 \
     ./.venv/bin/python -m uvicorn dashboard.main:app --port 8000 --log-level error \
     >"$LOGS/dashboard-api.log" 2>&1 ) &
PIDS+=($!)
for _ in $(seq 160); do curl -sf -o /dev/null localhost:8000/health && break; sleep 0.25; done
curl -sf -o /dev/null localhost:8000/health && ok "dashboard API on :8000" \
  || { printf '  ✗ dashboard API failed:\n'; tail -12 "$LOGS/dashboard-api.log" | sed 's/^/      /'; exit 1; }

start "hub"                5100 bash -c "cd '$HERE/packages/shell' && npm run dev"
start "spend explorer"     5174 bash -c "cd '$ROOT/finance-spend-explorer/frontend' && npm run dev"
start "compensation app"   5173 bash -c "cd '$ROOT/people-analytics-dashboard/frontend' && npm run dev"

say "ready"
cat <<'EOF'
  Open  http://localhost:5100

  Sign in with tenant `finance` and any user — the compensation app is absent
  from the directory, because that user does not hold insights:read_sensitive.
  Sign in on tenant `people-analytics` with that scope and it appears.

  Ctrl-C to stop everything.
EOF
printf '\n  logs: %s\n\n' "$LOGS"
wait
