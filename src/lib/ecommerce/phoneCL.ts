// Validación de teléfono MÓVIL chileno para el checkout de Ecommerce.
// Reglas (acordadas con el usuario):
//  - Formato local: exactamente 9 dígitos y empieza con 9 (celular), p. ej. 912345678.
//  - Formato internacional: empieza con "+56" seguido del celular (9 dígitos que
//    empieza con 9) → total 11 dígitos tras el "+", p. ej. +56912345678.
// Se ignoran espacios, guiones y paréntesis al validar.
//
// Compartido entre el cliente (CheckoutForm) y el servidor (api/ecommerce/checkout)
// para que la regla sea idéntica en ambos lados.

/** Deja solo un "+" inicial (si venía) y los dígitos; descarta espacios/guiones/paréntesis. */
export function cleanPhoneCL(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  const plus = s.startsWith("+");
  const digits = s.replace(/\D/g, "");
  return (plus ? "+" : "") + digits;
}

/** true si es un móvil chileno válido en formato local (9XXXXXXXX) o internacional
 *  con prefijo 56, con o sin "+" (+569XXXXXXXX / 569XXXXXXXX). */
export function isValidPhoneCL(raw: string | null | undefined): boolean {
  const c = cleanPhoneCL(raw);
  // Internacional con "+": +56 + celular de 9 dígitos que empieza en 9.
  if (c.startsWith("+")) return /^\+569\d{8}$/.test(c);
  // Local (9XXXXXXXX) o internacional sin "+" (569XXXXXXXX).
  return /^9\d{8}$/.test(c) || /^569\d{8}$/.test(c);
}

/** Normaliza a formato canónico internacional +569XXXXXXXX, o null si no es válido.
 *  Acepta además 569XXXXXXXX (sin "+") como entrada. Útil si se quiere guardar canónico. */
export function normalizePhoneCL(raw: string | null | undefined): string | null {
  const c = cleanPhoneCL(raw);
  if (/^\+569\d{8}$/.test(c)) return c;
  if (/^569\d{8}$/.test(c)) return "+" + c;
  if (/^9\d{8}$/.test(c)) return "+56" + c;
  return null;
}

/** Mensaje de error estándar para mostrar al cliente. */
export const PHONE_CL_ERROR =
  "Ingresa un celular chileno válido: 9 dígitos que empiecen con 9 (ej. 912345678) o con +56 (ej. +56912345678).";
