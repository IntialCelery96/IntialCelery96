# Build the SPA, then serve the static output through nginx.
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/engine/package.json ./packages/engine/
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm ci --workspaces --include-workspace-root

COPY packages/engine ./packages/engine
COPY web ./web

ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build -w @connect4gg/engine && npm run build -w @connect4gg/web

FROM nginx:alpine AS runtime
COPY --from=builder /app/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 5173
