// ═══════════════════════════════════════════════════════════
//  Cifrado de secretos en reposo (AES-256-GCM).
//  Clave: env SECRET_ENCRYPTION_KEY (hex de 64, base64 de 32 bytes,
//  o cualquier string → se deriva por SHA-256). Los valores cifrados
//  llevan el prefijo "enc:v1:"; los sin prefijo se tratan como texto
//  plano legado (compatibilidad hacia atrás).
// ═══════════════════════════════════════════════════════════
import crypto from "crypto";

const PREFIX = "enc:v1:";

function getKey(): Buffer | null {
  const raw = process.env.SECRET_ENCRYPTION_KEY;
  if (!raw) return null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  const b64 = Buffer.from(raw, "base64");
  if (b64.length === 32) return b64;
  // Cualquier otro string: derivar 32 bytes estables por SHA-256.
  return crypto.createHash("sha256").update(raw).digest();
}

export function isEncrypted(s?: string | null): boolean {
  return typeof s === "string" && s.startsWith(PREFIX);
}

/** Cifra un secreto. Sin clave configurada devuelve el texto tal cual (no rompe
 *  el flujo), así que para garantizar cifrado hay que setear SECRET_ENCRYPTION_KEY. */
export function encryptSecret(plain: string): string {
  if (!plain) return plain;
  if (isEncrypted(plain)) return plain; // ya cifrado (idempotente)
  const key = getKey();
  if (!key) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString("base64");
}

/** Descifra un secreto. Texto sin prefijo se devuelve tal cual (legado). */
export function decryptSecret(s?: string | null): string {
  if (!s) return "";
  if (!isEncrypted(s)) return s;
  const key = getKey();
  if (!key) return ""; // no se puede descifrar sin clave
  try {
    const raw = Buffer.from(s.slice(PREFIX.length), "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ct = raw.subarray(28);
    const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
  } catch {
    return "";
  }
}
