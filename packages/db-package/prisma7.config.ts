// @ts-nocheck
import "dotenv/config"; // Loads your backend .env variables dynamically
import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing from your backend .env file!");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --import tsx src/seed.ts",
  },
  datasource: {
    url: databaseUrl, // 👈 Satisfies the exact requirement of the Prisma 7 CLI
  },
});
