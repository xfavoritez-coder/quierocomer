import { PrismaClient } from "@prisma/client";

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
export function isRetryable(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  if (typeof code === "string" && RETRYABLE_CODES.has(code)) return true;
  // OS-level TCP reset (Windows 10054 / POSIX ECONNRESET) aparece en el mensaje.
  const msg = String((e as any)?.message ?? "");
  return msg.includes("ConnectionReset") || msg.includes("ECONNRESET") || msg.includes("10054");
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeBase(): PrismaClient {
  return new PrismaClient({ log: ["error"], datasources: { db: { url: getDbUrl() } } });
}

// Cliente con reintento automático por operación (3 intentos: ~80ms, ~240ms) SOLO
// para los errores transitorios de conexión de arriba. Convierte un pico puntual
// del pool en una pequeña espera en vez de una caída (500).
// OJO: este reintento por-operación NO debe usarse dentro de transacciones
// interactivas (una tx que falla se aborta entera); para eso está runInTx().
function withRetry(base: PrismaClient) {
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

type ExtendedClient = ReturnType<typeof withRetry>;

const globalForPrisma = globalThis as unknown as {
  prismaBase?: PrismaClient;
  prisma?: ExtendedClient;
};

// Cliente base (sin la extensión de reintento). Úsalo para transacciones
// interactivas vía runInTx(); comparte el pool con `prisma`.
export const prismaBase: PrismaClient = globalForPrisma.prismaBase ?? makeBase();
globalForPrisma.prismaBase = prismaBase;

// Cliente por defecto (con reintento por operación) para lecturas/escrituras sueltas.
export const prisma: ExtendedClient = globalForPrisma.prisma ?? withRetry(prismaBase);
globalForPrisma.prisma = prisma;

/**
 * Ejecuta una transacción interactiva reintentando el BLOQUE COMPLETO ante un
 * error transitorio de conexión. Es seguro porque una transacción fallida hace
 * rollback total y se vuelve a intentar desde cero (nunca aplica dos veces un
 * increment/decrement). Usa el cliente base (sin reintento por operación).
 */
export async function runInTx<T>(
  fn: (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<T>,
  opts?: { maxWait?: number; timeout?: number }
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prismaBase.$transaction(fn as any, opts);
    } catch (e) {
      lastErr = e;
      if (!isRetryable(e) || attempt === 2) throw e;
      await sleep(80 * Math.pow(3, attempt));
    }
  }
  throw lastErr;
}
