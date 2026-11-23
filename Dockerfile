# Stage 1: Build Expo Web PWA
FROM node:22-slim AS web-builder
WORKDIR /app/mobile
COPY mobile/package.json mobile/package-lock.json ./
RUN npm ci
COPY mobile/ ./
RUN npx expo export --platform web --output-dir /app/web-public

# Stage 2: Build Backend API + Prisma Client (PostgreSQL)
FROM node:22-slim AS api-builder
WORKDIR /app/backend
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/prisma ./prisma
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npx prisma generate --schema=prisma/schema.prisma && npm run build

# Stage 3: Production Runtime
FROM node:22-slim AS runtime
WORKDIR /app/backend
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV PORT=4000

COPY --from=api-builder /app/backend/package.json ./
COPY --from=api-builder /app/backend/node_modules ./node_modules
COPY --from=api-builder /app/backend/prisma ./prisma
COPY --from=api-builder /app/backend/dist ./dist
COPY --from=web-builder /app/web-public ./public

EXPOSE 4000

CMD ["node", "dist/server.js"]
