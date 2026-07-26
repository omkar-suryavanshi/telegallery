# --- Build stage ---
FROM node:20-bookworm-slim AS build
WORKDIR /app

# This package.json belongs to an npm workspaces monorepo — the lockfile lives only at
# the repo root, not here, so `npm ci` (which requires an exact matching lockfile in
# this same directory) isn't usable in this single-package Docker build context.
COPY package*.json ./
RUN npm install

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Runtime stage ---
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
