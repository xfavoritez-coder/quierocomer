"use client";

import { useState } from "react";

/**
 * Logo del local en la ficha de ventas. Si no hay logo, si no carga, o si es blanco/vacío
 * (invisible sobre el fondo blanco, `visible === false`), muestra el respaldo: la inicial
 * sobre el color de la marca (igual que en la demo). Antes quedaba un recuadro blanco vacío.
 */
export default function LeadLogo({ url, name, color, visible, size = 64 }: { url: string | null; name: string; color: string | null; visible: boolean | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  const r = Math.round(size * 0.25);
  if (url && !broken && visible !== false) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" onError={() => setBroken(true)} ref={(el) => { if (el && el.complete && el.naturalWidth === 0) setBroken(true); }}
        style={{ width: size, height: size, objectFit: "contain", borderRadius: r, background: "#fff", border: "1px solid var(--line)", flexShrink: 0 }} />
    );
  }
  const bg = color && /^#[0-9a-f]{6}$/i.test(color) ? color : "#E8930A";
  const n = parseInt(bg.slice(1), 16);
  const light = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.65;
  return (
    <div aria-hidden style={{ width: size, height: size, borderRadius: r, background: bg, color: light ? "#111" : "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: Math.round(size * 0.46), letterSpacing: "-.04em", flexShrink: 0 }}>
      {(name.trim().charAt(0) || "?").toUpperCase()}
    </div>
  );
}
