# Build stage
FROM node:25-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/finance-engine/package*.json ./packages/finance-engine/
COPY apps/api/package*.json ./apps/api/
COPY prisma ./prisma/

RUN npm ci --workspace=packages/shared --workspace=packages/finance-engine --workspace=apps/api \
	&& npx prisma generate

COPY packages/shared ./packages/shared/
COPY packages/finance-engine ./packages/finance-engine/
COPY apps/api ./apps/api/

RUN npm run build --workspace=packages/shared \
	&& npm run build --workspace=packages/finance-engine \
	&& npm run build --workspace=apps/api

# Runtime stage
FROM node:25-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/finance-engine/package.json ./packages/finance-engine/package.json
COPY --from=builder /app/packages/finance-engine/dist ./packages/finance-engine/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/prisma ./prisma

RUN mkdir -p /data

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node apps/api/dist/main.js"]
