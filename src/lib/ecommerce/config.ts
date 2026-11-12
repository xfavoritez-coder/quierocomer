// ═══════════════════════════════════════════════════════════
//  Ecommerce — configuración de credenciales por restaurante
//  Vive en Restaurant.ecommerceConfig (JSON). Solo el superadmin
//  la edita. Aquí definimos el shape y helpers de estado.
// ═══════════════════════════════════════════════════════════

export interface WebpayCreds {
  env?: "integration" | "production";
  commerceCode?: string; // solo producción
  apiKey?: string; // solo producción
}

export interface FlowCreds {
  env?: "sandbox" | "production";
  apiKey?: string;
  secretKey?: string;
}

export interface MercadoPagoCreds {
  env?: "sandbox" | "production";
  accessToken?: string; // Access Token (secreto, server-side)
  publicKey?: string; // Public Key (opcional)
}

export interface UberDirectCreds {
  customerId?: string; // Uber Direct customer id
  clientId?: string;
  clientSecret?: string;
  signingKey?: string; // clave de firma de webhooks (X-Uber-Signature)
}

export interface PedidosYaCreds {
  env?: "sandbox" | "production";
  clientId?: string;
  clientSecret?: string;
}

/** Google Maps: autocompletado de direcciones, geocoding y (futuro) zonas por mapa. */
export interface GoogleMapsCreds {
  apiKey?: string;
}

/** Twilio WhatsApp: avisa al cliente cuando su pedido entra al Centro de pedidos.
 *  Usa una plantilla aprobada (Content SID) por requisito de WhatsApp para
 *  mensajes iniciados por el negocio. */
export interface TwilioCreds {
  enabled?: boolean;
  accountSid?: string;   // AC...
  authToken?: string;    // token secreto
  from?: string;         // número WhatsApp remitente, ej "+14155238886" (se antepone whatsapp:)
  messagingServiceSid?: string; // alternativa a "from" (MG...)
  contentSid?: string;   // plantilla aprobada de WhatsApp (HX...)
}

/** Credenciales del POS Toteat para inyectar pedidos (estilo Servio / deliveryhandroll). */
export interface ToteatPosCreds {
  apiUrl?: string; // default https://api.toteat.com/mw/or/1.0
  xir?: string; // Restaurant ID
  xil?: string; // Local ID
  xiu?: string; // User ID (por defecto = xil)
  token?: string; // xapitoken
  discountCode?: string; // código de producto Toteat para la línea de descuento (default "DESCUENTO")
}

export type PosProvider = "none" | "toteat";

/** A qué POS se envían los pedidos del ecommerce (por ahora: ninguno o Toteat). */
export interface PosConfig {
  provider?: PosProvider;
  toteat?: ToteatPosCreds;
}

/** Sincronización de estado + ubicación del repartidor desde deliveryhandroll.cl.
 *  Solo los locales que el superadmin habilite aquí reciben los status. El vname que
 *  espera DH se arma como "QC-" + vendorName (ej: vendorName "Haruna" → "QC-Haruna"). */
export interface DeliveryHandrollCreds {
  enabled?: boolean;
  vendorName?: string;
}

/** Integración directa con Uber Eats (Marketplace/Orders API) por local, para
 *  recibir los pedidos de Uber Eats en el POS sin pasar por Toteat. La app de
 *  integración es UNA sola a nivel plataforma (env UBEREATS_CLIENT_ID /
 *  UBEREATS_CLIENT_SECRET); cada local solo aporta su `storeId` (id de su tienda
 *  en Uber Eats = store_id del webhook). Requiere partner aprobado + tienda
 *  vinculada a la app. */
export interface UberEatsCreds {
  enabled?: boolean;
  storeId?: string;
  /** Aceptar automáticamente los pedidos al recibirlos (default true). */
  autoAccept?: boolean;
}

