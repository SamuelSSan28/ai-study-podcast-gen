#!/usr/bin/env bash
# Idempotent dependency + repository bootstrap for the Cloud Agent environment.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing system packages (redis-server, ffmpeg)"
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -qq
sudo apt-get install -y -qq --no-install-recommends redis-server ffmpeg

echo "==> Installing Node dependencies (npm ci runs postinstall: prisma generate)"
npm ci

echo "==> Ensuring runtime directories exist"
mkdir -p data storage/podcasts

echo "==> Seeding development .env (only if absent; real Cloud secrets win)"
if [ ! -f .env ]; then
  cp .cursor/dev.env .env
  echo "    created .env from .cursor/dev.env"
else
  echo "    .env already present; leaving it untouched"
fi

echo "==> Install complete"
