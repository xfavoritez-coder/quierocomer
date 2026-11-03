// Cifrado/descifrado de los secretos sensibles dentro de EcommerceConfig.
// SERVER-ONLY (usa node:crypto): no importar desde componentes de cliente.
import type { EcommerceConfig } from "./config";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secret";

/** Devuelve una copia del config con los secretos cifrados (para guardar en BD). */
export function encryptEcommerceSecrets(cfg: EcommerceConfig): EcommerceConfig {
  let out = cfg;
  if (out?.delifast?.password) {
    out = { ...out, delifast: { ...out.delifast, password: encryptSecret(out.delifast.password) } };
  }
  return out;
}

/** Devuelve una copia del config con los secretos en claro (para usar/mostrar). */
export function decryptEcommerceSecrets<T extends EcommerceConfig | null | undefined>(cfg: T): T {
  if (!cfg || typeof cfg !== "object") return cfg;
  let out = cfg as EcommerceConfig;
  if (out.delifast?.password) {
    out = { ...out, delifast: { ...out.delifast, password: decryptSecret(out.delifast.password) } };
  }
  return out as T;
}
