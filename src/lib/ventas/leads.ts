import { prisma } from "@/lib/prisma";
import type { CurrentSeller } from "@/lib/ventas/session";

/** Lead de terreno visible para el vendedor (ADMIN: cualquiera de terreno; SELLER: solo los suyos). */
export async function getSellerLead(seller: CurrentSeller, leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, sellerId: true, localName: true, captureSource: true, cartaStatus: true, errorLog: true, preview: true, generatedSlug: true, crmStatus: true, cuisine: true, commune: true, ownerName: true, cartaUrl: true, createdAt: true, convertedToOwnerId: true, crmNotes: true, email: true, whatsapp: true, interestModules: true, recommendedPlan: true },
  });
  if (!lead || !lead.sellerId) return null;
  if (seller.role !== "ADMIN" && lead.sellerId !== seller.id) return null;
  return lead;
}

/** Local demo generado para el lead. Solo se devuelve si es demo (isDemo): nunca un local real. */
export async function getLeadDemoRestaurant(generatedSlug: string | null) {
  if (!generatedSlug) return null;
  const r = await prisma.restaurant.findUnique({ where: { slug: generatedSlug }, select: { id: true, slug: true, name: true, logoUrl: true, bannerUrl: true, cartaAccentColor: true, cartaColorMode: true, isDemo: true } });
  return r?.isDemo ? r : null;
}

/** Local del lead para ficha y demo: el demo, o el local real si el dueño ya se registró
 *  (solo lectura: la edición de carta y los momentos en vivo siguen siendo solo para demos). */
export async function getLeadRestaurant(lead: { generatedSlug: string | null; convertedToOwnerId?: string | null }) {
  if (!lead.generatedSlug) return null;
  const r = await prisma.restaurant.findUnique({ where: { slug: lead.generatedSlug }, select: { id: true, slug: true, name: true, logoUrl: true, bannerUrl: true, cartaAccentColor: true, isDemo: true, ownerId: true } });
  if (!r) return null;
  if (r.isDemo || (lead.convertedToOwnerId && r.ownerId === lead.convertedToOwnerId)) return r;
  return null;
}

/** Datos de contacto capturados en terreno. La dirección y el correo van en las notas del lead
 *  (no en lead.email: el motor de extracción crearía la cuenta y enviaría correos antes de tiempo). */
export function leadContact(lead: { email?: string | null; crmNotes?: unknown }) {
  const notes = (Array.isArray(lead.crmNotes) ? lead.crmNotes : []) as { kind?: string; value?: string }[];
  const val = (k: string) => [...notes].reverse().find((n) => n?.kind === k && n.value)?.value ?? "";
  return { address: val("address"), email: lead.email || val("email") };
}

export async function addLeadEvent(leadId: string, type: string, actor: "seller" | "owner" | "system", sellerId?: string | null, extra?: { chapter?: string; durationMs?: number; payload?: object }) {
  await prisma.leadEvent.create({
    data: { leadId, type, actor, sellerId: sellerId ?? null, chapter: extra?.chapter, durationMs: extra?.durationMs, payload: extra?.payload as object | undefined },
  }).catch((e) => console.error("[ventas] leadEvent", e));
}
