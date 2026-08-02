"use client";
import { useState, useEffect } from "react";

// ─── string dictionary ───────────────────────────────────────────────────────

const es = {
  // Shared nav
  nav_login: "Ingresar",
  nav_contact: "Contactar",
  nav_back: "← QuieroComer",
  nav_cta: "Probar gratis",

  // Home hero
  hero_label: "Plataforma de marketing para restaurantes",
  hero_title: "Haz que tus clientes se enamoren de tu restaurant",
  hero_title_highlight: "se enamoren",
  hero_subtitle: "Transforma tu negocio en una máquina de fidelización. Los locales que usan QuieroComer aumentan un 30% sus ventas.",
  hero_cta: "Probar gratis por 7 días",
  hero_demo: "Ver demo →",
  hero_note: "Sin tarjeta · Sin contratos",

  // Home modules
  module_qr_label: "Carta QR + Pedidos Online",
  module_qr_desc: "Carta multidioma, imprimir en PDF diseño profesional, llamar al garzón y mucho más.",
  module_qr_subdesc: "Recibe pedidos directamente desde la carta — delivery, retiro o en mesa. Sin comisiones.",
  module_qr_demo: "Ver demo →",
  module_qr_more: "Conocer más →",
  module_loyalty_label: "Programa de Loyalty",
  module_loyalty_desc: "Tarjeta digital en Apple Wallet y Google Wallet. Tus clientes acumulan sellos, ganan premios y reciben notificaciones al pasar por tu local.",
  module_loyalty_demo: "Ver tarjeta demo →",

  // Loyalty mock UI
  loyalty_mock_header: "Loyalty · El Menú de la Esquina",
  loyalty_card_title: "Tu tarjeta de sellos",
  loyalty_progress: "6 de 10 sellos · 4 más para tu premio 🎁",

  // Home restaurants section
  restaurants_trust_title: "Restaurantes que ",
  restaurants_trust_highlight: "confían",
  restaurants_trust_suffix: " en QuieroComer",
  restaurants_label: "Más de 100 restaurantes en Chile ya lo usan",

  // Home testimonials
  testimonials_title: "Lo que dicen nuestros clientes",

  // Home pricing
  pricing_label: "Precios",
  pricing_title: "Precios simples, sin sorpresas",
  pricing_subtitle: "Sin comisiones, sin permanencia mínima.",
  pricing_trial: "7 días gratis",
  plan_pro: "Carta QR + pedidos online",
  plan_price_pro: "$44.900",
  plan_price_unit: "/mes",
  plan_price_tax: "\u00a0",
  plan_cta_pro: "Empezar gratis 7 días",
  plan_addon: "Pruébalo 7 días",
  plan_loyalty: "Módulo Loyalty",
  plan_price_loyalty: "$25.900",
  plan_loyalty_note: "Se suma al Plan Pro",
  plan_cta_loyalty: "Probar Loyalty gratis",

  // Home final CTA
  final_title: "Lleva tu restaurant al siguiente nivel",
  final_subtitle: "Sé parte de la evolución gastronómica.",
  final_cta: "Empezar gratis ahora",
  final_note: "Sin tarjeta ni contratos",

  // Modal / registration form
  modal_title: "Empieza gratis hoy",
  modal_subtitle: "7 días sin cobrar nada. Sin tarjeta.",
  form_owner: "Tu nombre",
  form_owner_ph: "María González",
  form_local: "Nombre del local",
  form_local_ph: "Restaurante El Sabor",
  form_email: "Tu email",
  form_email_ph: "maria@restaurante.cl",
  form_whatsapp: "Tu WhatsApp",
  form_whatsapp_ph: "9 1234 5678",
  form_submit: "Empezar mis 7 días gratis →",
  form_loading: "Creando tu cuenta...",
  form_error_fields: "Por favor completa nombre del local y email",

  // /carta-qr hero
  carta_label: "Carta QR",
  carta_hero_title: "Una carta que realmente antoja",
  carta_hero_subtitle: "Tu menú presentado como merece: con fotos que antojan, categorías claras y listo en minutos.",
  carta_hero_cta1: "Ver carta en vivo →",
  carta_hero_cta2: "Probar 7 días gratis",
  carta_features_title: "Todo lo que tu carta necesita",
  carta_bottom_title: "Lista para tu restaurant al instante",
  carta_bottom_subtitle: "Sin tarjeta de crédito. Cancelación cuando quieras.",
  carta_bottom_cta: "Empezar gratis 7 días",

  // /carta-qr iPhone mock categories
  mock_all: "Todo",
  mock_starters: "Entradas",
  mock_pizzas: "Pizzas",
  mock_desserts: "Postres",

  // /fidelizacion hero
  fid_label: "Módulo Loyalty",
  fid_hero_title: "Que vuelvan solos. Siempre.",
  fid_hero_subtitle: "Tarjeta de sellos digital en el teléfono de tu cliente. Sin app, sin papel.",
  fid_hero_cta1: "Ver tarjeta demo →",
  fid_hero_cta2: "Probar 7 días gratis",
  fid_how_title: "Cómo funciona",
  fid_proximity_title: "Envía notificaciones automáticas por horario o cercanía",
  fid_proximity_subtitle: "Cuando un cliente pasa a metros de tu local, recibe una notificación push automática con tu oferta del día. Sin publicidad, sin costo extra.",
  fid_bottom_title: "Pruébalo 7 días gratis",
  fid_bottom_subtitle: "Prueba el módulo Loyalty sin riesgo. Cancela cuando quieras.",
  fid_bottom_cta: "Probar Loyalty gratis →",

  // /fidelizacion notification mock
  fid_notif_app: "Wallet",
  fid_notif_now: "ahora",
  fid_notif_title: "La Taberna Mori está cerca",
  fid_notif_body: "🎁 Lleva tu tarjeta y suma un sello. ¡Falta poco para tu regalo!",
  fid_phone_date: "Martes, 31 de julio",

  // Footer
  footer_tagline: "Plataforma digital para restaurantes. Carta QR, fidelización y pedidos online.",
  footer_product: "Producto",
  footer_contact: "Contacto",
  footer_qr: "Carta QR",
  footer_loyalty: "Loyalty",
  footer_pricing: "Precios",
  footer_panel: "Ingresar al panel",
  footer_copy: "© 2026 QuieroComer",
  footer_badge: "Santiago de Chile 🇨🇱",
};

