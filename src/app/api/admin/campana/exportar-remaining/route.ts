import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin, checkAdminAuth } from "@/lib/adminAuth";
import { sendAdminEmail } from "@/lib/email/sendAdminEmail";
import { createPanelMagicToken } from "@/lib/magicLink";
import { buildExportarCartaEmail } from "@/lib/email/templates/exportarCarta";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const alreadySent = await prisma.emailLog.findMany({
    where: { purpose: "campana_exportar_carta", status: "sent" },
    select: { to: true },
  });
  const alreadySentEmails = new Set(alreadySent.map((l) => l.to.toLowerCase()));

  const rawLeads = await prisma.lead.findMany({
    where: { email: { not: "import@quierocomer.cl" } },
    select: { id: true, email: true },
    orderBy: { id: "asc" },
  });

  const isJoanValdivia = (l: { email: string | null }) => {
    const email = (l.email || "").toLowerCase().replace(/[.\-_]/g, "");
    return email.includes("joan") || email.includes("valdivia");
  };

  const remaining = rawLeads.filter((l) =>
    !isJoanValdivia(l) && l.email && !alreadySentEmails.has(l.email.toLowerCase())
  );

  return NextResponse.json({ remaining: remaining.length, sent: alreadySentEmails.size });
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const { dryRun = false } = await req.json().catch(() => ({}));

  const alreadySent = await prisma.emailLog.findMany({
    where: { purpose: "campana_exportar_carta", status: "sent" },
    select: { to: true },
  });
  const alreadySentEmails = new Set(alreadySent.map((l) => l.to.toLowerCase()));

  const rawLeads = await prisma.lead.findMany({
    where: { email: { not: "import@quierocomer.cl" } },
    select: { id: true, email: true, ownerName: true, localName: true, generatedSlug: true },
    orderBy: { id: "asc" },
  });

  const isJoanValdivia = (l: typeof rawLeads[0]) => {
    const email = (l.email || "").toLowerCase().replace(/[.\-_]/g, "");
    const name = (l.ownerName || "").toLowerCase();
    return email.includes("joan") || email.includes("valdivia") || name.includes("joan") || name.includes("valdivia");
  };

  const leads = rawLeads.filter((l) =>
    !isJoanValdivia(l) && l.email && !alreadySentEmails.has(l.email.toLowerCase())
  );

  const slugs = [...new Set(leads.map((l) => l.generatedSlug).filter(Boolean) as string[])];
  const restaurants = await prisma.restaurant.findMany({
    where: { slug: { in: slugs } },
    select: {
      slug: true, ownerId: true, logoUrl: true,
      dishes: { where: { isActive: true, deletedAt: null, price: { gt: 0 } }, select: { name: true, price: true, photos: true }, orderBy: { position: "asc" }, take: 20 },
    },
  });
  const restaurantMap = new Map(restaurants.map((r) => [r.slug, r]));

  let sent = 0, skipped = 0, errors = 0;
  const results: { email: string; status: string }[] = [];

  for (const lead of leads) {
    if (!lead.email || !lead.email.includes("@")) { skipped++; continue; }

    const rData = lead.generatedSlug ? restaurantMap.get(lead.generatedSlug) : undefined;
    const ownerId = rData?.ownerId ?? undefined;
    const magicToken = ownerId ? createPanelMagicToken(ownerId) : null;
    const ctaUrl = magicToken
      ? `https://quierocomer.cl/api/panel/magic-entry?t=${magicToken}&r=/panel/exportar`
      : `https://quierocomer.cl/panel/login`;

    const allDishes = rData?.dishes ?? [];
    const withPhoto = allDishes.filter((d) => d.photos && d.photos.length > 0);
    const withoutPhoto = allDishes.filter((d) => !d.photos || d.photos.length === 0);
    const top3 = [...withPhoto, ...withoutPhoto].slice(0, 3);
    const dishes = top3.map((d) => ({ name: d.name, price: d.price, photoUrl: d.photos?.[0] ?? null }));

    const qrUrl = lead.generatedSlug
      ? `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(`https://quierocomer.cl/qr/${lead.generatedSlug}`)}&format=png`
      : null;

    const html = buildExportarCartaEmail({
      ownerName: lead.ownerName,
      localName: lead.localName,
      ctaUrl,
      hasMagicLink: !!magicToken,
      logoUrl: rData?.logoUrl ?? null,
      qrUrl,
      dishes,
    });

    if (dryRun) { results.push({ email: lead.email, status: "dry-run" }); sent++; continue; }

    try {
      await sendAdminEmail({ to: lead.email, subject: `Tu carta impresa está lista para imprimir`, html, purpose: "campana_exportar_carta" });
      results.push({ email: lead.email, status: "sent" });
      sent++;
      await new Promise((r) => setTimeout(r, 80));
    } catch {
      errors++;
      results.push({ email: lead.email, status: "error" });
    }
  }

  return NextResponse.json({ sent, skipped, errors, total: leads.length, dryRun, results: results.slice(0, 50) });
}
