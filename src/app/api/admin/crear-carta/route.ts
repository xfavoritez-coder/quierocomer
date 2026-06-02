import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processLead } from "@/lib/extractors/pipeline";
import { isSuperAdmin, checkAdminAuth } from "@/lib/adminAuth";

export const maxDuration = 300;

/**
 * POST /api/admin/crear-carta
 * Superadmin: create a carta from a URL instantly.
 * Body: { url: string, nombre?: string, email?: string, whatsapp?: string }
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

  const result = await processLead(lead.id);

  return NextResponse.json({ ok: true, slug: result.slug, url: result.url, leadId: lead.id });
}
