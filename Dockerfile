FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
RUN npm install

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
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_ENABLE_PHONE_AUTH=$NEXT_PUBLIC_ENABLE_PHONE_AUTH
ENV NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=$NEXT_PUBLIC_ENABLE_GOOGLE_AUTH
ENV NEXT_PUBLIC_ENABLE_APPLE_AUTH=$NEXT_PUBLIC_ENABLE_APPLE_AUTH
ENV NEXT_PUBLIC_ENABLE_FACEBOOK_AUTH=$NEXT_PUBLIC_ENABLE_FACEBOOK_AUTH
RUN npm run build --workspace @jalwa/web

FROM node:22-alpine AS web
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

FROM node:22-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache ffmpeg
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY apps/worker ./apps/worker
CMD ["node", "apps/worker/src/index.mjs"]
