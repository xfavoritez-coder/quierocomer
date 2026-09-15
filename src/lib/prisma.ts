import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Build connection URL for Supabase PgBouncer (transaction mode)
function getDbUrl(): string {
  const base = process.env.DATABASE_URL || "";
  const url = new URL(base);
  if (process.env.NODE_ENV === "production") {
    // Fluid Compute reutiliza instancias para requests concurrentes — necesita > 1 conexión.
    // 3 conexiones por instancia × max ~20 instancias = 60 conexiones a PgBouncer, dentro del límite Pro.
    url.searchParams.set("connection_limit", "3");
    url.searchParams.set("pool_timeout", "20");
    url.searchParams.set("pgbouncer", "true");
  } else {
    // Dev: más conexiones para soportar hot-reload y requests paralelos
    url.searchParams.set("connection_limit", "5");
    url.searchParams.set("pool_timeout", "15");
  }
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
