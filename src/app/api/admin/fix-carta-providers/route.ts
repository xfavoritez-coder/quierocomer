import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

const PROVIDER_PATTERNS: [RegExp, string][] = [
  [/getjusto\.com|justo\.cl|justo\.pe|\/pedir/i, "Justo"],
  [/mercat\.cl|mer-cat\.com/i, "Mercat"],
  [/rappi\.com|rappi\.cl/i, "Rappi"],
  [/ubereats\.com/i, "UberEats"],
];

const ORDERING_PROVIDERS = new Set(["Justo", "Mercat", "Rappi", "UberEats"]);

function detectProvider(url: string): string | null {
  for (const [pattern, provider] of PROVIDER_PATTERNS) {
    if (pattern.test(url)) return provider;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { dryRun = true } = await req.json().catch(() => ({ dryRun: true }));

  const restaurants = await prisma.restaurant.findMany({
    where: { isDemo: false, isActive: true, website: { not: null } },
    select: { id: true, slug: true, name: true, cartaProvider: true, website: true, websiteIsOrderUrl: true },
  });

  const fixes: { slug: string; name: string; from: string | null; to: string; website: string }[] = [];

  for (const r of restaurants) {
    if (!r.website) continue;
    const detected = detectProvider(r.website);
    if (!detected || r.cartaProvider === detected) continue;

    fixes.push({ slug: r.slug, name: r.name, from: r.cartaProvider, to: detected, website: r.website });

    if (!dryRun) {
      await prisma.restaurant.update({
        where: { id: r.id },
        data: { cartaProvider: detected, websiteIsOrderUrl: ORDERING_PROVIDERS.has(detected) },
      });
    }
  }

  return NextResponse.json({ dryRun, fixed: fixes.length, fixes });
}
