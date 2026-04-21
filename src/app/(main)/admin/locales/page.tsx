"use client";
import { useState, useEffect, useMemo } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import QRGeneratorModal from "@/components/admin/QRGeneratorModal";

interface Restaurant {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  phone: string | null;
  address: string | null;
  cartaTheme: string;
  defaultView: string | null;
  qrActivatedAt: string | null;
  isActive: boolean;
  ownerId: string | null;
  createdAt: string;
  owner: { id: string; name: string; email: string } | null;
  _count: { dishes: number; categories: number; statEvents: number; sessions: number };
}

const F = "var(--font-display)";

export default function AdminLocales() {
  const { isSuper } = useAdminSession();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "activos" | "inactivos" | "sin_owner">("todos");
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);

  useEffect(() => {
    fetch("/api/admin/locales").then(r => r.json()).then(d => { if (Array.isArray(d)) setRestaurants(d); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = restaurants;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r => r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q));
    }
    if (filter === "activos") list = list.filter(r => r.isActive);
    if (filter === "inactivos") list = list.filter(r => !r.isActive);
    if (filter === "sin_owner") list = list.filter(r => !r.ownerId);
    return list;
  }, [restaurants, search, filter]);

  const toggleActive = async (r: Restaurant) => {
    await fetch(`/api/admin/locales/${r.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !r.isActive }) });
    setRestaurants(prev => prev.map(x => x.id === r.id ? { ...x, isActive: !x.isActive } : x));
  };

  if (loading) return <p style={{ color: "#F4A623", fontFamily: F, padding: 40 }}>Cargando locales...</p>;

  if (selected) return (
    <div style={{ maxWidth: 600 }}>
      <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "#F4A623", fontFamily: F, fontSize: "0.85rem", cursor: "pointer", marginBottom: 20 }}>&larr; Volver a locales</button>
      <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          {selected.logoUrl ? (
            <img src={selected.logoUrl} alt="" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#F4A623", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#0a0a0a" }}>{selected.name.charAt(0)}</div>
          )}
          <div>
            <h2 style={{ fontFamily: F, fontSize: "1.3rem", color: "white", margin: 0 }}>{selected.name}</h2>
            <p style={{ fontFamily: F, fontSize: "0.8rem", color: "#888", margin: 0 }}>/{selected.slug}</p>
          </div>
          <span style={{ marginLeft: "auto", fontSize: "0.7rem", padding: "3px 10px", borderRadius: 20, background: selected.isActive ? "rgba(74,222,128,0.1)" : "rgba(255,100,100,0.1)", color: selected.isActive ? "#4ade80" : "#ff6b6b", border: `1px solid ${selected.isActive ? "rgba(74,222,128,0.2)" : "rgba(255,100,100,0.2)"}` }}>
            {selected.isActive ? "Activo" : "Inactivo"}
          </span>
        </div>

        <div className="adm-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Platos", value: selected._count.dishes },
            { label: "Categorias", value: selected._count.categories },
            { label: "Sesiones", value: selected._count.sessions },
            { label: "Eventos", value: selected._count.statEvents },
          ].map(s => (
            <div key={s.label} style={{ background: "#111", borderRadius: 10, padding: "12px 14px" }}>
              <p style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", margin: 0, fontWeight: 700 }}>{s.value}</p>
              <p style={{ fontFamily: F, fontSize: "0.72rem", color: "#888", margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.85rem", fontFamily: F, color: "#aaa" }}>
          {selected.description && <p style={{ margin: 0 }}>{selected.description}</p>}
          {selected.phone && <p style={{ margin: 0 }}>Tel: {selected.phone}</p>}
          {selected.address && <p style={{ margin: 0 }}>Dir: {selected.address}</p>}
          <p style={{ margin: 0 }}>Tema: {selected.cartaTheme}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
            <span>Vista por defecto:</span>
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { value: "lista", label: "Lista" },
                { value: "premium", label: "Clásica" },
                { value: "viaje", label: "Espacial" },
              ].map((v) => (
                <button
                  key={v.value}
                  onClick={async () => {
                    await fetch(`/api/admin/locales/${selected.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ defaultView: v.value }) });
                    const updated = { ...selected, defaultView: v.value };
                    setSelected(updated);
                    setRestaurants((prev) => prev.map((x) => x.id === selected.id ? updated : x));
                  }}
                  style={{
                    padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                    fontFamily: F, fontSize: "0.72rem", fontWeight: 600,
                    background: (selected.defaultView || "premium") === v.value ? "#F4A623" : "rgba(255,255,255,0.06)",
                    color: (selected.defaultView || "premium") === v.value ? "#0a0a0a" : "#888",
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <p style={{ margin: 0 }}>Owner: {selected.owner ? `${selected.owner.name} (${selected.owner.email})` : <span style={{ color: "#666" }}>Sin asignar</span>}</p>
          <p style={{ margin: 0 }}>Creado: {new Date(selected.createdAt).toLocaleDateString("es-CL")}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
            <span>QR activado:</span>
            {selected.qrActivatedAt ? (
              <span style={{ color: "#4ade80" }}>{new Date(selected.qrActivatedAt).toLocaleDateString("es-CL")}</span>
            ) : (
              <button
                onClick={async () => {
                  const now = new Date().toISOString();
                  await fetch(`/api/admin/locales/${selected.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ qrActivatedAt: now }) });
                  const updated = { ...selected, qrActivatedAt: now };
                  setSelected(updated);
                  setRestaurants((prev) => prev.map((x) => x.id === selected.id ? updated : x));
                }}
                style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.72rem", fontWeight: 600, background: "rgba(74,222,128,0.15)", color: "#4ade80" }}
              >
                Activar ahora
              </button>
            )}
          </div>
        </div>

        <div className="adm-btn-row" style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
          <a href={`/qr/${selected.slug}`} target="_blank" style={{ flex: 1, minWidth: "45%", padding: "10px", background: "rgba(244,166,35,0.1)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 10, color: "#F4A623", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, textAlign: "center", textDecoration: "none" }}>Ver carta</a>
          <button onClick={() => setQrModalOpen(true)} style={{ flex: 1, minWidth: "45%", padding: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 10, color: "white", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>📱 Generar QR</button>
          <a href={`/qr/${selected.slug}?mesa=demo&demo=true`} target="_blank" style={{ flex: 1, minWidth: "45%", padding: "10px", background: "rgba(127,191,220,0.1)", border: "1px solid rgba(127,191,220,0.2)", borderRadius: 10, color: "#7fbfdc", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, textAlign: "center", textDecoration: "none" }}>🔔 Demo Garzón</a>
          <a href={`/qr/admin/garzon/${selected.slug}`} target="_blank" style={{ flex: 1, minWidth: "45%", padding: "10px", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 10, color: "#4ade80", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, textAlign: "center", textDecoration: "none" }}>📱 Panel Garzón</a>
          <button onClick={() => { toggleActive(selected); setSelected({ ...selected, isActive: !selected.isActive }); }} style={{ flex: 1, padding: "10px", background: selected.isActive ? "rgba(255,100,100,0.1)" : "rgba(74,222,128,0.1)", border: `1px solid ${selected.isActive ? "rgba(255,100,100,0.2)" : "rgba(74,222,128,0.2)"}`, borderRadius: 10, color: selected.isActive ? "#ff6b6b" : "#4ade80", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
            {selected.isActive ? "Desactivar" : "Activar"}
          </button>
        </div>
      </div>
      {qrModalOpen && <QRGeneratorModal restaurant={selected} onClose={() => setQrModalOpen(false)} />}
    </div>
  );

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", marginBottom: 20 }}>Locales ({filtered.length})</h1>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          placeholder="Buscar local..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 0, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 10, color: "white", fontFamily: F, fontSize: "0.85rem", outline: "none" }}
        />
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {(["todos", "activos", "inactivos", "sin_owner"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
              fontFamily: F, fontSize: "0.75rem", fontWeight: 600,
              background: filter === f ? "#F4A623" : "rgba(255,255,255,0.05)",
              color: filter === f ? "#0a0a0a" : "#888",
            }}>
              {f === "sin_owner" ? "Sin owner" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.map(r => (
          <button key={r.id} onClick={() => setSelected(r)} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
            background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 12,
            cursor: "pointer", width: "100%", textAlign: "left", transition: "border-color 0.2s",
          }}
            onMouseOver={e => (e.currentTarget.style.borderColor = "rgba(244,166,35,0.3)")}
            onMouseOut={e => (e.currentTarget.style.borderColor = "#2A2A2A")}
          >
            {r.logoUrl ? (
              <img src={r.logoUrl} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(244,166,35,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#F4A623", flexShrink: 0 }}>{r.name.charAt(0)}</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: F, fontSize: "0.92rem", color: "white", fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</p>
              <p style={{ fontFamily: F, fontSize: "0.72rem", color: "#666", margin: 0 }}>/{r.slug} · {r._count.dishes} platos · {r._count.sessions} sesiones</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.isActive ? "#4ade80" : "#ff6b6b" }} />
              <span style={{ fontFamily: F, fontSize: "0.7rem", color: "#666" }}>{r.cartaTheme}</span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <p style={{ fontFamily: F, fontSize: "0.85rem", color: "#666", textAlign: "center", padding: 40 }}>No hay locales que coincidan</p>
        )}
      </div>
    </div>
  );
}