/** Credenciales del panel de Delifast del local, para enriquecer el seguimiento
 *  del reparto en el POS (repartidor, estado en vivo, ETA, PIN, ubicación y
 *  timeline). Se consulta admin.delifast.cl con esta sesión (login por email/clave).
 *  `plataforma` es el dominio de la plataforma Delifast del local (ej "quierosushi.cl"). */
export interface DelifastCreds {
  enabled?: boolean;
  email?: string;
  password?: string;
  plataforma?: string;
}

export interface EcommerceConfig {
  webpay?: WebpayCreds;
  flow?: FlowCreds;
  mercadopago?: MercadoPagoCreds;
  uberDirect?: UberDirectCreds;
  pedidosya?: PedidosYaCreds;
  googleMaps?: GoogleMapsCreds;
  twilio?: TwilioCreds;
  pos?: PosConfig;
  deliveryHandroll?: DeliveryHandrollCreds;
  delifast?: DelifastCreds;
  ubereats?: UberEatsCreds;
  showWebpayToken?: boolean; // mostrar el token de la transacción en Pedidos → Historial (para certificación Transbank)
}

/** Ajustes del pilar Centro de pedidos (Restaurant.centroPedidosConfig, JSON). */
export interface CentroPedidosConfig {
  /** Pedidos de retiro: pasarlos automáticamente a "Entregado" al marcarlos "Listo". */
  autoDeliverPickup?: boolean;
  /** Gestionar todos los pedidos del POS (Toteat). Si está activo, el board se
   *  alimenta SOLO de los pedidos que envía el POS y NO se espejan los de
   *  ecommerce/tomar-pedidos (evita duplicados). Si está inactivo, los pedidos de
   *  ecommerce y manuales sí aparecen en el Centro de pedidos.
   *  Si no está definido, el valor efectivo es: ¿tiene POS Toteat configurado? */
  posMode?: boolean;
  /** Mostrar el botón para solicitar Uber Direct en las tarjetas (default: sí). */
  uberEnabled?: boolean;
  /** Mostrar el botón para solicitar PedidosYa en las tarjetas (default: sí). */
  pedidosyaEnabled?: boolean;
  /** En delivery, el cargo de servicio de la plataforma lo paga el CLIENTE (se suma
   *  a su despacho) en vez de descontarse del saldo del restaurante (default: no). */
  customerAbsorbsSurcharge?: boolean;
  /** Minutos que un pedido de RETIRO puede estar "En preparación" antes de que el
   *  POS avise con un modal. 0 = desactivado. Sin definir = 60. */
  prepAlertMinutes?: number;
  /** Minutos que un pedido de RETIRO puede estar "Listo" sin ser retirado antes de
   *  que el POS avise (sugiere llamar al cliente). 0 = desactivado. Sin definir = 30. */
  readyAlertMinutes?: number;
  /** Métodos de pago de la caja. Si no está definido, se usan los 5 por defecto.
   *  `emitsFiscal` = al cobrar con este método se emite boleta (requiere además que
   *  el local tenga SharkPOS habilitado). */
  paymentMethods?: PaymentMethodConfig[];
}

export interface PaymentMethodConfig {
  /** Identificador estable (ej: "efectivo", "mercadopago"). No cambia aunque cambie el label. */
  key: string;
  /** Texto que ve la caja. */
  label: string;
  /** Si al cobrar con este método se emite documento fiscal (boleta). */
  emitsFiscal: boolean;
}

/** Métodos por defecto (los que existían antes de poder configurarlos). Todos emiten. */
export const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  { key: "efectivo", label: "Efectivo", emitsFiscal: true },
  { key: "debito", label: "Débito", emitsFiscal: true },
  { key: "credito", label: "Crédito", emitsFiscal: true },
  { key: "transferencia", label: "Transferencia", emitsFiscal: true },
  { key: "webpay", label: "Webpay", emitsFiscal: true },
];

