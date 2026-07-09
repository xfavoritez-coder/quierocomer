import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/adminAuth";
import { checkAdminAuth } from "@/lib/adminAuth";
import { sendAdminEmail } from "@/lib/email/sendAdminEmail";
import { createPanelMagicToken } from "@/lib/magicLink";
import { buildExportarCartaEmail } from "@/lib/email/templates/exportarCarta";

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const { dryRun = true } = await req.json().catch(() => ({}));

  // Get all leads excluding imports and Joan Valdivia test leads
  const leads = await prisma.lead.findMany({
    where: {
      email: { not: "import@quierocomer.cl" },
      ownerName: { not: { contains: "Joan Valdivia", mode: "insensitive" } },
    },
    select: {
      id: true,
      email: true,
      ownerName: true,
      localName: true,
      generatedSlug: true,
    },
  });

  // Get restaurant owners for activated leads
  const slugs = leads.map((l) => l.generatedSlug).filter(Boolean) as string[];
  const restaurants = await prisma.restaurant.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, ownerId: true },
  });
  const slugToOwnerId = new Map(
    restaurants.filter((r) => r.ownerId).map((r) => [r.slug, r.ownerId!])
  );

  const results: { email: string; status: string }[] = [];
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const lead of leads) {
    if (!lead.email || !lead.email.includes("@")) {
      skipped++;
      continue;
    }

    const ownerId = lead.generatedSlug ? slugToOwnerId.get(lead.generatedSlug) : undefined;
    const magicToken = ownerId ? createPanelMagicToken(ownerId) : null;
    const ctaUrl = magicToken
      ? `https://quierocomer.cl/api/panel/magic-entry?t=${magicToken}&r=/panel/exportar`
      : `https://quierocomer.cl/panel/login`;

    const html = buildExportarCartaEmail({
      ownerName: lead.ownerName,
      localName: lead.localName,
      ctaUrl,
      hasMagicLink: !!magicToken,
    });

    if (dryRun) {
      results.push({ email: lead.email, status: "dry-run" });
      sent++;
      continue;
    }

    try {
      await sendAdminEmail({
        to: lead.email,
        subject: `🍽️ ${lead.localName || "Tu carta"} ahora se imprime en segundos`,
        html,
        purpose: "campana_exportar_carta",
      });
      results.push({ email: lead.email, status: "sent" });
      sent++;
      // Small delay to avoid rate limits
      await new Promise((r) => setTimeout(r, 80));
    } catch (err) {
      errors++;
      results.push({ email: lead.email, status: "error" });
    }
  }

  return NextResponse.json({ sent, skipped, errors, total: leads.length, dryRun, results: results.slice(0, 50) });
}
