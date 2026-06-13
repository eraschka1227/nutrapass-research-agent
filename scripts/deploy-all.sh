#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERIFY_URL="${NUTRAPASS_VERIFY_URL:-https://nutrapass-widget.pages.dev}"
WORKER_URL="${NUTRAPASS_WORKER_URL:-https://nutrapass-ai.eric-012.workers.dev}"
SKIP_WORKER=0
SKIP_WIDGET=0
SKIP_BROWSER=0

usage() {
  cat <<'USAGE'
Usage: scripts/deploy-all.sh [--skip-worker] [--skip-widget] [--skip-browser]

One-command NutraPass production deploy:
  1. Runs regression tests.
  2. Deploys the Cloudflare Worker backend unless skipped.
  3. Deploys the Cloudflare Pages widget unless skipped.
  4. Performs lightweight live URL verification.

Environment overrides:
  NUTRAPASS_VERIFY_URL   Widget production URL (default: https://nutrapass-widget.pages.dev)
  NUTRAPASS_WORKER_URL   Worker production URL (default: https://nutrapass-ai.eric-012.workers.dev)
  CLOUDFLARE_API_TOKEN   Required for non-interactive Cloudflare deploys.
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --skip-worker) SKIP_WORKER=1 ;;
    --skip-widget) SKIP_WIDGET=1 ;;
    --skip-browser) SKIP_BROWSER=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; usage; exit 2 ;;
  esac
done

cd "$ROOT_DIR"

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "ERROR: CLOUDFLARE_API_TOKEN is not set, so this cannot deploy non-interactively." >&2
  echo "Set it in the Hermes/service environment or run a manual wrangler login." >&2
  exit 1
fi

echo "==> Checking Cloudflare auth"
npx --yes wrangler whoami >/dev/null

echo "==> Running regression tests"
npm test

if [[ $SKIP_WORKER -eq 0 ]]; then
  echo "==> Deploying Cloudflare Worker backend"
  npx wrangler deploy --keep-vars
else
  echo "==> Skipping Worker deploy"
fi

if [[ $SKIP_WIDGET -eq 0 ]]; then
  echo "==> Deploying Cloudflare Pages widget"
  bash scripts/deploy-widget.sh --skip-tests
else
  echo "==> Skipping widget deploy"
fi

if [[ $SKIP_BROWSER -eq 0 ]]; then
  echo "==> Verifying live Worker health endpoint: $WORKER_URL"
  python3 - "$WORKER_URL" <<'PY'
import sys, urllib.request
url = sys.argv[1]
req = urllib.request.Request(url, headers={"User-Agent": "NutraPassDeployCheck/1.0"})
with urllib.request.urlopen(req, timeout=20) as resp:
    body = resp.read(2000).decode("utf-8", "replace")
    if resp.status != 200 or "NutraPass AI Worker" not in body:
        raise SystemExit(f"Worker health check failed: status={resp.status}")
print("Worker health check OK")
PY

  echo "==> Verifying live widget URL: $VERIFY_URL"
  python3 - "$VERIFY_URL" <<'PY'
import sys, urllib.request
url = sys.argv[1]
req = urllib.request.Request(url, headers={"User-Agent": "NutraPassDeployCheck/1.0"})
with urllib.request.urlopen(req, timeout=20) as resp:
    body = resp.read(100000).decode("utf-8", "replace")
    required = ["Research", "Agent", "Privacy", "not intended to diagnose, treat, cure, or prevent"]
    missing = [item for item in required if item not in body]
    if resp.status != 200 or missing:
        raise SystemExit(f"Widget check failed: status={resp.status}, missing={missing}")
print("Widget live check OK")
PY
else
  echo "==> Skipping live URL checks"
fi

echo "==> NutraPass deploy complete"
echo "Widget: $VERIFY_URL"
echo "Worker: $WORKER_URL"
