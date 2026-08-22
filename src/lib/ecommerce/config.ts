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

export interface UberDirectCreds {
  customerId?: string; // Uber Direct customer id
  clientId?: string;
  clientSecret?: string;
}

export interface PedidosYaCreds {
  env?: "sandbox" | "production";
  clientId?: string;
  clientSecret?: string;
}

export interface EcommerceConfig {
  webpay?: WebpayCreds;
  flow?: FlowCreds;
  uberDirect?: UberDirectCreds;
  pedidosya?: PedidosYaCreds;
}

/** Normaliza el JSON crudo de la DB a un EcommerceConfig seguro. */
export function parseEcommerceConfig(raw: unknown): EcommerceConfig {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as EcommerceConfig;
  return {};
}

/** Booleans de "está configurada" por integración (sin exponer secretos). */
export function integrationStatus(cfg: EcommerceConfig) {
  const w = cfg.webpay;
  return {
    // En modo integración Webpay funciona con las credenciales de prueba del SDK.
    webpay: !!w && (w.env === "production" ? !!(w.commerceCode && w.apiKey) : true),
    flow: !!(cfg.flow?.apiKey && cfg.flow?.secretKey),
    uberDirect: !!(cfg.uberDirect?.customerId && cfg.uberDirect?.clientId && cfg.uberDirect?.clientSecret),
    pedidosya: !!(cfg.pedidosya?.clientId && cfg.pedidosya?.clientSecret),
  };
}

export type IntegrationKey = keyof ReturnType<typeof integrationStatus>;