const en: typeof es = {
  // Shared nav
  nav_login: "Sign in",
  nav_contact: "Contact",
  nav_back: "← QuieroComer",
  nav_cta: "Try for free",

  // Home hero
  hero_label: "Restaurant platform · Chile",
  hero_title: "Make your customers fall in love with your restaurant",
  hero_title_highlight: "fall in love",
  hero_subtitle: "Turn your business into a loyalty machine. Restaurants using QuieroComer increase their sales by 30%.",
  hero_cta: "Try free for 7 days",
  hero_demo: "See demo →",
  hero_note: "No credit card · No contracts",

  // Home modules
  module_qr_label: "QR Menu + Online Orders",
  module_qr_desc: "Multilingual menu, professional PDF export, waiter call and much more.",
  module_qr_subdesc: "Receive orders directly from the menu — delivery, pickup or table. No commissions.",
  module_qr_demo: "See demo →",
  module_qr_more: "Learn more →",
  module_loyalty_label: "Loyalty Program",
  module_loyalty_desc: "Digital card in Apple Wallet and Google Wallet. Your customers collect stamps, earn rewards and receive notifications when they pass your restaurant.",
  module_loyalty_demo: "See demo card →",

  // Loyalty mock UI
  loyalty_mock_header: "Loyalty · El Menú de la Esquina",
  loyalty_card_title: "Your stamp card",
  loyalty_progress: "6 of 10 stamps · 4 more for your reward 🎁",

  // Home restaurants section
  restaurants_trust_title: "Restaurants that ",
  restaurants_trust_highlight: "trust",
  restaurants_trust_suffix: " QuieroComer",
  restaurants_label: "Over 100 restaurants in Chile already use it",

  // Home testimonials
  testimonials_title: "What our customers say",

  // Home pricing
  pricing_label: "Pricing",
  pricing_title: "Simple pricing, no surprises",
  pricing_subtitle: "No commissions, no minimum commitment.",
  pricing_trial: "7 days free",
  plan_pro: "Pro Plan",
  plan_price_pro: "$44,900",
  plan_price_unit: "/mo",
  plan_price_tax: "\u00a0",
  plan_cta_pro: "Start free 7 days",
  plan_addon: "Try it 7 days",
  plan_loyalty: "Loyalty Module",
  plan_price_loyalty: "$25,900",
  plan_loyalty_note: "Added to Pro Plan",
  plan_cta_loyalty: "Try Loyalty free",

  // Home final CTA
  final_title: "Ready to grow your business?",
  final_subtitle: "Be part of the gastronomic evolution.",
  final_cta: "Start free now",
  final_note: "No credit card or contracts",

  // Modal / registration form
  modal_title: "Start for free today",
  modal_subtitle: "7 days completely free. No credit card.",
  form_owner: "Your name",
  form_owner_ph: "María González",
  form_local: "Restaurant name",
  form_local_ph: "My Restaurant",
  form_email: "Your email",
  form_email_ph: "maria@myrestaurant.com",
  form_whatsapp: "Your WhatsApp",
  form_whatsapp_ph: "9 1234 5678",
  form_submit: "Start my 7 free days →",
  form_loading: "Creating your account...",
  form_error_fields: "Please fill in restaurant name and email",

  // /carta-qr hero
  carta_label: "QR Menu",
  carta_hero_title: "A menu that truly tempts",
  carta_hero_subtitle: "Your menu presented as it deserves: with mouth-watering photos, clear categories and ready in minutes.",
  carta_hero_cta1: "See live menu →",
  carta_hero_cta2: "Try free 7 days",
  carta_features_title: "Everything your menu needs",
  carta_bottom_title: "Ready for your restaurant instantly",
  carta_bottom_subtitle: "No credit card. Cancel anytime.",
  carta_bottom_cta: "Start free 7 days",

  // /carta-qr iPhone mock categories
  mock_all: "All",
  mock_starters: "Starters",
  mock_pizzas: "Pizzas",
  mock_desserts: "Desserts",

  // /fidelizacion hero
  fid_label: "Loyalty Module",
  fid_hero_title: "Keep them coming back. Always.",
  fid_hero_subtitle: "Digital stamp card on your customer's phone. No app, no paper.",
  fid_hero_cta1: "See demo card →",
  fid_hero_cta2: "Try free 7 days",
  fid_how_title: "How it works",
  fid_proximity_title: "Send automatic notifications by schedule or proximity",
  fid_proximity_subtitle: "When a customer walks near your restaurant, they automatically receive a push notification with your daily offer. No ads, no extra cost.",
  fid_bottom_title: "Try it free for 7 days",
  fid_bottom_subtitle: "Try the Loyalty module risk-free. Cancel anytime.",
  fid_bottom_cta: "Try Loyalty free →",

  // /fidelizacion notification mock
  fid_notif_app: "Wallet",
  fid_notif_now: "now",
  fid_notif_title: "La Taberna Mori is nearby",
  fid_notif_body: "🎁 Bring your card and get stamp #7. Almost there for your reward!",
  fid_phone_date: "Tuesday, July 31",

  // Footer
  footer_tagline: "Digital platform for restaurants. QR menu, loyalty and online orders.",
  footer_product: "Product",
  footer_contact: "Contact",
  footer_qr: "QR Menu",
  footer_loyalty: "Loyalty",
  footer_pricing: "Pricing",
  footer_panel: "Sign in to panel",
  footer_copy: "© 2026 QuieroComer",
  footer_badge: "Santiago, Chile 🇨🇱",
};

