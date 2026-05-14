import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Normalize a phone number to E.164 format.
 * Default country: CL (Chile).
 * Returns the E.164 string (e.g. "+56912345678") or null if invalid.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;

  const phone = parsePhoneNumberFromString(cleaned, "CL");
  if (phone && phone.isValid()) {
    return phone.format("E.164");
  }
  return null;
}
