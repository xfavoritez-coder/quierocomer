import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Build connection URL for Supabase PgBouncer (transaction mode)
function getDbUrl(): string {
  const base = process.env.DATABASE_URL || "";
  const url = new URL(base);
  // 1 connection per serverless instance — PgBouncer multiplexes on the DB side
  url.searchParams.set("connection_limit", "1");
  // Fail fast if pool is exhausted instead of queuing indefinitely
  url.searchParams.set("pool_timeout", "5");
  // Required for PgBouncer transaction mode
  url.searchParams.set("pgbouncer", "true");
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
