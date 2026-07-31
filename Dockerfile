FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
RUN npm ci --ignore-scripts --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_build_placeholder
ARG NEXT_PUBLIC_ENABLE_PHONE_AUTH=false
ARG NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=false
ARG NEXT_PUBLIC_ENABLE_APPLE_AUTH=false
ARG NEXT_PUBLIC_ENABLE_FACEBOOK_AUTH=false
ARG NEXT_PUBLIC_ENABLE_LIVE_STREAMING=false
ARG NEXT_PUBLIC_ENABLE_WEB_DRM=false
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_ENABLE_PHONE_AUTH=$NEXT_PUBLIC_ENABLE_PHONE_AUTH
ENV NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=$NEXT_PUBLIC_ENABLE_GOOGLE_AUTH
ENV NEXT_PUBLIC_ENABLE_APPLE_AUTH=$NEXT_PUBLIC_ENABLE_APPLE_AUTH
ENV NEXT_PUBLIC_ENABLE_FACEBOOK_AUTH=$NEXT_PUBLIC_ENABLE_FACEBOOK_AUTH
ENV NEXT_PUBLIC_ENABLE_LIVE_STREAMING=$NEXT_PUBLIC_ENABLE_LIVE_STREAMING
ENV NEXT_PUBLIC_ENABLE_WEB_DRM=$NEXT_PUBLIC_ENABLE_WEB_DRM
RUN npm run build --workspace @jalwa/web

FROM node:22-alpine AS web
WORKDIR /app
ENV NODE_ENV=production HOME=/tmp
COPY --chown=node:node --from=builder /app/apps/web/.next/standalone ./
COPY --chown=node:node --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --chown=node:node --from=builder /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --spider -q http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "apps/web/server.js"]

FROM node:22-bookworm-slim AS worker
WORKDIR /app
ENV NODE_ENV=production HOME=/tmp
ARG TARGETARCH
ARG SHAKA_PACKAGER_VERSION=3.7.2
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl ffmpeg && rm -rf /var/lib/apt/lists/* \
  && case "$TARGETARCH" in \
       amd64) binary_arch=x64; checksum=88b022b8cb12602ddb539972efd07a3496ea64f8662a484798c96e95afa41fd8 ;; \
       arm64) binary_arch=arm64; checksum=e4a43aaa8fdb87d0306876bc41581b371d7082e9d1b8469aef06a4e74004fd69 ;; \
       *) echo "Unsupported worker architecture: $TARGETARCH" >&2; exit 1 ;; \
     esac \
  && curl --fail --location --retry 3 -o /usr/local/bin/packager "https://github.com/shaka-project/shaka-packager/releases/download/v${SHAKA_PACKAGER_VERSION}/packager-linux-${binary_arch}" \
  && echo "${checksum}  /usr/local/bin/packager" | sha256sum -c - \
  && chmod 0755 /usr/local/bin/packager \
  && /usr/local/bin/packager --version
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node apps/worker ./apps/worker
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD ["node", "-e", "const fs=require('node:fs');const p=process.env.WORKER_HEARTBEAT_PATH||'/tmp/jalwa-worker-heartbeat';if(Date.now()-fs.statSync(p).mtimeMs>120000)process.exit(1)"]
CMD ["node", "apps/worker/src/index.mjs"]
