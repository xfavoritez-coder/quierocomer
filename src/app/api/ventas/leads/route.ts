import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSellerFromRequest } from "@/lib/ventas/session";
import { detectProvider } from "@/lib/extractors/detectProvider";
import { addLeadEvent } from "@/lib/ventas/leads";

export const runtime = "nodejs";

const PROSPECT_DAYS = 30;
const clean = (v: unknown, max = 120) => String(v ?? "").trim().slice(0, max);

/** POST /api/ventas/leads  — captura un local en terreno.
 *  Body: { source: "photo"|"link"|"none", localName?, cuisine?, commune?, contactName?, cartaUrl?, photoUrls?: string[] } */
export async function POST(req: NextRequest) {
  const seller = await getSellerFromRequest(req);
  if (!seller) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const source = ["photo", "link", "none"].includes(b?.source) ? b.source as "photo" | "link" | "none" : null;
  if (!source) return NextResponse.json({ error: "Elige foto, link o sin datos" }, { status: 400 });

  const localName = clean(b.localName);
  const photoUrls = Array.isArray(b.photoUrls) ? (b.photoUrls as unknown[]).map(String).filter((u) => /^https:\/\//.test(u)).slice(0, 10) : [];
  let cartaUrl = clean(b.cartaUrl, 1000);
  if (source === "link") {
    if (!/^https?:\/\//i.test(cartaUrl)) cartaUrl = cartaUrl ? `https://${cartaUrl}` : "";
    try { new URL(cartaUrl); } catch { return NextResponse.json({ error: "El link no es válido" }, { status: 400 }); }
  }
  if (source === "photo" && !photoUrls.length) return NextResponse.json({ error: "Sube al menos una foto de la carta" }, { status: 400 });
  if (source === "none" && !localName) return NextResponse.json({ error: "Escribe al menos el nombre del local" }, { status: 400 });

  let detectedProviderId: string | null = null;
  if (source === "link") {
    const providers = await prisma.menuProvider.findMany({ select: { id: true, domainPatterns: true, htmlSignatures: true } });
    const d = await detectProvider(cartaUrl, providers).catch(() => ({ providerId: null, resolvedUrl: undefined }));
    detectedProviderId = d.providerId;
    if (d.resolvedUrl) cartaUrl = d.resolvedUrl;
  }

  const lead = await prisma.lead.create({
    data: {
      // Lead de terreno: sin correo → el motor de extracción NO crea cuenta ni envía correos.
      localName: localName || "Local sin nombre",
      ownerName: clean(b.contactName, 80),
      email: "",
      cartaType: source === "photo" ? "PHOTO" : "LINK",
      cartaUrl: source === "link" ? cartaUrl : null,
      cartaFileUrl: source === "photo" ? photoUrls.join(",") : null,
      detectedProviderId,
      cartaStatus: source === "none" ? "FAILED" : "PENDING",
      errorLog: source === "none" ? "Sin carta: se usa el local de ejemplo" : null,
      sellerId: seller.id,
      captureSource: source,
      cuisine: clean(b.cuisine, 60) || null,
      commune: clean(b.commune, 60) || null,
      crmStatus: "nuevo",
      crmStatusHistory: [{ status: "nuevo", ts: new Date().toISOString() }],
      expiresAt: new Date(Date.now() + PROSPECT_DAYS * 86400000),
    },
    select: { id: true },
  });
  await addLeadEvent(lead.id, "captured", "seller", seller.id, { payload: { source, provider: detectedProviderId, photos: photoUrls.length } });
  return NextResponse.json({ id: lead.id, needsProcessing: source !== "none" });
}
