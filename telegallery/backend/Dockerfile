# --- Build stage ---
FROM node:20-bookworm-slim AS build
WORKDIR /app

# sharp and fluent-ffmpeg need build tools + libvips at build time on some platforms
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# This package.json belongs to an npm workspaces monorepo — the lockfile lives only at
# the repo root, not here, so `npm ci` (which requires an exact matching lockfile in
# this same directory) isn't usable in this single-package Docker build context.
# `npm install` resolves from package.json directly instead.
COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Runtime stage ---
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

RUN mkdir -p /tmp/telegallery-uploads logs data

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