// ─── Arrays ──────────────────────────────────────────────────────────────────

export const PRO_FEATURES_ES = [
  "Aumenta el ticket promedio de tus mesas",
  "Carta QR inteligente",
  "Carta exportable en PDF",
  "Pedidos online sin comisión",
  "Llamado al garzón por QR",
  "Multi-idioma automático",
];

export const PRO_FEATURES_EN = [
  "Smart QR menu",
  "Export menu to PDF",
  "Waiter call via QR",
  "Announcements and promotions in the menu",
  "Online orders with no commission",
  "Automatic multilingual translation",
];

export const LOYALTY_FEATURES_ES = [
  "Notificaciones automáticas por cercanía",
  "Tus clientes vuelven solos",
  "Aumenta tus ventas hasta un 30%",
  "Tarjeta en el celular, sin app",
  "Tú defines los premios y las reglas",
  "Sin límite de miembros ni canjes",
];

export const LOYALTY_FEATURES_EN = [
  "Digital card in Apple Wallet and Google Wallet",
  "Configurable stamps per visit",
  "Custom prizes and rewards",
  "Proximity push notifications",
  "Members and redemptions dashboard",
  "Unlimited customers and passes",
];

export const TESTIMONIALS_ES = [
  { quote: "Antes imprimíamos la carta cada vez que cambiábamos un precio. Ahora la actualizo desde el teléfono en dos minutos y ya está.", name: "Alfredo M.", restaurant: "Hand Roll", initials: "AM" },
  { quote: "Tenía clientes que venían cada dos semanas. Desde que activamos los sellos de fidelización, los mismos están viniendo todas las semanas.", name: "Carlos G.", restaurant: "Horus Vegan", initials: "CG" },
  { quote: "Mis clientes ahora deciden mucho más rápido qué pedir. El garzón usa menos tiempo explicando platos y puede atender más mesas.", name: "Tomás L.", restaurant: "Alleria Pizza", initials: "TL" },
  { quote: "Me di cuenta que el 70% de la gente miraba solo tres platos. Reordené la carta y empecé a vender más los que me dejan mejor margen.", name: "Javier M.", restaurant: "Juana la Brava", initials: "JM" },
  { quote: "Los turistas ahora pueden leer la carta en inglés solos. Antes tenía que estar explicando cada plato yo mismo.", name: "Cristian C.", restaurant: "El Menú de la Esquina", initials: "CC" },
];

