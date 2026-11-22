// Cron — meta-audiences. Refresca las Custom Audiences de Meta de cada local con el
// sync habilitado (ecommerceConfig.meta.audiencesEnabled). Sube compradores, inactivos
// 30-120d y mejores clientes (hasheados). Diario.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseEcommerceConfig } from "@/lib/ecommerce/config";
import { syncRestaurantAudiences } from "@/lib/meta/syncAudiences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Candidatos: locales con filtro JSON por meta.audiencesEnabled (si el filtro no está
  // soportado, caemos a traer todos y filtrar en memoria).
  let restaurants: { id: string; name: string }[] = [];
  try {
    restaurants = await prisma.restaurant.findMany({
      where: { ecommerceConfig: { path: ["meta", "audiencesEnabled"], equals: true } },
      select: { id: true, name: true },
    });
  } catch {
    const all = await prisma.restaurant.findMany({ select: { id: true, name: true, ecommerceConfig: true } });
    restaurants = all.filter((r) => parseEcommerceConfig(r.ecommerceConfig).meta?.audiencesEnabled).map((r) => ({ id: r.id, name: r.name }));
  }

  const results: Record<string, unknown>[] = [];
  for (const r of restaurants) {
    const res = await syncRestaurantAudiences(r.id).catch((e) => ({ ok: false, error: String((e as Error)?.message) }));
    results.push({ restaurant: r.name, id: r.id, ...res });
  }
  return NextResponse.json({ ok: true, count: restaurants.length, results });
}
