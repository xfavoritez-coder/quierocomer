// ═══════════════════════════════════════════════════════════
//  SharkPOS — emisión de DTE (boletas electrónicas) al SII de Chile.
//  BACKEND ONLY. La API key va en process.env.SHARKPOS_API_KEY (nunca en el
//  navegador ni en el código). El RUT emisor lo deriva SharkPOS de la key.
//
//  Guía:    https://api.sharkpos.cl/docs/agentes.md
//  OpenAPI: https://api.sharkpos.cl/docs/openapi.yaml
//
//  Idempotencia: una key ESTABLE por venta (`venta-<id>`). Ante red/5xx/429 se
//  reintenta con la MISMA key y el MISMO body (nunca se emite de nuevo con otra
//  key). El resultado final del SII llega por webhook (ver /api/sharkpos/webhook).
// ═══════════════════════════════════════════════════════════

const SANDBOX = (process.env.SHARKPOS_ENV || "sandbox") !== "production";
const BASE = SANDBOX ? "https://sandbox.sharkpos.cl" : "https://api.sharkpos.cl";

export function sharkposConfigured(): boolean {
  return !!process.env.SHARKPOS_API_KEY;
}
export function sharkposEnv(): "sandbox" | "production" {
  return SANDBOX ? "sandbox" : "production";
}

export interface BoletaItemInput {
  name: string;
  qty: number;
  /** Precio unitario CON IVA (boleta 39). */
  price: number;
  description?: string;
}

export interface EmitBoletaInput {
  /** Identificador estable de la venta (8–128 chars), p. ej. `venta-<posOrderId>`. */
  idempotencyKey: string;
  /** Monto total con IVA. Debe ser igual a la suma de qty*price de las líneas. */
  amountTotal: number;
  items: BoletaItemInput[];
  /** 39 afecta (default) · 41 exenta. */
  documentType?: 39 | 41;
  /** Correo del cliente para enviarle la boleta (opcional). */
  receptorEmail?: string;
}

export interface SharkposResult {
  httpStatus: number;
  /** success | processing | error | ok (según endpoint). */
  status?: string;
  dteId?: string;
  folio?: number;
  documentType?: number;
  dteStatus?: string;
  publicStatus?: string;
  idempotencyReplayed?: boolean;
  isFinal?: boolean;
  requiresAttention?: boolean;
  links?: { status?: string; pdf?: string; xml?: string; ted?: string; ted_png?: string };
  pdfUrl?: string;
  publicUrl?: string;
  code?: string;
  message?: string;
  raw: Record<string, unknown>;
}

function authHeaders(idempotencyKey?: string): Record<string, string> {
  const key = process.env.SHARKPOS_API_KEY;
  if (!key) throw new Error("SHARKPOS_API_KEY no configurada");
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
  if (idempotencyKey) h["Idempotency-Key"] = idempotencyKey;
  return h;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Los links de SharkPOS vienen como rutas relativas (p. ej. "/api/v1/dte/.../pdf/").
// Se absolutizan contra el host del entorno para que sean usables tal cual.
export function sharkposAbsoluteUrl(u?: string): string | undefined {
  return u && u.startsWith("/") ? `${BASE}${u}` : u;
}
const abs = sharkposAbsoluteUrl;

function toResult(httpStatus: number, d: Record<string, any>): SharkposResult {
  const l = d.links || {};
  return {
    httpStatus,
    status: d.status,
    dteId: d.dte_id,
    folio: d.folio,
    documentType: d.document_type,
    dteStatus: d.dte_status,
    publicStatus: d.public_status,
    idempotencyReplayed: d.idempotency_replayed,
    isFinal: d.is_final,
    requiresAttention: d.requires_attention,
    links: d.links
      ? { status: abs(l.status), pdf: abs(l.pdf), xml: abs(l.xml), ted: abs(l.ted), ted_png: abs(l.ted_png) }
      : undefined,
    pdfUrl: abs(d.pdf_url),
    publicUrl: d.public_url, // ya es absoluto (consulta pública)
    code: d.code,
    message: d.message,
    raw: d,
  };
}

/**
 * Emite una boleta electrónica. IDEMPOTENTE por `idempotencyKey`.
 * Reintenta SOLO ante fallos transitorios (red, 5xx, 429) con la misma key y
 * el mismo body. Un 400 (body inválido) NO se reintenta: se devuelve el error.
 */
export async function emitBoleta(input: EmitBoletaInput): Promise<SharkposResult> {
  const body = {
    document_type: input.documentType ?? 39,
    amount_total: input.amountTotal,
    items: input.items.map((i) => ({
      name: (i.name || "").slice(0, 80),
      qty: i.qty,
      price: i.price,
      ...(i.description ? { description: i.description.slice(0, 1000) } : {}),
    })),
    ...(input.receptorEmail ? { receptor_email: input.receptorEmail } : {}),
  };

  const MAX = 4;
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    try {
      const res = await fetch(`${BASE}/api/v1/dte/boleta/emit/`, {
        method: "POST",
        headers: authHeaders(input.idempotencyKey),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, any>;
      // Transitorios → reintento con MISMA key y body (nunca con otra key).
      if ((res.status === 429 || res.status >= 500) && attempt < MAX) {
        await sleep(attempt * 1000);
        continue;
      }
      return toResult(res.status, data);
    } catch (e) {
      // Error de red/timeout: reintentar con la misma key.
      lastErr = e;
      if (attempt < MAX) {
        await sleep(attempt * 1000);
        continue;
      }
    }
  }
  throw new Error(`SharkPOS emitBoleta falló tras ${MAX} intentos: ${String(lastErr)}`);
}

export interface TedResult {
  folio?: number;
  /** Bytes del TED en base64, listos para el PDF417 (nivel de corrección 5). */
  tedBase64?: string;
  /** TED como texto XML (contiene <RE>RUTEmisor</RE>, etc.). */
  ted?: string;
  raw: Record<string, unknown>;
}

/** Trae el timbre electrónico (TED) de un documento, para imprimir el PDF417. */
export async function getBoletaTed(dteId: string): Promise<TedResult> {
  const res = await fetch(`${BASE}/api/v1/dte/documents/${dteId}/ted/`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(20_000),
  });
  const d = (await res.json().catch(() => ({}))) as Record<string, any>;
  return { folio: d.folio, tedBase64: d.ted_base64, ted: d.ted, raw: d };
}

/** Trae el PNG del timbre (PDF417) de un documento, en base64, para rasterizarlo. */
export async function getBoletaTedPngBase64(dteId: string): Promise<string | undefined> {
  const res = await fetch(`${BASE}/api/v1/dte/documents/${dteId}/ted.png`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return undefined;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString("base64");
}

/** Consulta el estado de un documento por su dte_id (alternativa al webhook). */
export async function getDocument(dteId: string): Promise<SharkposResult> {
  const res = await fetch(`${BASE}/api/v1/dte/documents/${dteId}/`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, any>;
  return toResult(res.status, data);
}