export const TESTIMONIALS_EN = [
  { quote: "We used to reprint the menu every time we changed a price. Now I update it from my phone in two minutes and it's done.", name: "Alfredo M.", restaurant: "Hand Roll", initials: "AM" },
  { quote: "Customers used to come every two weeks. Since we activated the loyalty stamps, the same people are coming every week.", name: "Carlos G.", restaurant: "Horus Vegan", initials: "CG" },
  { quote: "My customers now decide much faster what to order. The waiter spends less time explaining dishes and can serve more tables.", name: "Tomás L.", restaurant: "Alleria Pizza", initials: "TL" },
  { quote: "I realized 70% of people were only looking at three dishes. I reordered the menu and started selling more of the high-margin items.", name: "Javier M.", restaurant: "Juana la Brava", initials: "JM" },
  { quote: "Tourists can now read the menu in English on their own. Before I had to explain every single dish myself.", name: "Cristian C.", restaurant: "El Menú de la Esquina", initials: "CC" },
];

export const CARTA_FEATURES_ES = [
  { icon: "📸", bg: "linear-gradient(135deg,#ede9fe,#c4b5fd)", title: "Fotos que antojan", desc: "Sube fotos de tus platos y se muestran en un formato que convierte el apetito en pedidos." },
  { icon: "📱", bg: "linear-gradient(135deg,#ede9ve,#a78bfa)", title: "Pedidos online", desc: "Activa pedidos directo desde la carta. Sin comisión ni app de terceros." },
  { icon: "🌍", bg: "linear-gradient(135deg,#dbeafe,#93c5fd)", title: "Multi-idioma automático", desc: "Tu carta se traduce automáticamente para turistas sin que tú hagas nada." },
  { icon: "🛎️", bg: "linear-gradient(135deg,#fef3c7,#fcd34d)", title: "Llamado al garzón", desc: "El cliente llama al mozo con un toque desde su teléfono. Sin papelitos ni botones físicos." },
  { icon: "📊", bg: "linear-gradient(135deg,#d1fae5,#6ee7b7)", title: "Estadísticas en tiempo real", desc: "Mira qué platos miran más, a qué hora llega gente y cuáles se piden más." },
  { icon: "📢", bg: "linear-gradient(135deg,#fee2e2,#fca5a5)", title: "Anuncios y promociones", desc: "Comunica el menú del día, eventos o promociones directo al abrir la carta." },
];

