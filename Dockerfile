# 🐳 One image for the scribbly monorepo - stage 2 builds only the REST API
FROM node:24-bookworm-slim

# 📦 pnpm version comes from "packageManager" in package.json
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

# 🔧 openssl is what Prisma's engine binary expects on slim Debian images
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 📄 Manifests first: this layer stays cached until a dependency changes
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/http-backend/package.json apps/http-backend/
COPY apps/ws-backend/package.json apps/ws-backend/
COPY apps/scribbly-frontend/package.json apps/scribbly-frontend/
COPY packages/backend-config/package.json packages/backend-config/
COPY packages/db-package/package.json packages/db-package/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/ui/package.json packages/ui/
COPY packages/zod-config/package.json packages/zod-config/

RUN pnpm install --frozen-lockfile

# 🗂️ Then the real source
COPY . .

# 🧬 prisma generate never connects - it only needs the variable to exist
RUN DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/scribbly \
    pnpm --filter @repo/db-package exec prisma generate --config prisma7.config.ts

# 🏗️ Compile the REST API
RUN pnpm --filter http-backend build

EXPOSE 3001
CMD ["node", "apps/http-backend/dist/index.js"]
