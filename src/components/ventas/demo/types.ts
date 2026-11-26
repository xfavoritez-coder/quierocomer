// Datos que recibe la demo: los del local capturado o los del local ficticio.
export type DemoDish = { name: string; price: number; photo: string | null; description?: string | null; emoji?: string };
export type DemoCategory = { name: string; dishes: DemoDish[] };

export type DemoData = {
  leadId: string | null; // null = demo ficticia (no registra eventos)
  name: string;
  logoUrl: string | null;
  color: string; // color principal del local (#RRGGBB)
  bannerUrl: string | null;
  cuisine: string | null;
  commune: string | null;
  slug: string | null; // local demo real (para el QR que abre su carta en el celular del dueño)
  categories: DemoCategory[];
  isFictional: boolean;
  /** Planes y precios desde /admin/planes. */
  plans: DemoPlanSection[];
  /** Plan de tienda usado en la calculadora de comisiones. */
  storePlan: { name: string; price: number } | null;
};

export type DemoPlan = {
  id: string; name: string; price: number; regularPrice: number | null; priceFrom: boolean;
  subtitle: string | null; includes: string[]; features: string[]; highlighted: string[]; recommended: boolean;
};
export type DemoPlanSection = { id: string; title: string; subtitle: string; plans: DemoPlan[] };

/** Pedido de prueba hecho por el dueño desde su celular (tienda demo). */
export type LiveOrder = {
  id: string; number: number | null; customer: string; phone: string; payment: string; note: string | null;
  lines: { name: string; qty: number; price: number }[]; total: number; at: string;
};

export type ChapterId = "inicio" | "carta" | "loyalty" | "ecommerce" | "pos" | "planes";

/** Comisión de referencia de las apps de delivery (calculadora de la tienda). */
export const DEFAULT_APP_COMMISSION = 0.28;
