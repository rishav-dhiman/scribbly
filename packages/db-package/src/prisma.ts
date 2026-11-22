import "dotenv/config";
import {Pool} from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/index.js";

const databaseUrl = process.env.DATABASE_URL;

const prismaClientSingleton = () => {
  // 1. Establish a standard connection pool using your environment variable
  const pool = new Pool({
    connectionString: databaseUrl,
    // 🔁 Default is 10s: any pause longer than that drops the socket and the next
    // request pays a full TCP + TLS reconnect (~0.8s to Singapore). Keep it 60s.
    idleTimeoutMillis: 60_000,
    // 📡 Let the OS detect a dead socket instead of failing a query with it
    keepAlive: true,
    // 🚪 Don't let idle sockets hold scripts open (seed hung after its last log);
    // long-running servers stay alive via their own listener anyway
    allowExitOnIdle: true,
  });
  
  // 2. Wrap the pool inside Prisma's driver adapter wrapper
  const adapter = new PrismaPg(pool);

  // 3. Instantiate the client by passing the adapter (Required by Prisma 7)
  return new PrismaClient({ adapter });
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env["NODE_ENV"] !== "production") globalThis.prismaGlobal = prisma;

// Re-export all underlying database types (like User, Room, Chat)
export * from "./generated/prisma/index.js";


// ==========================================
// 💡 QUICK REFERENCE FOR YOUR BACKEND IMPORT SYNTAX:
// ==========================================
// inside apps/http-backend/src/routes.ts
// import { prisma, type User, type Room } from "@repo/db-package";
