"use client";
import { createContext, useContext, useState } from "react";

export type OrderLang = "es" | "en";

const strings = {
  es: {
    myOrder: "Mi pedido",
    emptyCart: "Tu carrito está vacío",
    orderTotal: "Total del pedido",
    goCheckout: "Ir al checkout →",
    dishNotes: "Notas del plato (opcional)",
    dishNotesPlaceholder: "Ej: Sin cebolla, bien cocido...",
    required: "Obligatorio",
    optional: "Opcional",
    maxN: (n: number) => `máx. ${n}`,
    selectRequired: "Selecciona las opciones obligatorias para continuar",
    addToCart: "Agregar al carrito",
    viewCart: "Ver carrito",
    all: "Todo",
    noResults: (q: string) => `Sin resultados para "${q}"`,
    checkoutTitle: "Finalizar pedido",
    howReceive: "¿Cómo quieres recibir tu pedido?",
    pickupLabel: "Retiro",
    deliveryLabel: "Delivery",
    pickupAt: "Retira en",
    estimatedTime: "Tiempo estimado:",
    yourDetails: "Tus datos",
    namePlaceholder: "Tu nombre *",
    phonePlaceholder: "Tu teléfono *",
    addressPlaceholder: "Dirección de delivery *",
    belowMin: (min: string, cur: string) =>
      `El monto mínimo para delivery es ${min}. Tu pedido va en ${cur}.`,
    orderNotes: "Notas del pedido (opcional)",
    summary: "Resumen",
    total: "Total",
    sendWhatsApp: "Enviar pedido por WhatsApp",
    whatsAppHint: "Se abrirá WhatsApp con tu pedido listo para enviar",
    waMsgTitle: (r: string) => `*Pedido - ${r}*`,
    waMsgName: "Nombre:",
    waMsgPhone: "Telefono:",
    waMsgType: "Tipo:",
    waMsgPickup: "Retiro en local",
    waMsgDelivery: "Delivery",
    waMsgAddress: "Direccion:",
    waMsgLocal: "Local:",
    waMsgProducts: "*Productos:*",
    waMsgTotal: (t: string) => `*Total: ${t}*`,
    waMsgNotes: "Notas:",
    waMsgFooter: (slug: string) =>
      `_Pedido enviado desde quierocomer.com/pedir/${slug}_`,
    noPhone:
      "El local no tiene número de WhatsApp configurado. Se copió el pedido al portapapeles.",
    itemNote: "Nota:",
  },
  en: {
    myOrder: "My order",
    emptyCart: "Your cart is empty",
    orderTotal: "Order total",
    goCheckout: "Go to checkout →",
    dishNotes: "Dish notes (optional)",
    dishNotesPlaceholder: "E.g: No onion, well done...",
    required: "Required",
    optional: "Optional",
    maxN: (n: number) => `max. ${n}`,
    selectRequired: "Select required options to continue",
    addToCart: "Add to cart",
    viewCart: "View cart",
    all: "All",
    noResults: (q: string) => `No results for "${q}"`,
    checkoutTitle: "Complete order",
    howReceive: "How would you like to receive your order?",
    pickupLabel: "Pickup",
    deliveryLabel: "Delivery",
    pickupAt: "Pick up at",
    estimatedTime: "Estimated time:",
    yourDetails: "Your details",
    namePlaceholder: "Your name *",
    phonePlaceholder: "Your phone *",
    addressPlaceholder: "Delivery address *",
    belowMin: (min: string, cur: string) =>
      `Minimum for delivery is ${min}. Your order is ${cur}.`,
    orderNotes: "Order notes (optional)",
    summary: "Summary",
    total: "Total",
    sendWhatsApp: "Send order via WhatsApp",
    whatsAppHint: "WhatsApp will open with your order ready to send",
    waMsgTitle: (r: string) => `*Order - ${r}*`,
    waMsgName: "Name:",
    waMsgPhone: "Phone:",
    waMsgType: "Type:",
    waMsgPickup: "Pickup",
    waMsgDelivery: "Delivery",
    waMsgAddress: "Address:",
    waMsgLocal: "Location:",
    waMsgProducts: "*Products:*",
    waMsgTotal: (t: string) => `*Total: ${t}*`,
    waMsgNotes: "Notes:",
    waMsgFooter: (slug: string) =>
      `_Order sent from quierocomer.com/pedir/${slug}_`,
    noPhone:
      "This restaurant has no WhatsApp number configured. The order was copied to clipboard.",
    itemNote: "Note:",
  },
} as const;

export type OrderStrings = typeof strings[OrderLang];

interface OrderLangCtx {
  lang: OrderLang;
  setLang: (l: OrderLang) => void;
  s: OrderStrings;
}

const Ctx = createContext<OrderLangCtx>({
  lang: "es",
  setLang: () => {},
  s: strings.es,
});

export function OrderLangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<OrderLang>("es");
  return (
    <Ctx.Provider value={{ lang, setLang, s: strings[lang] }}>
      {children}
    </Ctx.Provider>
  );
}

export function useOrderLang() {
  return useContext(Ctx);
}
