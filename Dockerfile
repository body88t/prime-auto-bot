# -----------------------------------------------------------------------------
# PRIME AUTO BOT - Universal Production Dockerfile
# Compatible with: Koyeb, Zeabur, Back4App, Railway, Render (100% Cloud-Native)
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

# Configure Puppeteer and Ports
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    PORT=7860

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

# Create storage and logs with full write permissions for non-root containers
RUN mkdir -p storage/baileys_auth storage/waybills storage/receipts logs prisma && \
    chmod -R 777 /app

EXPOSE 3000 8080 7860

# Apply migrations to Database (PostgreSQL / SQLite) and start server
CMD ["sh", "-c", "export DATABASE_URL=\"${DATABASE_URL:-${POSTGRES_CONNECTION_STRING:-${POSTGRES_URI}}}\" && npx prisma db push --skip-generate && node dist/server.js"]
