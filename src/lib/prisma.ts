import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof makeClient> | undefined;
};

// Build connection URL for Supabase PgBouncer (transaction mode)
function getDbUrl(): string {
  const base = process.env.DATABASE_URL || "";
  const url = new URL(base);
  if (process.env.NODE_ENV === "production") {
    // PgBouncer transaction mode: 1 conexión por instancia es suficiente.
    // Con tráfico alto Vercel escala a 100+ instancias → 1×100=100 conex, bajo el límite Pro.
    // Antes connection_limit=3 causaba saturación en picos de tráfico.
    url.searchParams.set("connection_limit", "1");
    url.searchParams.set("pool_timeout", "30");
    url.searchParams.set("connect_timeout", "10");
    url.searchParams.set("pgbouncer", "true");
  } else {
    // Dev: más conexiones para soportar hot-reload y requests paralelos
    url.searchParams.set("connection_limit", "3");
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
  // Prisma P-codes
  const code = (e as { code?: string } | null)?.code;
  if (typeof code === "string" && RETRYABLE_CODES.has(code)) return true;
  // OS-level TCP reset (e.g. Supabase PgBouncer corta la conexión bajo carga):
  // Windows 10054 / POSIX ECONNRESET — aparece en el mensaje del error
  const msg = String((e as any)?.message ?? "");
  return msg.includes("ConnectionReset") || msg.includes("ECONNRESET") || msg.includes("10054");
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
