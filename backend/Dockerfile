# -----------------------------------------------------------------------------
# PRIME AUTO BOT - Production Dockerfile (Linux Cloud / Render.com / Railway)
# -----------------------------------------------------------------------------

# Stage 1: Build TypeScript and Prisma client
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Install build prerequisites
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: Production Runner with Chromium & Arabic Typography Support
FROM node:20-bookworm-slim AS runner
WORKDIR /app

# Install Chromium for Puppeteer and Arabic fonts for flawless waybill PDF/PNG generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-kacst \
    fonts-noto-core \
    fonts-freefont-ttf \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Configure Puppeteer to use the system Chromium installation
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

# Create persistent storage directories
RUN mkdir -p storage/baileys_auth storage/waybills storage/receipts logs

EXPOSE 3000

# Push Prisma schema to SQLite on boot, then start the server
CMD ["sh", "-c", "npx prisma db push && node dist/server.js"]
