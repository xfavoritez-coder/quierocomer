import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSellerFromRequest } from "@/lib/ventas/session";
import { getSellerLead, addLeadEvent } from "@/lib/ventas/leads";
import { INTEREST_MODULES } from "@/components/ventas/demo/recommend";

export const runtime = "nodejs";
const VALID = new Set<string>(INTEREST_MODULES.map((m) => m.id));

/** PATCH /api/ventas/leads/[id]  Body: { interestModules?: string[], recommendedPlan?: string } */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const seller = await getSellerFromRequest(req);
  if (!seller) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const lead = await getSellerLead(seller, id);
  if (!lead) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const data: { interestModules?: string[]; recommendedPlan?: string | null } = {};
  if (Array.isArray(b.interestModules)) data.interestModules = [...new Set((b.interestModules as unknown[]).map(String).filter((m) => VALID.has(m)))];
  if (typeof b.recommendedPlan === "string") data.recommendedPlan = b.recommendedPlan.slice(0, 60) || null;
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  await prisma.lead.update({ where: { id }, data });
  if (data.interestModules) await addLeadEvent(id, "interest_updated", "seller", seller.id, { payload: { modules: data.interestModules } });
  return NextResponse.json({ ok: true, ...data });
}

/** DELETE /api/ventas/leads/[id] — elimina un local capturado (el vendedor los suyos; ADMIN cualquiera).
 *  No se puede si el dueño ya se registró. Su local demo se borra (o, si no se puede, queda inactivo). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const seller = await getSellerFromRequest(req);
  if (!seller) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const lead = await getSellerLead(seller, id);
  if (!lead) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (lead.captureSource === "example") return NextResponse.json({ error: "El local de ejemplo no se elimina" }, { status: 409 });
  if (lead.convertedToOwnerId || ["registrado", "activo"].includes(lead.crmStatus || "")) return NextResponse.json({ error: "Este local ya se registró: no se puede eliminar desde Ventas" }, { status: 409 });

  if (lead.generatedSlug) {
    const r = await prisma.restaurant.findUnique({ where: { slug: lead.generatedSlug }, select: { id: true, isDemo: true } });
    const others = r ? await prisma.lead.count({ where: { generatedSlug: lead.generatedSlug, id: { not: id } } }) : 0;
    if (r?.isDemo && !others) {
      try {
        await prisma.$transaction([
          prisma.dish.deleteMany({ where: { restaurantId: r.id } }),
          prisma.category.deleteMany({ where: { restaurantId: r.id } }),
          prisma.restaurant.delete({ where: { id: r.id } }),
        ]);
      } catch {
        // Tiene datos asociados (pedidos de prueba, tarjeta, etc.): queda inactivo y fuera del sitio.
        await prisma.restaurant.update({ where: { id: r.id }, data: { isActive: false } }).catch(() => {});
      }
    }
  }
  await prisma.lead.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
