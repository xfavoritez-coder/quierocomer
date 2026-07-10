import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin, checkAdminAuth } from "@/lib/adminAuth";
import { sendAdminEmail } from "@/lib/email/sendAdminEmail";
import { createPanelMagicToken } from "@/lib/magicLink";
import { buildExportarCartaEmail } from "@/lib/email/templates/exportarCarta";

interface RestaurantData {
  id: string;
  slug: string;
  ownerId: string | null;
  logoUrl: string | null;
  dishes: { name: string; price: number; photoUrl: string | null }[];
}

async function fetchRestaurantData(slugs: string[]): Promise<Map<string, RestaurantData>> {
  if (slugs.length === 0) return new Map();

  const restaurants = await prisma.restaurant.findMany({
    where: { slug: { in: slugs } },
    select: {
      id: true,
      slug: true,
      ownerId: true,
      logoUrl: true,
      dishes: {
        where: { isActive: true, deletedAt: null, price: { gt: 0 } },
        select: { name: true, price: true, photos: true },
        orderBy: { position: "asc" },
        take: 20,
      },
    },
  });

  return new Map(
    restaurants.map((r) => [
      r.slug,
      {
        id: r.id,
        slug: r.slug,
        ownerId: r.ownerId,
        logoUrl: r.logoUrl,
        // Only dishes WITH photos (avoids "salsa extra" type entries)
        dishes: (() => {
          const withPhoto = r.dishes.filter((d) => d.photos && d.photos.length > 0);
          const withoutPhoto = r.dishes.filter((d) => !d.photos || d.photos.length === 0);
          return [...withPhoto, ...withoutPhoto].slice(0, 3).map((d) => ({ name: d.name, price: d.price, photoUrl: d.photos?.[0] ?? null }));
        })(),
      },
    ])
  );
}

function buildEmailParams(lead: { ownerName: string; localName: string; generatedSlug: string | null }, restaurantData: Map<string, RestaurantData>, ctaUrl: string, hasMagicLink: boolean) {
  const rData = lead.generatedSlug ? restaurantData.get(lead.generatedSlug) : undefined;
  const qrUrl = lead.generatedSlug
    ? `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(`https://quierocomer.com/qr/${lead.generatedSlug}`)}&format=png`
    : null;

  return {
    ownerName: lead.ownerName,
    localName: lead.localName,
    ctaUrl,
    hasMagicLink,
    logoUrl: rData?.logoUrl ?? null,
    qrUrl,
    dishes: rData?.dishes ?? [],
  };
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const { dryRun = true, testEmail, offset = 0 } = await req.json().catch(() => ({}));

  // Test email: send to one address with the first real lead as example
  if (testEmail) {
    const sampleLead = await prisma.lead.findFirst({
      where: { email: { not: "import@quierocomer.com" }, generatedSlug: { not: null } },
      select: { id: true, email: true, ownerName: true, localName: true, generatedSlug: true },
    });
    const slug = sampleLead?.generatedSlug ?? null;
    const rMap = await fetchRestaurantData(slug ? [slug] : []);
    const rDataTest = slug ? rMap.get(slug) : undefined;
    const ownerId = rDataTest?.ownerId;
    const magicToken = ownerId ? createPanelMagicToken(ownerId) : null;
    const rid = rDataTest?.id;
    const ctaUrl = magicToken
      ? `https://quierocomer.com/api/panel/magic-entry?t=${magicToken}&r=${encodeURIComponent(`/panel/exportar${rid ? `?rid=${rid}` : ""}`)}`
      : `https://quierocomer.com/panel/login`;

    const html = buildExportarCartaEmail(
      buildEmailParams(
        { ownerName: sampleLead?.ownerName ?? "Restaurante", localName: sampleLead?.localName ?? "Tu restaurante", generatedSlug: slug },
        rMap, ctaUrl, !!magicToken
      )
    );
    await sendAdminEmail({ to: testEmail, subject: `[TEST] Tu carta impresa está lista para imprimir`, html, purpose: "campana_exportar_carta_test" });
    return NextResponse.json({ ok: true, testEmail, message: "Email de prueba enviado" });
  }

  // All leads excluding imports and Joan Valdivia — orden estable por id para soportar offset
  const rawLeads = await prisma.lead.findMany({
    where: { email: { not: "import@quierocomer.com" } },
    select: { id: true, email: true, ownerName: true, localName: true, generatedSlug: true },
    orderBy: { id: "asc" },
  });

  const isJoanValdivia = (l: typeof rawLeads[0]) => {
    const email = (l.email || "").toLowerCase().replace(/[.\-_]/g, "");
    const name = (l.ownerName || "").toLowerCase();
    return email.includes("joan") || email.includes("valdivia") || name.includes("joan") || name.includes("valdivia");
  };
  const leads = rawLeads.filter((l) => !isJoanValdivia(l)).slice(offset);

  // Fetch all restaurant data in one batch
  const slugs = [...new Set(leads.map((l) => l.generatedSlug).filter(Boolean) as string[])];
  const restaurantData = await fetchRestaurantData(slugs);
  const slugToOwnerId = new Map(
    [...restaurantData.entries()].filter(([, r]) => r.ownerId).map(([slug, r]) => [slug, r.ownerId!])
  );

  const results: { email: string; status: string }[] = [];
  let sent = 0, skipped = 0, errors = 0;

  for (const lead of leads) {
    if (!lead.email || !lead.email.includes("@")) { skipped++; continue; }

    const ownerId = lead.generatedSlug ? slugToOwnerId.get(lead.generatedSlug) : undefined;
    const rid = lead.generatedSlug ? restaurantData.get(lead.generatedSlug)?.id : undefined;
    const magicToken = ownerId ? createPanelMagicToken(ownerId) : null;
    const ctaUrl = magicToken
      ? `https://quierocomer.com/api/panel/magic-entry?t=${magicToken}&r=${encodeURIComponent(`/panel/exportar${rid ? `?rid=${rid}` : ""}`)}`
      : `https://quierocomer.com/panel/login`;

    const html = buildExportarCartaEmail(buildEmailParams(lead, restaurantData, ctaUrl, !!magicToken));

    if (dryRun) { results.push({ email: lead.email, status: "dry-run" }); sent++; continue; }

    try {
      await sendAdminEmail({
        to: lead.email,
        subject: `Tu carta impresa está lista para imprimir`,
        html,
        purpose: "campana_exportar_carta",
      });
      results.push({ email: lead.email, status: "sent" });
      sent++;
      await new Promise((r) => setTimeout(r, 80));
    } catch {
      errors++;
      results.push({ email: lead.email, status: "error" });
    }
  }

  return NextResponse.json({ sent, skipped, errors, total: leads.length, offset, dryRun, results: results.slice(0, 50) });
}
