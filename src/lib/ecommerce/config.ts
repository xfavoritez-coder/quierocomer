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

/** Credenciales del POS Toteat para inyectar pedidos (estilo Servio / deliveryhandroll). */
export interface ToteatPosCreds {
  apiUrl?: string; // default https://api.toteat.com/mw/or/1.0
  xir?: string; // Restaurant ID
  xil?: string; // Local ID
  xiu?: string; // User ID (por defecto = xil)
  token?: string; // xapitoken
}

export type PosProvider = "none" | "toteat";

/** A qué POS se envían los pedidos del ecommerce (por ahora: ninguno o Toteat). */
export interface PosConfig {
  provider?: PosProvider;
  toteat?: ToteatPosCreds;
}

export interface EcommerceConfig {
  webpay?: WebpayCreds;
  flow?: FlowCreds;
  mercadopago?: MercadoPagoCreds;
  uberDirect?: UberDirectCreds;
  pedidosya?: PedidosYaCreds;
  googleMaps?: GoogleMapsCreds;
  pos?: PosConfig;
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
    flow: !!(cfg.flow?.apiKey && cfg.flow?.secretKey),
    mercadopago: !!cfg.mercadopago?.accessToken,
    uberDirect: !!(cfg.uberDirect?.customerId && cfg.uberDirect?.clientId && cfg.uberDirect?.clientSecret),
    pedidosya: !!(cfg.pedidosya?.clientId && cfg.pedidosya?.clientSecret),
    googleMaps: !!cfg.googleMaps?.apiKey,
    // POS: configurado si hay un proveedor seleccionado con sus credenciales mínimas.
    pos: cfg.pos?.provider === "toteat" ? !!(cfg.pos.toteat?.xir && cfg.pos.toteat?.xil && cfg.pos.toteat?.token) : false,
  };
}

export type IntegrationKey = keyof ReturnType<typeof integrationStatus>;
