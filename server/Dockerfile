# Multi-stage build for the API + realtime server.
FROM node:22-alpine AS builder
WORKDIR /app

# Install with the full workspace context so the engine package resolves.
COPY package.json package-lock.json ./
COPY packages/engine/package.json ./packages/engine/
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm ci --workspaces --include-workspace-root

COPY packages/engine ./packages/engine
COPY server ./server

RUN npm run build -w @connect4gg/engine \
  && npx prisma generate --schema server/prisma/schema.prisma \
  && npm run build -w @connect4gg/server

# Drop dev dependencies from the layer we actually ship.
RUN npm prune --omit=dev --workspaces --include-workspace-root

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# sharp needs these for image processing on musl.
RUN apk add --no-cache vips-dev

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/engine/dist ./packages/engine/dist
COPY --from=builder /app/packages/engine/package.json ./packages/engine/package.json
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/server/prisma ./server/prisma

RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Migrations run at boot so a deploy never serves against a stale schema.
CMD ["sh", "-c", "npx prisma migrate deploy --schema server/prisma/schema.prisma && node server/dist/index.js"]
