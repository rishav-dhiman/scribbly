// @ts-nocheck
import "dotenv/config";
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
    url: databaseUrl, // the Prisma 7 CLI reads the datasource URL from here
  },
});
