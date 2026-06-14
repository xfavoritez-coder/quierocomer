import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Build connection URL with conservative pool settings
function getDbUrl(): string {
  const base = process.env.DATABASE_URL || "";
  const url = new URL(base);
  // Max 5 connections per serverless instance (Supabase limit: 200 total)
  url.searchParams.set("connection_limit", "5");
  // Release idle connections after 10s
  url.searchParams.set("pool_timeout", "10");
  return url.toString();
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
    datasources: {
      db: { url: getDbUrl() },
    },
  });

// Always cache the instance to reuse connections across requests (Fluid Compute)
globalForPrisma.prisma = prisma;
