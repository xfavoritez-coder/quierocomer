import { NextResponse } from "next/server";
import { getShowcaseOwner, seedShowcase } from "@/lib/ventas/showcase";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Regenera a diario el local de muestra de Ventas (si existe) para que sus datos sigan al día. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await getShowcaseOwner())) return NextResponse.json({ ok: true, skipped: "sin local de muestra" });
  return NextResponse.json({ ok: true, ...(await seedShowcase()) });
}
