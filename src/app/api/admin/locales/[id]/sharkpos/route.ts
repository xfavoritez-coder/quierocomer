// ═══════════════════════════════════════════════════════════
//  MODO PLATAFORMA SharkPOS — alta del RUT de un local (super-admin).
//  POST: da de alta el RUT en SharkPOS con la llave de plataforma y guarda la
//        API key del local CIFRADA. La api_key llega una sola vez → nunca se
//        devuelve al navegador. En sandbox basta `companyRut`.
//  GET:  estado (si hay plataforma configurada y si el local ya tiene su key).
//  DELETE: desvincula el RUT del local (no lo borra en SharkPOS).
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import { encryptSecret } from "@/lib/crypto/secret";
import { registerTenant, platformConfigured, platformEnv } from "@/lib/sharkpos/partner";

export const runtime = "nodejs";

async function status(id: string) {
  const r = await prisma.restaurant.findUnique({
    where: { id },
    select: { sharkposEnabled: true, sharkposTenantId: true, sharkposTenantRut: true, sharkposTenantName: true, sharkposTenantEnv: true, toteatWebhookSecret: true },
  });
  return {
    platformConfigured: platformConfigured(),
    platformEnv: platformEnv(),
    enabled: !!r?.sharkposEnabled,
    registered: !!r?.sharkposTenantId,
    tenantRut: r?.sharkposTenantRut || null,
    tenantName: r?.sharkposTenantName || null,
    tenantEnv: r?.sharkposTenantEnv || null,
    usesToteat: !!r?.toteatWebhookSecret,
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo super-admin" }, { status: 403 });
  const { id } = await params;
  return NextResponse.json(await status(id));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo super-admin" }, { status: 403 });
  const { id } = await params;

  if (!platformConfigured()) {
    return NextResponse.json({ error: "Falta SHARKPOS_PLATFORM_KEY (modo plataforma no configurado)" }, { status: 400 });
  }

  const restaurant = await prisma.restaurant.findUnique({ where: { id }, select: { id: true, sharkposTenantId: true } });
  if (!restaurant) return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });
  if (restaurant.sharkposTenantId) return NextResponse.json({ error: "El local ya tiene un RUT dado de alta" }, { status: 409 });

  // Alta: JSON (sandbox, solo RUT) o multipart/form-data (producción, con certificado).
  const ctype = req.headers.get("content-type") || "";
  let input: Parameters<typeof registerTenant>[0];
  if (ctype.includes("multipart/form-data")) {
    const fd = await req.formData();
    const s = (k: string) => { const v = fd.get(k); return typeof v === "string" ? v.trim() : ""; };
    const companyRut = s("companyRut");
    if (!companyRut) return NextResponse.json({ error: "Falta el RUT de la empresa" }, { status: 400 });
    const cert = fd.get("certificate");
    let certificate: { bytes: Buffer; filename: string } | undefined;
    if (cert && typeof cert !== "string") {
      const bytes = Buffer.from(await cert.arrayBuffer());
      if (bytes.length > 2 * 1024 * 1024) return NextResponse.json({ error: "El certificado supera 2 MB" }, { status: 400 });
      certificate = { bytes, filename: cert.name || "cert.pfx" };
    }
    input = {
      companyRut, externalReference: id,
      businessName: s("businessName"), businessActivity: s("businessActivity"),
      address: s("address"), locationRegion: s("locationRegion"), commune: s("commune"), city: s("city"),
      resolutionNumber: s("resolutionNumber") ? Number(s("resolutionNumber")) : undefined,
      resolutionDate: s("resolutionDate") || undefined,
      signerName: s("signerName"), signerRut: s("signerRut"),
      certificate, certificatePassword: s("certificatePassword") || undefined,
    };
    // En producción el certificado y la clave son obligatorios.
    if (platformEnv() === "production" && (!certificate || !input.certificatePassword)) {
      return NextResponse.json({ error: "En producción el certificado .pfx y su clave son obligatorios" }, { status: 400 });
    }
  } else {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const companyRut = String(body.companyRut || "").trim();
    if (!companyRut) return NextResponse.json({ error: "Falta el RUT de la empresa" }, { status: 400 });
    input = { companyRut, externalReference: id };
  }

  try {
    const r = await registerTenant(input);
    if (!r.ok || !r.apiKey || !r.tenantId) {
      console.error("[sharkpos/partner] alta falló", id, r.httpStatus, r.code, r.message);
      return NextResponse.json({ error: r.message || r.code || `SharkPOS respondió ${r.httpStatus}`, httpStatus: r.httpStatus }, { status: 400 });
    }
    // La api_key se guarda CIFRADA. Nunca vuelve al navegador.
    await prisma.restaurant.update({
      where: { id },
      data: {
        sharkposTenantId: r.tenantId,
        sharkposApiKey: encryptSecret(r.apiKey),
        sharkposTenantEnv: r.environment || (platformEnv() === "production" ? "production" : "certification"),
        sharkposTenantRut: r.rut || input.companyRut,
        sharkposTenantName: r.razonSocial || null,
        sharkposEnabled: true, // al dar de alta, queda listo para emitir
      },
    });
    return NextResponse.json({ ok: true, ...(await status(id)) });
  } catch (e) {
    console.error("[sharkpos/partner] alta error", id, String(e));
    return NextResponse.json({ error: "Error al dar de alta el RUT" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo super-admin" }, { status: 403 });
  const { id } = await params;
  await prisma.restaurant.update({
    where: { id },
    data: { sharkposTenantId: null, sharkposApiKey: null, sharkposTenantEnv: null, sharkposTenantRut: null, sharkposTenantName: null, sharkposEnabled: false },
  });
  return NextResponse.json({ ok: true, ...(await status(id)) });
}
