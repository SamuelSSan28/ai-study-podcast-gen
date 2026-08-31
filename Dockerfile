FROM node:22-bookworm-slim AS development

RUN apt-get update \
  && apt-get install --no-install-recommends --yes ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY web ./web
COPY src ./src

ENV NODE_ENV=development
EXPOSE 3000

CMD ["sh", "-c", "npm run db:migrate && npm run start:dev"]

FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY web ./web
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install --no-install-recommends --yes ffmpeg \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/web ./web
RUN mkdir -p /app/data /app/storage/podcasts && chown -R node:node /app/data /app/storage

USER node
EXPOSE 3000

CMD ["sh", "-c", "npm run db:migrate && node dist/main.js"]
