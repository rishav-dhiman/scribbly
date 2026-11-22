import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/index.js";

const databaseUrl = process.env.DATABASE_URL;

const prismaClientSingleton = () => {
  const pool = new Pool({
    connectionString: databaseUrl,
    // Default is 10s: any pause longer than that drops the socket and the next
    // request pays a full TCP + TLS reconnect (~0.8s to Singapore). Keep it 60s.
    idleTimeoutMillis: 60_000,
    // Let the OS detect a dead socket instead of failing a query with it
    keepAlive: true,
    // Don't let idle sockets hold scripts open (the seed hung after its last log);
    // long-running servers stay alive via their own listener anyway
    allowExitOnIdle: true,
  });

  // Prisma 7 instantiates the client through a driver adapter
  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter });
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

// One client per process in dev: module reloads reuse the global instead of
// leaking a new pool on every re-import.
export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env["NODE_ENV"] !== "production") globalThis.prismaGlobal = prisma;

// Re-export all underlying database types (like User, Room, Chat)
export * from "./generated/prisma/index.js";
