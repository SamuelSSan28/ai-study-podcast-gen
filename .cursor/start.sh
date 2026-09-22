#!/usr/bin/env bash
# Per-boot reconciliation: start Redis and apply SQLite migrations, then return.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Ensuring Redis is running"
if redis-cli ping >/dev/null 2>&1; then
  echo "    Redis already responding"
else
  redis-server --daemonize yes --save '' --appendonly no
  for _ in $(seq 1 20); do
    if redis-cli ping >/dev/null 2>&1; then break; fi
    sleep 0.5
  done
  if ! redis-cli ping >/dev/null 2>&1; then
    echo "    ERROR: Redis did not become ready" >&2
    exit 1
  fi
  echo "    Redis is ready"
fi

echo "==> Applying database migrations (idempotent)"
mkdir -p data storage/podcasts
npm run db:migrate

echo "==> Start complete"
