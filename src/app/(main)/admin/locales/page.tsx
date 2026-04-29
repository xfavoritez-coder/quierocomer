"use client";
import { useState, useEffect, useMemo } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import QRGeneratorModal from "@/components/admin/QRGeneratorModal";
import { QRCodeCanvas } from "qrcode.react";
import { norm } from "@/lib/normalize";

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
  qrToken: string | null;
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
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [annText, setAnnText] = useState("");
  const [annLink, setAnnLink] = useState("");
  const [annDays, setAnnDays] = useState<number[]>([]);
  const [annStart, setAnnStart] = useState("");
  const [annEnd, setAnnEnd] = useState("");
  const [annSaving, setAnnSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "activos" | "inactivos" | "sin_owner">("todos");
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);

  useEffect(() => {
    fetch("/api/admin/locales").then(r => r.json()).then(d => { if (Array.isArray(d)) setRestaurants(d); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Fetch announcements when a restaurant is selected
  useEffect(() => {
    if (!selected) { setAnnouncements([]); return; }
    fetch(`/api/admin/announcements?restaurantId=${selected.id}`).then(r => r.json()).then(d => setAnnouncements(d.announcements || [])).catch(() => {});
  }, [selected?.id]);

  const filtered = useMemo(() => {
    let list = restaurants;
    if (search) {
      const q = norm(search);
      list = list.filter(r => norm(r.name).includes(q) || norm(r.slug).includes(q));
    }
    if (filter === "activos") list = list.filter(r => r.isActive);
    if (filter === "inactivos") list = list.filter(r => !r.isActive);
    if (filter === "sin_owner") list = list.filter(r => !r.ownerId);
    return list;
  }, [restaurants, search, filter]);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const deleteRestaurant = async (r: Restaurant) => {
    if (!confirm(`¿Estás seguro de eliminar "${r.name}"? Esto borrará TODOS sus platos, categorías, sesiones y datos. Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/admin/locales/${r.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); alert(d.error || "Error"); return; }
      setRestaurants(prev => prev.filter(x => x.id !== r.id));
      setSelected(null as any);
    } catch { alert("Error al eliminar"); }
  };

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

        {/* Editable fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <div>
            <label style={{ fontFamily: F, fontSize: "0.65rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>Nombre</label>
            <input defaultValue={selected.name} onBlur={async (e) => {
              const v = e.target.value.trim();
              if (v && v !== selected.name) {
                await fetch(`/api/admin/locales/${selected.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: v }) });
                const u = { ...selected, name: v }; setSelected(u); setRestaurants(prev => prev.map(x => x.id === selected.id ? u : x));
              }
            }} style={{ width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 8, color: "white", fontFamily: F, fontSize: "0.88rem", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontFamily: F, fontSize: "0.65rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>Descripción</label>
            <textarea defaultValue={selected.description || ""} onBlur={async (e) => {
              const v = e.target.value.trim();
              await fetch(`/api/admin/locales/${selected.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: v || null }) });
              const u = { ...selected, description: v || null }; setSelected(u); setRestaurants(prev => prev.map(x => x.id === selected.id ? u : x));
            }} rows={2} style={{ width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 8, color: "white", fontFamily: F, fontSize: "0.82rem", outline: "none", boxSizing: "border-box", resize: "vertical" }} />
          </div>
          <div>
            <label style={{ fontFamily: F, fontSize: "0.65rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>Logo URL</label>
            <input defaultValue={selected.logoUrl || ""} onBlur={async (e) => {
              const v = e.target.value.trim();
              await fetch(`/api/admin/locales/${selected.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logoUrl: v || null }) });
              const u = { ...selected, logoUrl: v || null }; setSelected(u); setRestaurants(prev => prev.map(x => x.id === selected.id ? u : x));
            }} style={{ width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 8, color: "white", fontFamily: F, fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }} placeholder="https://..." />
          </div>
          <div>
            <label style={{ fontFamily: F, fontSize: "0.65rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>Teléfono</label>
            <input defaultValue={selected.phone || ""} onBlur={async (e) => {
              const v = e.target.value.trim();
              await fetch(`/api/admin/locales/${selected.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: v || null }) });
              const u = { ...selected, phone: v || null }; setSelected(u);
            }} style={{ width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 8, color: "white", fontFamily: F, fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }} placeholder="+56 2 1234 5678" />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.85rem", fontFamily: F, color: "#aaa" }}>
          <p style={{ margin: 0 }}>Tema: {selected.cartaTheme}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
            <span>Vista por defecto:</span>
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { value: "lista", label: "Lista" },
                { value: "premium", label: "Galería" },
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
        </div>

        <div className="adm-btn-row" style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
          <a href={`/qr/${selected.slug}`} target="_blank" style={{ flex: 1, minWidth: "45%", padding: "10px", background: "rgba(244,166,35,0.1)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 10, color: "#F4A623", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, textAlign: "center", textDecoration: "none" }}>Ver carta</a>
          <button onClick={() => { navigator.clipboard.writeText(`https://quierocomer.cl/qr/generar/${selected.slug}`); setQrModalOpen(true); }} style={{ flex: 1, minWidth: "45%", padding: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 10, color: "white", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>📱 Generar QR</button>
          <a href={`/qr/${selected.slug}?mesa=demo&demo=true`} target="_blank" style={{ flex: 1, minWidth: "45%", padding: "10px", background: "rgba(127,191,220,0.1)", border: "1px solid rgba(127,191,220,0.2)", borderRadius: 10, color: "#7fbfdc", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, textAlign: "center", textDecoration: "none" }}>🔔 Demo Garzón</a>
          <a href={`/qr/admin/garzon/${selected.slug}`} target="_blank" style={{ flex: 1, minWidth: "45%", padding: "10px", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 10, color: "#4ade80", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, textAlign: "center", textDecoration: "none" }}>📱 Panel Garzón</a>
          <button onClick={() => { toggleActive(selected); setSelected({ ...selected, isActive: !selected.isActive }); }} style={{ flex: 1, padding: "10px", background: selected.isActive ? "rgba(255,100,100,0.1)" : "rgba(74,222,128,0.1)", border: `1px solid ${selected.isActive ? "rgba(255,100,100,0.2)" : "rgba(74,222,128,0.2)"}`, borderRadius: 10, color: selected.isActive ? "#ff6b6b" : "#4ade80", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
            {selected.isActive ? "Desactivar" : "Activar"}
          </button>
          <button onClick={() => deleteRestaurant(selected)} style={{ flex: 1, padding: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, color: "#ef4444", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
            🗑 Eliminar local
          </button>
        </div>

        {/* Announcements */}
        <div style={{ marginTop: 20, padding: 16, background: "rgba(255,255,255,0.02)", border: "1px solid #2A2A2A", borderRadius: 12 }}>
          <p style={{ fontFamily: F, fontSize: "0.75rem", color: "#F4A623", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Cinta de anuncios</p>

          {/* Existing announcements */}
          {announcements.map((ann) => (
            <div key={ann.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, marginBottom: 8 }}>
              <button onClick={async () => {
                await fetch("/api/admin/announcements", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: ann.id, isActive: !ann.isActive }) });
                setAnnouncements(prev => prev.map(a => a.id === ann.id ? { ...a, isActive: !a.isActive } : a));
              }} style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${ann.isActive ? "#F4A623" : "rgba(255,255,255,0.2)"}`, background: ann.isActive ? "#F4A623" : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                {ann.isActive && <span style={{ color: "#0a0a0a", fontSize: "10px", fontWeight: 700 }}>✓</span>}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: F, fontSize: "0.82rem", color: ann.isActive ? "#ccc" : "#555", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ann.text}</p>
                <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                  {ann.linkUrl && <span style={{ fontSize: "0.62rem", color: "#7fbfdc" }}>🔗 Link</span>}
                  {ann.daysOfWeek?.length > 0 && <span style={{ fontSize: "0.62rem", color: "#888" }}>{["Do","Lu","Ma","Mi","Ju","Vi","Sa"].filter((_: string, i: number) => ann.daysOfWeek.includes(i)).join(" ")}</span>}
                  {ann.startDate && <span style={{ fontSize: "0.62rem", color: "#888" }}>Desde {new Date(ann.startDate).toLocaleDateString("es-CL")}</span>}
                  {ann.endDate && <span style={{ fontSize: "0.62rem", color: "#888" }}>Hasta {new Date(ann.endDate).toLocaleDateString("es-CL")}</span>}
                </div>
              </div>
              <button onClick={async () => {
                await fetch("/api/admin/announcements", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: ann.id }) });
                setAnnouncements(prev => prev.filter(a => a.id !== ann.id));
              }} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "0.85rem", padding: 4, flexShrink: 0 }}>✕</button>
            </div>
          ))}

          {/* Add new announcement */}
          {announcements.length < 3 && (
            <div style={{ marginTop: announcements.length > 0 ? 12 : 0 }}>
              <input value={annText} onChange={e => setAnnText(e.target.value)} placeholder="Texto del anuncio..." style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "white", fontFamily: F, fontSize: "0.85rem", outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
              <input value={annLink} onChange={e => setAnnLink(e.target.value)} placeholder="Link (opcional) — https://..." style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "white", fontFamily: F, fontSize: "0.82rem", outline: "none", boxSizing: "border-box", marginBottom: 8 }} />

              {/* Day selector */}
              <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                <span style={{ fontFamily: F, fontSize: "0.7rem", color: "#666", alignSelf: "center", marginRight: 4 }}>Días:</span>
                {["Do","Lu","Ma","Mi","Ju","Vi","Sa"].map((d, i) => (
                  <button key={i} onClick={() => setAnnDays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])} style={{ width: 28, height: 28, borderRadius: 6, border: "none", cursor: "pointer", fontFamily: F, fontSize: "0.68rem", fontWeight: 600, background: annDays.includes(i) ? "#F4A623" : "rgba(255,255,255,0.06)", color: annDays.includes(i) ? "#0a0a0a" : "#666" }}>{d}</button>
                ))}
                {annDays.length > 0 && <button onClick={() => setAnnDays([])} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "0.68rem", fontFamily: F }}>Todos</button>}
              </div>

              {/* Date range */}
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontFamily: F, fontSize: "0.65rem", color: "#555", display: "block", marginBottom: 2 }}>Desde (opcional)</label>
                  <input type="date" value={annStart} onChange={e => setAnnStart(e.target.value)} style={{ width: "100%", padding: "6px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "white", fontFamily: F, fontSize: "0.78rem", outline: "none", boxSizing: "border-box", colorScheme: "dark" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontFamily: F, fontSize: "0.65rem", color: "#555", display: "block", marginBottom: 2 }}>Hasta (opcional)</label>
                  <input type="date" value={annEnd} onChange={e => setAnnEnd(e.target.value)} style={{ width: "100%", padding: "6px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "white", fontFamily: F, fontSize: "0.78rem", outline: "none", boxSizing: "border-box", colorScheme: "dark" }} />
                </div>
              </div>

              <button
                disabled={!annText.trim() || annSaving}
                onClick={async () => {
                  setAnnSaving(true);
                  try {
                    const res = await fetch("/api/admin/announcements", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ restaurantId: selected.id, text: annText.trim(), linkUrl: annLink.trim() || null, daysOfWeek: annDays.length > 0 ? annDays : [], startDate: annStart || null, endDate: annEnd || null }),
                    });
                    const data = await res.json();
                    if (!res.ok) { alert(data.error || "Error"); return; }
                    setAnnouncements(prev => [...prev, data.announcement]);
                    setAnnText(""); setAnnLink(""); setAnnDays([]); setAnnStart(""); setAnnEnd("");
                  } catch {} finally { setAnnSaving(false); }
                }}
                style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", cursor: annText.trim() ? "pointer" : "default", fontFamily: F, fontSize: "0.85rem", fontWeight: 600, background: annText.trim() ? "#F4A623" : "rgba(255,255,255,0.06)", color: annText.trim() ? "#0a0a0a" : "#555" }}
              >
                {annSaving ? "Guardando..." : "Agregar anuncio"}
              </button>
            </div>
          )}

          {announcements.length === 0 && !annText && (
            <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#555", margin: 0 }}>Sin anuncios. Agrega uno para que aparezca en la carta.</p>
          )}
        </div>

        {/* Inline QR */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid #2A2A2A", borderRadius: 12, marginTop: 16 }}>
          <div style={{ background: "white", borderRadius: 10, padding: 8, flexShrink: 0 }}>
            <QRCodeCanvas value={`https://quierocomer.cl/qr/${selected.slug}${selected.qrToken ? `?t=${selected.qrToken}` : ""}`} size={80} level="H" />
          </div>
          <div>
            <p style={{ fontFamily: F, fontSize: "0.75rem", color: "#888", margin: "0 0 4px" }}>QR de la carta</p>
            <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#F4A623", margin: 0, wordBreak: "break-all" }}>quierocomer.cl/qr/{selected.slug}{selected.qrToken ? `?t=${selected.qrToken}` : ""}</p>
          </div>
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
