// Cifrado/descifrado de los secretos sensibles dentro de EcommerceConfig.
// SERVER-ONLY (usa node:crypto): no importar desde componentes de cliente.
import type { EcommerceConfig } from "./config";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secret";

/** Devuelve una copia del config con los secretos cifrados (para guardar en BD). */
export function encryptEcommerceSecrets(cfg: EcommerceConfig): EcommerceConfig {
  if (cfg?.delifast?.password) {
    return { ...cfg, delifast: { ...cfg.delifast, password: encryptSecret(cfg.delifast.password) } };
  }
  return cfg;
}

/** Devuelve una copia del config con los secretos en claro (para usar/mostrar). */
export function decryptEcommerceSecrets<T extends EcommerceConfig | null | undefined>(cfg: T): T {
  if (cfg && typeof cfg === "object" && (cfg as EcommerceConfig).delifast?.password) {
    const c = cfg as EcommerceConfig;
    return { ...c, delifast: { ...c.delifast, password: decryptSecret(c.delifast!.password) } } as T;
  }
  return cfg;
}
