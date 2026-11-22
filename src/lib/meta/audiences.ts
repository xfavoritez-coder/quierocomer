// ═══════════════════════════════════════════════════════════
//  Meta Custom Audiences — crear y refrescar audiencias desde la lista de clientes
//  del ecommerce (email/teléfono HASHEADOS). SERVER-ONLY. Requiere un token con
//  `ads_management` sobre la cuenta publicitaria (por-local ecommerceConfig.meta.adsToken
//  cifrado, o el global env META_ADS_TOKEN).
// ═══════════════════════════════════════════════════════════
import crypto from "crypto";
import { normalizePhoneCL } from "@/lib/ecommerce/phoneCL";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";

export interface AudienceMember { email?: string | null; phone?: string | null }

const sha = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

/** Email normalizado (minúsculas/trim) y hasheado, o "". */
function hashEmail(email?: string | null): string {
  const e = (email || "").trim().toLowerCase();
  return e && e.includes("@") ? sha(e) : "";
}
/** Teléfono a E.164 chileno en dígitos (569…) y hasheado, o "". */
function hashPhone(phone?: string | null): string {
  const norm = normalizePhoneCL(phone); // "+569XXXXXXXX" | null
  if (!norm) {
    const d = (phone || "").replace(/\D/g, "");
    return d.length >= 8 ? sha(d) : "";
  }
  return sha(norm.replace(/\D/g, "")); // "569XXXXXXXX"
}

async function metaPost(path: string, token: string, body: Record<string, unknown>): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, access_token: token }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error?.message || `HTTP ${res.status}`, data };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "meta error" };
  }
}

/** Crea una Custom Audience de lista de clientes. Devuelve su id. */
export async function createCustomAudience(adAccountId: string, token: string, name: string, description: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const r = await metaPost(`act_${adAccountId}/customaudiences`, token, {
    name, subtype: "CUSTOM", description, customer_file_source: "USER_PROVIDED_ONLY",
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, id: String(r.data?.id || "") };
}

/** REEMPLAZA por completo los miembros de una audiencia con la lista dada (hasheada).
 *  Batches de 10.000. Devuelve cuántos se subieron. */
export async function replaceAudienceUsers(audienceId: string, token: string, members: AudienceMember[]): Promise<{ ok: boolean; count: number; error?: string }> {
  const rows = members
    .map((m) => [hashEmail(m.email), hashPhone(m.phone)] as [string, string])
    .filter((r) => r[0] || r[1]); // al menos un identificador
  if (!rows.length) return { ok: true, count: 0 };

  const sessionId = Math.floor(Math.random() * 1e9);
  const CHUNK = 10000;
  const totalBatches = Math.ceil(rows.length / CHUNK);
  for (let i = 0; i < totalBatches; i++) {
    const data = rows.slice(i * CHUNK, (i + 1) * CHUNK);
    const r = await metaPost(`${audienceId}/usersreplace`, token, {
      session: { session_id: sessionId, batch_seq: i + 1, last_batch_flag: i === totalBatches - 1, estimated_num_total: rows.length },
      payload: { schema: ["EMAIL", "PHONE"], data },
    });
    if (!r.ok) return { ok: false, count: i * CHUNK, error: r.error };
  }
  return { ok: true, count: rows.length };
}
