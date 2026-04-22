/** Remove accents/diacritics and lowercase for accent-insensitive search */
export function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
