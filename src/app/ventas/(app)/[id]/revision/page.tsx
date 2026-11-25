"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Dish = { id: string; name: string; price: number; photo: string | null };
type Data = {
  restaurant: { name: string; logoUrl: string | null; bannerUrl: string | null; accentColor: string | null; suggestedColor: string | null } | null;
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch(`/api/ventas/leads/${id}/status?full=1`, { cache: "no-store" }).then((r) => r.json()).then((d: Data) => {
      setData(d);
      setBanner(d.restaurant?.bannerUrl ?? null);
      setColor(d.restaurant?.accentColor || d.restaurant?.suggestedColor || "#DE7C00");
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
    const r = await fetch(`/api/ventas/leads/${id}/menu`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dishes: changed, bannerUrl: banner, accentColor: color }) });
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
        <div style={{ fontWeight: 800 }}>Color principal {suggested && <span style={{ fontWeight: 500, color: "var(--ink-3)", fontSize: 13 }}>· sugerido desde el logo</span>}</div>
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
