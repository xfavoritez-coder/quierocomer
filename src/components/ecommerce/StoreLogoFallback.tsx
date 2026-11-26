/**
 * Respaldo del logo de la tienda (igual que en la demo de ventas): la inicial del local
 * sobre el color de la marca, con el nombre al lado. Se usa cuando no hay logo, cuando no
 * carga o cuando es blanco/vacío sobre un encabezado claro.
 */
export default function StoreLogoFallback({ name, color, size = 36, dark = false, nameClassName = "", showName = true }: {
  name: string; color: string; size?: number; dark?: boolean; nameClassName?: string; showName?: boolean;
}) {
  const bg = /^#[0-9a-f]{6}$/i.test(color) ? color : "#E8930A";
  const n = parseInt(bg.slice(1), 16);
  const light = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.65;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.28), minWidth: 0 }}>
      <span aria-hidden style={{ width: size, height: size, borderRadius: Math.round(size * 0.24), background: bg, color: light ? "#111" : "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: Math.round(size * 0.46), letterSpacing: "-.04em", flexShrink: 0 }}>
        {(name.trim().charAt(0) || "?").toUpperCase()}
      </span>
      {showName && <span className={nameClassName} style={{ color: dark ? "#fff" : "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{name}</span>}
    </span>
  );
}
