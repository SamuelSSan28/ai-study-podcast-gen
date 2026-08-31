#!/bin/sh
set -e

# Named volume at /app/node_modules starts empty and hides image layers — install once.
if [ ! -d node_modules/@nestjs/core ]; then
  echo "Installing dependencies into container volume..."
  npm ci
fi

npm run db:migrate
exec npm run start:dev
