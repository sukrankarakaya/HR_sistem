import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { createPgAdapter } from "./pg-adapter";

// Geliştirmede hot reload her seferinde yeni bağlantı havuzu açmasın
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: createPgAdapter() });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
