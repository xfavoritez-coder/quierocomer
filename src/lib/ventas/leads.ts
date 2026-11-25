import { prisma } from "@/lib/prisma";
import type { CurrentSeller } from "@/lib/ventas/session";

/** Lead de terreno visible para el vendedor (ADMIN: cualquiera de terreno; SELLER: solo los suyos). */
export async function getSellerLead(seller: CurrentSeller, leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, sellerId: true, localName: true, captureSource: true, cartaStatus: true, errorLog: true, preview: true, generatedSlug: true, crmStatus: true, cuisine: true, commune: true, ownerName: true, cartaUrl: true, createdAt: true, email: true, whatsapp: true, interestModules: true, recommendedPlan: true },
  });
  if (!lead || !lead.sellerId) return null;
  if (seller.role !== "ADMIN" && lead.sellerId !== seller.id) return null;
  return lead;
}

/** Local demo generado para el lead. Solo se devuelve si es demo (isDemo): nunca un local real. */
export async function getLeadDemoRestaurant(generatedSlug: string | null) {
  if (!generatedSlug) return null;
  const r = await prisma.restaurant.findUnique({ where: { slug: generatedSlug }, select: { id: true, slug: true, name: true, logoUrl: true, bannerUrl: true, cartaAccentColor: true, isDemo: true } });
  return r?.isDemo ? r : null;
}

export async function addLeadEvent(leadId: string, type: string, actor: "seller" | "owner" | "system", sellerId?: string | null, extra?: { chapter?: string; durationMs?: number; payload?: object }) {
  await prisma.leadEvent.create({
    data: { leadId, type, actor, sellerId: sellerId ?? null, chapter: extra?.chapter, durationMs: extra?.durationMs, payload: extra?.payload as object | undefined },
  }).catch((e) => console.error("[ventas] leadEvent", e));
}
