// ═══════════════════════════════════════════════════════════
//  Textos de la página de seguimiento del pedido (/pedido/[id]).
//  Editables por el superadmin en /admin/ajustes. Se guardan como
//  JSON en PlatformSetting("tracking_texts"). Este módulo es PURO
//  (sin prisma) para poder importarse también en el cliente.
// ═══════════════════════════════════════════════════════════

export interface TrackingTexts {
  headerSubtitle: string;
  // Título + subtítulo por estado
  pendingTitle: string; pendingSub: string;
  acceptedTitle: string; acceptedSub: string;
  preparingTitle: string; preparingSub: string;
  inDeliveryTitle: string; inDeliverySub: string;
  readyTitle: string; readyDeliverySub: string; readyPickupSub: string;
  doneTitle: string; doneSub: string;
  cancelledTitle: string; cancelledBody: string;
  // Etiquetas de la línea de tiempo (stepper)
  stepReceived: string; stepAccepted: string; stepPreparing: string;
  stepInDelivery: string; stepReady: string; stepDone: string;
}

export const DEFAULT_TRACKING_TEXTS: TrackingTexts = {
  headerSubtitle: "Seguimiento de pedido",
  pendingTitle: "Pedido recibido",
  pendingSub: "Recibimos tu pedido, en breve lo confirmamos.",
  acceptedTitle: "¡Pedido aceptado!",
  acceptedSub: "El local va a empezar a prepararlo.",
  preparingTitle: "Preparando tu pedido",
  preparingSub: "Manos a la obra en la cocina 👨‍🍳",
  inDeliveryTitle: "Tu pedido va en camino",
  inDeliverySub: "El repartidor ya salió con tu pedido 🛵",
  readyTitle: "¡Tu pedido está listo!",
  readyDeliverySub: "Ya puede salir a reparto.",
  readyPickupSub: "Puedes pasar a retirarlo 🏠",
  doneTitle: "¡Pedido entregado!",
  doneSub: "Gracias por tu compra 🎉",
  cancelledTitle: "Pedido cancelado",
  cancelledBody: "Lamentamos informarte que tu pedido fue cancelado.",
  stepReceived: "Recibido",
  stepAccepted: "Aceptado",
  stepPreparing: "Preparando",
  stepInDelivery: "En reparto",
  stepReady: "Listo",
  stepDone: "Entregado",
};

/** Fusiona los overrides guardados sobre los textos por defecto (solo strings no vacíos). */
export function parseTrackingTexts(raw: unknown): TrackingTexts {
  const out: TrackingTexts = { ...DEFAULT_TRACKING_TEXTS };
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    for (const k of Object.keys(DEFAULT_TRACKING_TEXTS) as (keyof TrackingTexts)[]) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) out[k] = v;
    }
  }
  return out;
}

/** Título + subtítulo a mostrar según estado del pedido y tipo de entrega. */
export function trackingStatusText(t: TrackingTexts, status: string, orderType: "PICKUP" | "DELIVERY"): { t: string; s: string } {
  switch (status) {
    case "PENDING": return { t: t.pendingTitle, s: t.pendingSub };
    case "ACCEPTED": return { t: t.acceptedTitle, s: t.acceptedSub };
    case "PREPARING": return { t: t.preparingTitle, s: t.preparingSub };
    case "IN_DELIVERY": return { t: t.inDeliveryTitle, s: t.inDeliverySub };
    case "READY": return { t: t.readyTitle, s: orderType === "DELIVERY" ? t.readyDeliverySub : t.readyPickupSub };
    case "DONE": return { t: t.doneTitle, s: t.doneSub };
    default: return { t: t.headerSubtitle, s: "" };
  }
}

/** Grupos de campos para el formulario del admin. */
export const TRACKING_TEXT_GROUPS: { group: string; fields: { key: keyof TrackingTexts; label: string; multiline?: boolean }[] }[] = [
  {
    group: "General",
    fields: [{ key: "headerSubtitle", label: "Subtítulo del encabezado" }],
  },
  {
    group: "Estado: Pedido recibido (nuevo)",
    fields: [
      { key: "pendingTitle", label: "Título" },
      { key: "pendingSub", label: "Subtítulo", multiline: true },
    ],
  },
  {
    group: "Estado: Aceptado",
    fields: [
      { key: "acceptedTitle", label: "Título" },
      { key: "acceptedSub", label: "Subtítulo", multiline: true },
    ],
  },
  {
    group: "Estado: Preparando",
    fields: [
      { key: "preparingTitle", label: "Título" },
      { key: "preparingSub", label: "Subtítulo", multiline: true },
    ],
  },
  {
    group: "Estado: En reparto (delivery)",
    fields: [
      { key: "inDeliveryTitle", label: "Título" },
      { key: "inDeliverySub", label: "Subtítulo", multiline: true },
    ],
  },
  {
    group: "Estado: Listo",
    fields: [
      { key: "readyTitle", label: "Título" },
      { key: "readyDeliverySub", label: "Subtítulo (delivery)", multiline: true },
      { key: "readyPickupSub", label: "Subtítulo (retiro)", multiline: true },
    ],
  },
  {
    group: "Estado: Entregado",
    fields: [
      { key: "doneTitle", label: "Título" },
      { key: "doneSub", label: "Subtítulo", multiline: true },
    ],
  },
  {
    group: "Estado: Cancelado",
    fields: [
      { key: "cancelledTitle", label: "Título" },
      { key: "cancelledBody", label: "Mensaje", multiline: true },
    ],
  },
  {
    group: "Línea de tiempo (pasos)",
    fields: [
      { key: "stepReceived", label: "Paso: Recibido" },
      { key: "stepAccepted", label: "Paso: Aceptado" },
      { key: "stepPreparing", label: "Paso: Preparando" },
      { key: "stepInDelivery", label: "Paso: En reparto (delivery)" },
      { key: "stepReady", label: "Paso: Listo (retiro)" },
      { key: "stepDone", label: "Paso: Entregado" },
    ],
  },
];
