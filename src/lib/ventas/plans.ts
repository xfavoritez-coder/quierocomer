// Solo servidor (lee la base de datos). No importar desde componentes de cliente.
import { getPricing, DEFAULT_HEADINGS, type PricePlan } from "@/lib/pricing";
import type { DemoPlanSection, DemoPlan } from "@/components/ventas/demo/types";

/** Planes de la demo, leídos de la configuración de /admin/planes (pricing_config).
 *  Mismo cálculo que la vista de /admin/planes: add-ons incluidos se suman, precio
 *  oferta, "Desde", subtítulo o implementación, recomendado y secciones. */
export async function getDemoPlans(): Promise<{ sections: DemoPlanSection[]; storePlan: { name: string; price: number } | null }> {
  const cfg = await getPricing();
  const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
  const implFor = (name: string) => cfg.implementation.find((l) => l.label.trim().toLowerCase() === name.trim().toLowerCase())?.price ?? null;
  const hv = (f: keyof typeof DEFAULT_HEADINGS) => cfg.headings?.[f] || DEFAULT_HEADINGS[f];
  const custom = cfg.categories || [];
  const sectionsMeta = [
    { id: "__plans", title: hv("plansTitle"), subtitle: hv("plansSub"), accent: true },
    { id: "__addons", title: hv("addonsTitle"), subtitle: hv("addonsSub"), accent: false },
    ...custom.map((c) => ({ id: c.id, title: c.title || "Categoría", subtitle: c.subtitle || "", accent: false })),
  ];
  const valid = new Set(sectionsMeta.map((s) => s.id));
  const anyRecommended = [...cfg.plans, ...cfg.addons].some((p) => p.recommended);
  // Igual que /admin/planes, pero si nadie está marcado como recomendado se destaca UN solo
  // plan (el primero "premium" de la sección principal), no todos los que terminan en "Premium".
  const fallbackId = anyRecommended ? null : (cfg.plans.find((p) => p.id === "premium") ?? cfg.plans.find((p) => /(^|\s)premium$/i.test(p.name.trim())))?.id ?? null;
  const isHighlight = (p: PricePlan, accent: boolean) => p.recommended === true || (accent && p.id === fallbackId);

  const toDemo = (p: PricePlan, accent: boolean): DemoPlan => {
    const addonsSum = (p.includedAddons || []).reduce((s, id) => s + (p.addonPrices?.[id] ?? (cfg.addons.find((a) => a.id === id)?.price || 0)), 0);
    const regular = p.price + addonsSum;
    const hasOffer = typeof p.offerPrice === "number" && p.offerPrice > 0 && p.offerPrice < regular;
    const impl = implFor(p.name);
    const hl = new Set((p.highlightedFeatures || []).map((f) => f.trim().toLowerCase()));
    return {
      id: p.id,
      name: p.name,
      price: hasOffer ? (p.offerPrice as number) : regular,
      regularPrice: hasOffer ? regular : null,
      priceFrom: p.priceFrom === true,
      subtitle: p.subtitle?.trim() || (impl != null ? `+ ${fmt(impl)} implementación única` : null),
      includes: (p.includedAddons || []).map((id) => cfg.addons.find((a) => a.id === id)?.name).filter(Boolean) as string[],
      // Primero las características resaltadas (★).
      features: [...p.features.filter((f) => hl.has(f.trim().toLowerCase())), ...p.features.filter((f) => !hl.has(f.trim().toLowerCase()))],
      highlighted: p.features.filter((f) => hl.has(f.trim().toLowerCase())),
      recommended: isHighlight(p, accent),
    };
  };

  const items = [...cfg.plans.map((p) => ({ p, pool: "plans" })), ...cfg.addons.map((p) => ({ p, pool: "addons" }))];
  const sections = sectionsMeta
    .map((s) => ({
      id: s.id, title: s.title, subtitle: s.subtitle,
      plans: items.filter(({ p, pool }) => ((p.categoryId && valid.has(p.categoryId)) ? p.categoryId : pool === "plans" ? "__plans" : "__addons") === s.id).map(({ p }) => toDemo(p, s.accent)),
    }))
    // Los "combos" de /admin/planes no se muestran en la demo.
    .map((s) => ({ ...s, plans: s.plans.filter((p) => !/combo/i.test(p.name)) }))
    .filter((s) => s.plans.length > 0 && !/combo/i.test(s.title));

  // Plan de tienda para la calculadora de comisiones: el destacado de la sección principal (o el más caro).
  const main = sections.find((s) => s.id === "__plans")?.plans ?? [];
  const store = main.find((p) => p.recommended) ?? [...main].sort((a, b) => b.price - a.price)[0] ?? null;
  return { sections, storePlan: store ? { name: store.name, price: store.price } : null };
}
