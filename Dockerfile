# -----------------------------------------------------------------------------
# PRIME AUTO BOT - Universal Production Dockerfile
# Compatible with: Hugging Face Spaces (100% FREE - NO CREDIT CARD), Render, Railway
# -----------------------------------------------------------------------------

# Stage 1: Build TypeScript and Prisma client
FROM node:20-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm ci

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# Stage 2: Production Runner with Chromium & Arabic Typography Support
FROM node:20-bookworm-slim AS runner
WORKDIR /app

# Install Chromium for Puppeteer and Arabic fonts for flawless waybill generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-kacst \
    fonts-noto-core \
    fonts-freefont-ttf \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Configure Puppeteer and Ports (7860 for Hugging Face Spaces, 3000 for standard)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    PORT=7860

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

# Create storage and logs with full write permissions for non-root containers (HuggingFace UID 1000)
RUN mkdir -p storage/baileys_auth storage/waybills storage/receipts logs prisma && \
    chmod -R 777 /app

EXPOSE 7860 3000

# Apply migrations to SQLite and start server
CMD ["sh", "-c", "npx prisma db push && node dist/server.js"]
