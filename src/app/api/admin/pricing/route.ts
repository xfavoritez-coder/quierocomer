import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import { getPricing, setPricing, type PricingConfig } from "@/lib/pricing";

export const runtime = "nodejs";

/**
 * Precios de QuieroComer (planes, add-ons, implementación, otros cobros).
 * Solo superadmin.  GET → PricingConfig.  PUT PricingConfig → guarda.
 */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  return NextResponse.json(await getPricing());
}

export async function PUT(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  await setPricing(body as PricingConfig);
  return NextResponse.json({ ok: true, pricing: await getPricing() });
}