/** Normaliza una key de método (minúsculas, sin acentos/espacios → guion bajo). */
export function normalizePaymentKey(s: string): string {
  return (s || "")
    .trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/** Lista efectiva de métodos de pago de un local (configurados, o los 5 por defecto). */
export function effectivePaymentMethods(cfg: CentroPedidosConfig): PaymentMethodConfig[] {
  const raw = Array.isArray(cfg.paymentMethods) ? cfg.paymentMethods : [];
  const seen = new Set<string>();
  const clean: PaymentMethodConfig[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const key = normalizePaymentKey(String((m as PaymentMethodConfig).key || ""));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    clean.push({
      key,
      label: String((m as PaymentMethodConfig).label || key).trim().slice(0, 40) || key,
      emitsFiscal: (m as PaymentMethodConfig).emitsFiscal !== false,
    });
  }
  return clean.length ? clean : DEFAULT_PAYMENT_METHODS;
}

export function parseCentroPedidosConfig(raw: unknown): CentroPedidosConfig {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as CentroPedidosConfig;
  return {};
}

/** Modo POS efectivo: explícito si está definido; si no, depende de si hay POS Toteat. */
export function effectivePosMode(centro: CentroPedidosConfig, ecommerce: EcommerceConfig): boolean {
  if (typeof centro.posMode === "boolean") return centro.posMode;
  return ecommerce.pos?.provider === "toteat";
}

export const TOTEAT_DEFAULT_API_URL = "https://api.toteat.com/mw/or/1.0";

/** Normaliza el JSON crudo de la DB a un EcommerceConfig seguro. */
export function parseEcommerceConfig(raw: unknown): EcommerceConfig {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as EcommerceConfig;
  return {};
}

/** Booleans de "está configurada" por integración (sin exponer secretos). */
export function integrationStatus(cfg: EcommerceConfig) {
  const w = cfg.webpay;
  return {
    // Webpay se considera CONFIGURADO solo en producción con credenciales reales.
    // El modo integración/prueba funciona con las creds del SDK, pero no cuenta como configurado.
    webpay: !!(w?.env === "production" && w.commerceCode && w.apiKey),
    // Flow: igual que Webpay, solo cuenta como configurado en producción. En
    // sandbox (pruebas) NO se muestra como "Configurada".
    flow: !!(cfg.flow?.env === "production" && cfg.flow?.apiKey && cfg.flow?.secretKey),
    mercadopago: !!cfg.mercadopago?.accessToken,
    uberDirect: !!(cfg.uberDirect?.customerId && cfg.uberDirect?.clientId && cfg.uberDirect?.clientSecret),
    pedidosya: !!(cfg.pedidosya?.clientId && cfg.pedidosya?.clientSecret),
    googleMaps: !!cfg.googleMaps?.apiKey,
    // Twilio WhatsApp: activo con creds + remitente + plantilla.
    twilio: !!(cfg.twilio?.enabled && cfg.twilio?.accountSid && cfg.twilio?.authToken && (cfg.twilio?.from || cfg.twilio?.messagingServiceSid) && cfg.twilio?.contentSid),
    // POS: configurado si hay un proveedor seleccionado con sus credenciales mínimas.
    pos: cfg.pos?.provider === "toteat" ? !!(cfg.pos.toteat?.xir && cfg.pos.toteat?.xil && cfg.pos.toteat?.token) : false,
    // Delifast: seguimiento enriquecido del reparto (requiere login del panel).
    delifast: !!(cfg.delifast?.enabled && cfg.delifast?.email && cfg.delifast?.password && cfg.delifast?.plataforma),
    // Uber Eats: integración directa de pedidos (el local activa + su storeId;
    // las credenciales de la app son globales por env).
    ubereats: !!(cfg.ubereats?.enabled && cfg.ubereats?.storeId),
  };
}

export type IntegrationKey = keyof ReturnType<typeof integrationStatus>;
