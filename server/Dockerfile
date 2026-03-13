FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
# Prisma se ejecuta en postinstall durante npm ci; necesita esquema y config antes.
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npm run db:deploy && npm run start"]
