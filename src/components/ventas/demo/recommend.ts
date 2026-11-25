// Plan recomendado según los módulos que le interesaron al dueño durante la demo.
// Sin dependencias de servidor: se usa en la demo (cliente) y en las APIs.
import type { DemoPlan, DemoPlanSection } from "./types";

export const INTEREST_MODULES = [
  { id: "carta_qr", label: "Carta QR" },
  { id: "loyalty", label: "Fidelización" },
  { id: "ecommerce", label: "Tienda online" },
  { id: "pos", label: "POS" },
] as const;
export type InterestModule = (typeof INTEREST_MODULES)[number]["id"];

// Palabras que indican que un plan cubre cada módulo (en su nombre o características).
const KEYWORDS: Record<InterestModule, RegExp> = {
  carta_qr: /carta qr|carta|qr|garz[oó]n|multilenguaje/i,
  loyalty: /loyalty|fidelizaci|membres|tarjeta|wallet|cumplea/i,
  ecommerce: /ecommerce|sitio web|pedidos|tienda|delivery|pasarela|comandador/i,
  pos: /\bpos\b|punto de venta|caja|inventario|bodega|mesas/i,
};

const allPlans = (sections: DemoPlanSection[]) => sections.flatMap((s) => s.plans);

/** Id del plan a recomendar; si no hay intereses marcados, el recomendado del admin. */
export function recommendPlanId(sections: DemoPlanSection[], interests: string[]): string | null {
  const plans = allPlans(sections);
  if (!plans.length) return null;
  const adminPick = plans.find((p) => p.recommended)?.id ?? null;
  const wanted = interests.filter((i): i is InterestModule => i in KEYWORDS);
  if (!wanted.length) return adminPick;
  const score = (p: DemoPlan) => {
    const text = `${p.name} ${p.includes.join(" ")} ${p.features.join(" ")}`;
    return wanted.reduce((n, m) => n + (KEYWORDS[m].test(text) ? 1 : 0), 0);
  };
  const best = Math.max(...plans.map(score));
  if (best === 0) return adminPick;
  const top = plans.filter((p) => score(p) === best);
  // Empate: el recomendado del admin; si no, el más barato que cubre lo pedido.
  return (top.find((p) => p.recommended) ?? [...top].sort((a, b) => a.price - b.price)[0]).id;
}

/** Las secciones con la marca de "Recomendado" puesta en el plan elegido. */
export function withRecommendation(sections: DemoPlanSection[], planId: string | null): DemoPlanSection[] {
  if (!planId) return sections;
  return sections.map((s) => ({ ...s, plans: s.plans.map((p) => ({ ...p, recommended: p.id === planId })) }));
}
