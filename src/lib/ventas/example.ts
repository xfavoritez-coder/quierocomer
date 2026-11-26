// "Demo de ejemplo" de Ventas: un local de demo real en la base (carta QR, tienda online y tarjeta
// de fidelidad funcionando), para mostrar la demo y probar el garzón / pedidos sin capturar un local.
// Solo servidor.
import { prisma } from "@/lib/prisma";
import { fictionalDemo } from "@/components/ventas/demo/fictional";

export const EXAMPLE_SLUG = "ejemplo-dulce-aroma";

/** Crea (una vez) el local de ejemplo como local demo, con la carta del local ficticio. */
export async function ensureExampleRestaurant() {
  const f = fictionalDemo();
  const data = {
    name: f.name, isDemo: true, isActive: true, cartaAccentColor: f.color, cartaTheme: "PREMIUM" as const, defaultView: "impact",
    plan: "PREMIUM" as const, billingExempt: true, waiterPanelActive: true, weeklyEmailEnabled: false, weeklyInsightsEnabled: false,
    commune: f.commune, address: "Av. Italia 1450, Providencia",
  };
  const r = await prisma.restaurant.upsert({ where: { slug: EXAMPLE_SLUG }, update: { isDemo: true, isActive: true }, create: { ...data, slug: EXAMPLE_SLUG }, select: { id: true } });
  if (!(await prisma.category.count({ where: { restaurantId: r.id } }))) {
    for (let ci = 0; ci < f.categories.length; ci++) {
      const c = f.categories[ci];
      const cat = await prisma.category.create({ data: { restaurantId: r.id, name: c.name, position: ci }, select: { id: true } });
      await prisma.dish.createMany({ data: c.dishes.map((d, di) => ({ restaurantId: r.id, categoryId: cat.id, name: d.name, price: d.price, description: d.description ?? null, photos: d.photo ? [d.photo] : [], position: di })) });
    }
  }
  return r;
}

/** Lead de ejemplo del vendedor (uno por vendedor; no aparece en su lista de locales). */
export async function getExampleLead(sellerId: string) {
  const existing = await prisma.lead.findFirst({ where: { sellerId, captureSource: "example" }, select: { id: true } });
  if (existing) return existing;
  const f = fictionalDemo();
  return prisma.lead.create({
    data: { localName: f.name, ownerName: "", email: "", cartaType: "LINK", cartaStatus: "READY", generatedSlug: EXAMPLE_SLUG, sellerId, captureSource: "example", cuisine: f.cuisine, commune: f.commune, crmStatus: "nuevo" },
    select: { id: true },
  });
}
