import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL + (process.env.DATABASE_URL?.includes("connection_limit") ? "" : "&connection_limit=20"),
      },
    },
  });

// Always cache the instance to reuse connections across requests (Fluid Compute)
globalForPrisma.prisma = prisma;
