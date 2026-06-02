import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin, checkAdminAuth } from "@/lib/adminAuth";

export const maxDuration = 300;

/**
 * POST /api/admin/crear-carta
 * Superadmin: create a lead and fire processing in background.
 * Returns immediately with leadId. UI polls GET for status.
 */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const { url, nombre, email, whatsapp } = await req.json();
  if (!url) return NextResponse.json({ error: "URL requerida" }, { status: 400 });

  // Detect provider
  let detectedProviderId: string | undefined;
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    const provider = await prisma.menuProvider.findFirst({
      where: { domainPatterns: { has: hostname } },
      select: { id: true },
    });
    if (provider) detectedProviderId = provider.id;
  } catch {}

  const lead = await prisma.lead.create({
    data: {
      localName: nombre || "",
      ownerName: nombre || "",
      email: email || "admin@quierocomer.cl",
      whatsapp: whatsapp || null,
      cartaType: "LINK",
      cartaUrl: url,
      cartaStatus: "PENDING",
      detectedProviderId,
    },
  });

  // Fire and forget — process in background
  import("@/lib/extractors/pipeline").then(({ processLead }) => {
    processLead(lead.id).catch(err => {
      console.error("[crear-carta] Pipeline error:", err.message);
      prisma.lead.update({ where: { id: lead.id }, data: { cartaStatus: "FAILED", errorLog: err.message } }).catch(() => {});
    });
  });

  return NextResponse.json({ ok: true, leadId: lead.id });
}

/**
 * GET /api/admin/crear-carta?leadId=xxx
 * Poll lead status.
 */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const leadId = req.nextUrl.searchParams.get("leadId");
  if (!leadId) return NextResponse.json({ error: "leadId requerido" }, { status: 400 });

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { cartaStatus: true, generatedSlug: true, errorLog: true },
  });
  if (!lead) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
  return NextResponse.json({
    status: lead.cartaStatus,
    slug: lead.generatedSlug,
    url: lead.generatedSlug ? `${baseUrl}/qr/${lead.generatedSlug}` : null,
    error: lead.errorLog,
  });
}
