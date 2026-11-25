import { prisma } from "@/lib/prisma";
import { fictionalDemo } from "@/components/ventas/demo/fictional";
import type { DemoData } from "@/components/ventas/demo/types";
import { getLeadDemoRestaurant } from "@/lib/ventas/leads";
import { getDemoPlans } from "@/lib/ventas/plans";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Datos de la demo de un lead: su local demo si ya está armado; si no, el local ficticio con su nombre. */
export async function buildDemoData(lead: { id: string; localName: string; generatedSlug: string | null; cuisine: string | null; commune: string | null }): Promise<DemoData> {
  const [r, { sections: plans, storePlan }] = await Promise.all([getLeadDemoRestaurant(lead.generatedSlug), getDemoPlans()]);
  if (!r) {
    const f = fictionalDemo(lead.localName);
    return { ...f, leadId: lead.id, cuisine: lead.cuisine ?? f.cuisine, commune: lead.commune ?? f.commune, plans, storePlan };
  }
  const cats = await prisma.category.findMany({
    where: { restaurantId: r.id, isActive: true },
    orderBy: { position: "asc" },
    select: { name: true, dishes: { where: { deletedAt: null, isActive: true }, orderBy: { position: "asc" }, take: 40, select: { name: true, price: true, discountPrice: true, photos: true, description: true } } },
  });
  return {
    leadId: lead.id,
    name: r.name,
    logoUrl: r.logoUrl,
    color: r.cartaAccentColor && HEX.test(r.cartaAccentColor) ? r.cartaAccentColor : "#DE7C00",
    bannerUrl: r.bannerUrl,
    cuisine: lead.cuisine,
    commune: lead.commune,
    slug: r.slug,
    isFictional: false,
    plans,
    storePlan,
    categories: cats.filter((c) => c.dishes.length).map((c) => ({
      name: c.name,
      dishes: c.dishes.map((d) => ({ name: d.name, price: d.discountPrice && d.discountPrice > 0 && d.discountPrice < d.price ? d.discountPrice : d.price, photo: d.photos?.[0] ?? null, description: d.description })),
    })),
  };
}
