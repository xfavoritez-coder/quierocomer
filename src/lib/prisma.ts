import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof makeClient> | undefined;
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

// Errores transitorios de conexión: la operación NO llegó a ejecutarse (falló al
// tomar/alcanzar la conexión), así que reintentar es seguro e idempotente.
//  P2024 = Timed out fetching a new connection from the connection pool
//  P1001 = Can't reach database server   P1002 = server terminated the connection
//  P1008 = Operations timed out          P1017 = Server has closed the connection
const RETRYABLE_CODES = new Set(["P2024", "P1001", "P1002", "P1008", "P1017"]);
function isRetryable(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  return typeof code === "string" && RETRYABLE_CODES.has(code);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Cliente con reintento automático (3 intentos: ~80ms, ~240ms) SOLO para los
// errores transitorios de conexión de arriba. Convierte un pico puntual del pool
// en una pequeña espera en vez de una caída (500) de la carta.
function makeClient() {
  const base = new PrismaClient({
    log: ["error"],
    datasources: { db: { url: getDbUrl() } },
  });
  return base.$extends({
    query: {
      async $allOperations({ args, query }) {
        let lastErr: unknown;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            return await query(args);
          } catch (e) {
            lastErr = e;
            if (!isRetryable(e) || attempt === 2) throw e;
            await sleep(80 * Math.pow(3, attempt)); // 80ms, 240ms
          }
        }
        throw lastErr;
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? makeClient();

// Always cache the instance to reuse connections across requests (Fluid Compute)
globalForPrisma.prisma = prisma;
