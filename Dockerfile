FROM node:22-alpine AS build
WORKDIR /app
# openssl dibutuhkan engine Prisma di Alpine.
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --chown=node:node package.json ./
# Jangan jalan sebagai root.
USER node
EXPOSE 3000
# Migrasi selalu jalan. Seed akun demo HANYA bila SEED_DEMO=true (default image: mati),
# supaya kredensial demo di README tidak pernah ikut ke deployment nyata.
CMD ["sh", "-c", "npx prisma migrate deploy && { [ \"$SEED_DEMO\" != \"true\" ] || node dist/seed.js; } && node dist/main.js"]