export const CARTA_FEATURES_EN = [
  { icon: "📸", bg: "linear-gradient(135deg,#ede9fe,#c4b5fd)", title: "Mouth-watering photos", desc: "Upload photos of your dishes and display them in a format that turns appetite into orders." },
  { icon: "📱", bg: "linear-gradient(135deg,#ede9ve,#a78bfa)", title: "Online orders", desc: "Enable orders directly from your menu. No commission, no third-party app." },
  { icon: "🌍", bg: "linear-gradient(135deg,#dbeafe,#93c5fd)", title: "Automatic multilingual", desc: "Your menu is automatically translated for tourists without you doing anything." },
  { icon: "🛎️", bg: "linear-gradient(135deg,#fef3c7,#fcd34d)", title: "Waiter call", desc: "Customers call the waiter with one tap from their phone. No paper, no physical buttons." },
  { icon: "📊", bg: "linear-gradient(135deg,#d1fae5,#6ee7b7)", title: "Real-time analytics", desc: "See which dishes get the most views, at what time customers arrive and what gets ordered most." },
  { icon: "📢", bg: "linear-gradient(135deg,#fee2e2,#fca5a5)", title: "Announcements and promotions", desc: "Share the daily menu, events or promotions right when customers open the menu." },
];

export const FID_STEPS_ES = [
  { num: 1, icon: "🎁", title: "Diseña tu tarjeta", desc: "Elige colores, íconos y cuántos sellos das por visita. En minutos tienes tu programa listo." },
  { num: 2, icon: "📱", title: "El cliente la agrega a su wallet digital", desc: "Escanea un QR y la tarjeta aparece en Apple Wallet o Google Wallet. Sin app que descargar." },
  { num: 3, icon: "✅", title: "Sumas sellos en caja", desc: "Apuntas tu cámara al QR del cliente. Un sello al instante. Sin tocar su teléfono." },
  { num: 4, icon: "🎉", title: "El cliente vuelve por su premio", desc: "Cuando completa la tarjeta, reclama su recompensa y el ciclo empieza de nuevo." },
  { num: 5, icon: "🔔", title: "Envía notificaciones cuando quieras", desc: "Manda un mensaje por horario o por cercanía. Cuando el cliente pasa cerca de tu local, recibe una notificación directo en su teléfono." },
];

export const FID_STEPS_EN = [
  { num: 1, icon: "🎁", title: "Design your card", desc: "Choose colors, icons and how many stamps per visit. Your program is ready in minutes." },
  { num: 2, icon: "📱", title: "Customer adds it to their digital wallet", desc: "They scan a QR and the card appears in Apple Wallet or Google Wallet. No app to download." },
  { num: 3, icon: "✅", title: "Add stamps at checkout", desc: "Point your camera at the customer's QR code. One stamp instantly. No touching their phone." },
  { num: 4, icon: "🎉", title: "Customer comes back for their reward", desc: "When they complete the card, they claim their reward and the cycle starts again." },
  { num: 5, icon: "🔔", title: "Send notifications whenever you want", desc: "Send a message by schedule or by proximity. When a customer walks near your restaurant, they get a notification right on their phone." },
];

// ─── Hook ────────────────────────────────────────────────────────────────────

export type LandingLang = "es" | "en";

export function useLandingLang() {
  const [lang, setLang] = useState<LandingLang>("es");

  useEffect(() => {
    const nav = typeof navigator !== "undefined" ? navigator.language : "";
    if (nav.startsWith("en")) setLang("en");
  }, []);

  const t = (key: keyof typeof es): string => {
    const dict = lang === "en" ? en : es;
    return dict[key] ?? key;
  };

  const isEn = lang === "en";

  return {
    t,
    lang,
    isEn,
    proFeatures: isEn ? PRO_FEATURES_EN : PRO_FEATURES_ES,
    loyaltyFeatures: isEn ? LOYALTY_FEATURES_EN : LOYALTY_FEATURES_ES,
    testimonials: isEn ? TESTIMONIALS_EN : TESTIMONIALS_ES,
    cartaFeatures: isEn ? CARTA_FEATURES_EN : CARTA_FEATURES_ES,
    fidSteps: isEn ? FID_STEPS_EN : FID_STEPS_ES,
  };
}
