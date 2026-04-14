export function formatNombre(nombre: string): string {
  const parts = nombre.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] || "";
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}
