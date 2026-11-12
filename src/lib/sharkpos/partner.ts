// ═══════════════════════════════════════════════════════════
//  SharkPOS — MODO PLATAFORMA (partner).
//  QuieroComer es la plataforma: con UNA llave de plataforma
//  (SHARKPOS_PLATFORM_KEY, backend-only) da de alta el RUT de cada local y
//  recibe su propia API key. Cada local emite boletas con SU key (ver client.ts
//  SharkposCred) — nunca con la llave de plataforma.
//
//  Alta: POST /api/v1/partner/tenants/register/  (multipart/form-data)
//        auth: Authorization: Bearer <SHARKPOS_PLATFORM_KEY>
//        En SANDBOX basta `company_rut` (SharkPOS pone certificado y folios de
//        prueba; hasta 10 RUT por acceso de prueba de plataforma).
//        La respuesta devuelve `api_key` UNA sola vez → se guarda cifrada.
//
//  Contrato leído de https://api.sharkpos.cl/docs/openapi.yaml (NO inventar campos).
// ═══════════════════════════════════════════════════════════
import { sharkposBaseFor } from "./client";

export function platformConfigured(): boolean {
  return !!process.env.SHARKPOS_PLATFORM_KEY;
}

/**
 * Entorno de la PLATAFORMA (altas). Independiente del entorno de emisión global
 * (SHARKPOS_ENV): la llave de plataforma puede ser de producción mientras el
 * piloto (El Suculento) sigue emitiendo en sandbox con su key global. Se controla
 * con SHARKPOS_PLATFORM_ENV; si no está, cae a SHARKPOS_ENV; por defecto sandbox.
 */
export function platformEnv(): "sandbox" | "production" {
  const e = process.env.SHARKPOS_PLATFORM_ENV || process.env.SHARKPOS_ENV || "sandbox";
  return e === "production" ? "production" : "sandbox";
}

/** Campos de producción del alta (en sandbox se omiten todos salvo companyRut). */
export interface RegisterTenantInput {
  /** RUT de la empresa (único obligatorio en sandbox). */
  companyRut: string;
  /** Referencia nuestra para reconciliar (p. ej. el id del restaurante). */
  externalReference?: string;
  /** Tipos de documento a mantener con folios (coma-separado), p. ej. "39,61" o "39,33,61". */
  cafAutoRequestTypes?: string;
  // ── Solo producción ──────────────────────────────────────────────
  businessName?: string;
  businessActivity?: string;
  address?: string;
  locationRegion?: string;
  commune?: string;
  city?: string;
  resolutionNumber?: number;
  resolutionDate?: string; // YYYY-MM-DD
  signerName?: string;
  signerRut?: string;
  /** Certificado .pfx/.p12 (≤2MB) — solo producción. */
  certificate?: { bytes: Buffer | Uint8Array; filename: string };
  certificatePassword?: string;
}

export interface RegisterTenantResult {
  ok: boolean;
  httpStatus: number;
  tenantId?: string;
  /** API key del RUT. Se devuelve SOLO en el alta → guardar cifrada de inmediato. */
  apiKey?: string;
  environment?: "certification" | "production";
  rut?: string;
  razonSocial?: string;
  code?: string;
  message?: string;
  raw: Record<string, unknown>;
}

function platformAuth(): string {
  const key = process.env.SHARKPOS_PLATFORM_KEY;
  if (!key) throw new Error("SHARKPOS_PLATFORM_KEY no configurada");
  return `Bearer ${key}`;
}

/**
 * Da de alta un RUT en SharkPOS en una llamada y devuelve su API key.
 * En sandbox solo usa `company_rut`. NO reintenta un alta ya hecha con otra llave
 * (el alta es idempotente por RUT en SharkPOS: volver a registrar un RUT ya activo
 * devuelve error controlado, no crea otro).
 */
export async function registerTenant(input: RegisterTenantInput): Promise<RegisterTenantResult> {
  const base = sharkposBaseFor(platformEnv());
  const sandbox = platformEnv() === "sandbox";

  const form = new FormData();
  form.append("company_rut", input.companyRut.trim());
  if (input.externalReference) form.append("external_reference", input.externalReference.slice(0, 128));
  // Tipos a mantener con folios automáticos (boleta 39 + NC 61 para anular; 33 si factura).
  if (input.cafAutoRequestTypes) form.append("caf_auto_request_types", input.cafAutoRequestTypes);

  if (!sandbox) {
    // Producción: todos los campos del SII son obligatorios.
    const put = (k: string, v: unknown) => { if (v !== undefined && v !== null && v !== "") form.append(k, String(v)); };
    put("business_name", input.businessName);
    put("business_activity", input.businessActivity);
    put("address", input.address);
    put("location_region", input.locationRegion);
    put("commune", input.commune);
    put("city", input.city);
    put("resolution_number", input.resolutionNumber);
    put("resolution_date", input.resolutionDate);
    put("signer_name", input.signerName);
    put("signer_rut", input.signerRut);
    put("certificate_password", input.certificatePassword);
    form.append("authorization_confirmed", "yes");
    if (input.certificate) {
      const bytes = input.certificate.bytes instanceof Buffer ? input.certificate.bytes : Buffer.from(input.certificate.bytes);
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/x-pkcs12" });
      form.append("certificate", blob, input.certificate.filename || "cert.pfx");
    }
  }

  const res = await fetch(`${base}/api/v1/partner/tenants/register/`, {
    method: "POST",
    headers: { Authorization: platformAuth() }, // multipart boundary lo pone fetch solo
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  const d = (await res.json().catch(() => ({}))) as Record<string, any>;
  const tenant = (d.tenant && typeof d.tenant === "object") ? d.tenant as Record<string, any> : {};
  return {
    ok: res.status === 201 && !!d.api_key,
    httpStatus: res.status,
    tenantId: d.tenant_id,
    apiKey: d.api_key,
    environment: d.environment,
    rut: tenant.rut || d.expected_rut,
    razonSocial: tenant.razon_social,
    code: d.code,
    message: d.message || d.detail,
    raw: d,
  };
}
