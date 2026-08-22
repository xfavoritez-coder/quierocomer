/** Formato de precio chileno: $12.900 */
export function clp(n: number): string {
  return "$" + Math.round(n || 0).toLocaleString("es-CL");
}
