"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Dish = { id: string; name: string; price: number; photo: string | null };
type Data = {
  restaurant: { name: string; logoUrl: string | null; bannerUrl: string | null; accentColor: string | null; colorMode: "LIGHT" | "DARK"; suggestedColor: string | null } | null;
  categories: { id: string; name: string; dishes: Dish[] }[];
};

const PRESETS = ["#DE7C00", "#C0392B", "#1E7A4C", "#1D4ED8", "#7C3AED", "#111827"];

export default function RevisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [edits, setEdits] = useState<Record<string, { name: string; price: number }>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [color, setColor] = useState<string>("#DE7C00");
  const [mode, setMode] = useState<"LIGHT" | "DARK">("LIGHT");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch(`/api/ventas/leads/${id}/status?full=1`, { cache: "no-store" }).then((r) => r.json()).then((d: Data) => {
      setData(d);
      setBanner(d.restaurant?.bannerUrl ?? null);
      setColor(d.restaurant?.accentColor || d.restaurant?.suggestedColor || "#DE7C00");
      setMode(d.restaurant?.colorMode === "DARK" ? "DARK" : "LIGHT");
    });
  }, [id]);

  const photos = useMemo(() => [...new Set((data?.categories ?? []).flatMap((c) => c.dishes.map((d) => d.photo)).filter(Boolean) as string[])].slice(0, 24), [data]);
  const suggested = data?.restaurant?.suggestedColor;
  const swatches = [...new Set([suggested, ...PRESETS].filter(Boolean) as string[])];

  const val = (d: Dish) => edits[d.id] ?? { name: d.name, price: d.price };
  const setVal = (d: Dish, patch: Partial<{ name: string; price: number }>) => setEdits((e) => ({ ...e, [d.id]: { ...val(d), ...patch } }));

  const save = async () => {
    setSaving(true); setError(null);
    const all = (data?.categories ?? []).flatMap((c) => c.dishes);
    const changed = all.filter((d) => edits[d.id] && (edits[d.id].name !== d.name || edits[d.id].price !== d.price)).map((d) => ({ id: d.id, ...edits[d.id] }));
    const r = await fetch(`/api/ventas/leads/${id}/menu`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dishes: changed, bannerUrl: banner, accentColor: color, colorMode: mode }) });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) { setError(d.error || "No se pudo guardar"); return; }
    router.push(`/ventas/${id}`);
  };

  if (!data) return <p style={{ textAlign: "center", color: "var(--ink-3)" }}>Cargando…</p>;
  if (!data.restaurant) return <p style={{ textAlign: "center", color: "var(--ink-3)" }}>El local todavía no está armado.</p>;

  const q = filter.trim().toLowerCase();
  const section: React.CSSProperties = { padding: 18, display: "grid", gap: 12 };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {data.restaurant.logoUrl && <img src={data.restaurant.logoUrl} alt="" style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 14, background: "#fff", border: "1px solid var(--line)" }} />}
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Revisión rápida</h1>
          <p style={{ margin: "2px 0 0", color: "var(--ink-3)", fontSize: 14 }}>{data.restaurant.name} · corrige lo que se haya leído mal</p>
        </div>
      </div>

      <div className="ventas-card" style={section}>
        <div style={{ fontWeight: 800 }}>Colores de la carta</div>
        <Preview name={data.restaurant.name} logo={data.restaurant.logoUrl} banner={banner} color={color} dark={mode === "DARK"} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-3)" }}>Fondo</div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["LIGHT", "DARK"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} style={{ flex: 1, padding: "11px 14px", borderRadius: 12, cursor: "pointer", font: "inherit", fontWeight: 700, fontSize: 14, background: m === "DARK" ? "#111" : "#fff", color: m === "DARK" ? "#fff" : "#111", border: mode === m ? "3px solid var(--amber)" : "1px solid var(--line)" }}>{m === "DARK" ? "Oscuro" : "Claro"}</button>
          ))}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-3)" }}>Color principal {suggested && <span style={{ fontWeight: 500 }}>· el primero viene del logo</span>}</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {swatches.map((c) => (
            <button key={c} type="button" aria-label={c} onClick={() => setColor(c)} style={{ width: 38, height: 38, borderRadius: 11, background: c, cursor: "pointer", border: color.toUpperCase() === c.toUpperCase() ? "3px solid var(--ink)" : "2px solid #fff", boxShadow: "0 0 0 1px var(--line)" }} />
          ))}
          <input type="color" value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} aria-label="Otro color" style={{ width: 44, height: 38, border: "none", background: "none", cursor: "pointer" }} />
          <span className="ventas-mono" style={{ fontSize: 13, color: "var(--ink-3)" }}>{color}</span>
        </div>
      </div>

      <div className="ventas-card" style={section}>
        <div style={{ fontWeight: 800 }}>Foto de portada</div>
        {photos.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)" }}>La carta no trae fotos. Se usará la portada por defecto.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
            {photos.map((p) => (
              <button key={p} type="button" onClick={() => setBanner(banner === p ? null : p)} style={{ padding: 0, border: banner === p ? `3px solid ${color}` : "1px solid var(--line)", borderRadius: 11, overflow: "hidden", cursor: "pointer", background: "none", height: 80 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ventas-card" style={section}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 800 }}>Platos y precios</div>
          <input className="ventas-input" style={{ maxWidth: 220, padding: "8px 12px", fontSize: 14 }} placeholder="Buscar plato…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        {data.categories.map((c) => {
          const dishes = c.dishes.filter((d) => !q || val(d).name.toLowerCase().includes(q));
          if (!dishes.length) return null;
          return (
            <div key={c.id}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--ink-3)", margin: "6px 0 6px" }}>{c.name}</div>
              <div style={{ display: "grid", gap: 6 }}>
                {dishes.map((d) => (
                  <div key={d.id} style={{ display: "grid", gridTemplateColumns: "1fr 118px", gap: 8 }}>
                    <input className="ventas-input" style={{ padding: "9px 12px", fontSize: 14 }} value={val(d).name} onChange={(e) => setVal(d, { name: e.target.value })} aria-label="Nombre del plato" />
                    <input className="ventas-input ventas-mono" style={{ padding: "9px 12px", fontSize: 14, textAlign: "right" }} inputMode="numeric" value={val(d).price ? String(val(d).price) : ""} placeholder="0"
                      onChange={(e) => setVal(d, { price: Number(e.target.value.replace(/\D/g, "")) || 0 })} aria-label="Precio" />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {error && <p style={{ color: "#dc2626", margin: 0 }}>{error}</p>}
      <div style={{ position: "sticky", bottom: 0, padding: "12px 0", background: "linear-gradient(transparent, var(--bg) 30%)" }}>
        <button className="ventas-btn" onClick={save} disabled={saving} style={{ width: "100%", fontSize: 17, padding: "15px 24px" }}>{saving ? "Guardando…" : "Listo, ver su local →"}</button>
      </div>
    </div>
  );
}

/** Vista previa de cómo se verá la carta con el fondo y el color elegidos. */
function Preview({ name, logo, banner, color, dark }: { name: string; logo: string | null; banner: string | null; color: string; dark: boolean }) {
  const n = parseInt(color.slice(1), 16);
  const fg = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 165 ? "#111" : "#fff";
  const bg = dark ? "#0e0e0e" : "#fff", ink = dark ? "#f5f5f5" : "#111", sub = dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.5)", card = dark ? "#1a1a1a" : "#f4f4f4";
  return (
    <div style={{ width: 240, maxWidth: "100%", margin: "0 auto", borderRadius: 28, padding: 8, background: "#111", boxShadow: "0 20px 40px -20px rgba(0,0,0,.4)" }}>
      <div style={{ borderRadius: 22, overflow: "hidden", background: bg, transition: "background .3s" }}>
        <div style={{ height: 84, background: banner ? `center/cover url(${banner})` : color, position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo && <img src={logo} alt="" style={{ position: "absolute", left: 12, bottom: -20, width: 44, height: 44, borderRadius: 12, objectFit: "contain", background: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,.2)" }} />}
        </div>
        <div style={{ padding: "26px 12px 14px", color: ink }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{name}</div>
          <div style={{ display: "flex", gap: 6, margin: "10px 0" }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 99, background: color, color: fg }}>Destacados</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 99, background: card, color: sub }}>Bebidas</span>
          </div>
          {[0, 1].map((i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 12, background: card, marginTop: 6 }}>
              <div><div style={{ width: 80 - i * 20, height: 8, borderRadius: 4, background: ink, opacity: .8 }} /><div style={{ width: 50, height: 6, borderRadius: 4, background: sub, marginTop: 5 }} /></div>
              <span style={{ fontSize: 11, fontWeight: 800, color }}>$9.900</span>
            </div>
          ))}
          <div style={{ marginTop: 10, textAlign: "center", fontSize: 12, fontWeight: 800, padding: "9px", borderRadius: 12, background: color, color: fg }}>Llamar al garzón</div>
        </div>
      </div>
    </div>
  );
}
