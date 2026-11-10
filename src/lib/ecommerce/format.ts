/** Formato de precio chileno: $12.900 */
export function clp(n: number): string {
  return "$" + Math.round(n || 0).toLocaleString("es-CL");
}

/** Convierte un texto en slug URL-friendly: "Suprema 40 Piezas Premium" → "suprema-40-piezas-premium" */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}
