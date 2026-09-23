# -----------------------------------------------------------------------------
# PRIME AUTO BOT - Production Dockerfile (Backend Root Context)
# Compatible with: Koyeb, Zeabur, Back4App, Railway, Render (100% Cloud-Native)
# -----------------------------------------------------------------------------

# Stage 1: Build TypeScript and Prisma client
FROM node:20-bookworm-slim AS builder
WORKDIR /app

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
    PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

# Create storage and logs with full write permissions
RUN mkdir -p storage/baileys_auth storage/waybills storage/receipts logs prisma && \
    chmod -R 777 /app

EXPOSE 3000 8080 7860

# Apply migrations to Database (PostgreSQL / SQLite) and start server
CMD ["sh", "-c", "export DATABASE_URL=\"${DATABASE_URL:-${POSTGRES_CONNECTION_STRING:-${POSTGRES_URI}}}\" && npx prisma db push --skip-generate && node dist/server.js"]
