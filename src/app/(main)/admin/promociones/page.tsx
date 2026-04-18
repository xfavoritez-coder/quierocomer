"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";

const F = "var(--font-display)";
const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  SUGGESTED: { label: "Sugerida", color: "#F4A623", bg: "rgba(244,166,35,0.1)" },
  ACTIVE: { label: "Activa", color: "#4ade80", bg: "rgba(74,222,128,0.1)" },
  PAUSED: { label: "Pausada", color: "#888", bg: "rgba(255,255,255,0.05)" },
};

interface Promo {
  id: string; name: string; description: string | null; dishIds: string[];
  dishes?: { id: string; name: string; price: number; photos: string[] }[];
  originalPrice: number | null; promoPrice: number | null; discountPct: number | null;
  validFrom: string | null; validUntil: string | null; status: string;
  generatedBy: string; aiJustification: string | null; metrics: any;
  createdAt: string; targetSegment?: string; emailCopy?: string; dishNames?: string[];
}

export default function AdminPromociones() {
  const { restaurants, loading: sessionLoading } = useAdminSession();
  const [selectedLocal, setSelectedLocal] = useState<string>("");
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Promo | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPrice, setEditPrice] = useState("");

  // Auto-select first restaurant
  useEffect(() => {
    if (!sessionLoading && restaurants.length > 0 && !selectedLocal) {
      setSelectedLocal(restaurants[0].id);
    }
  }, [sessionLoading, restaurants, selectedLocal]);

  useEffect(() => {
    if (!selectedLocal) return;
    setLoading(true);
    fetch(`/api/admin/promotions?restaurantId=${selectedLocal}`)
      .then(r => r.json()).then(d => setPromos(d.promotions || []))
      .catch(() => {}).finally(() => setLoading(false));
  }, [selectedLocal]);

  const handleGenerate = async () => {
    if (!selectedLocal) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/promotions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suggest", restaurantId: selectedLocal }),
      });
      const data = await res.json();
      if (data.promotions) setPromos(prev => [...data.promotions, ...prev]);
    } catch (e) { console.error(e); }
    setGenerating(false);
  };

  const handleStatus = async (id: string, status: string) => {
    const res = await fetch("/api/admin/promotions", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) setPromos(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta promoción?")) return;
    await fetch("/api/admin/promotions", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "DELETED" }),
    });
    setPromos(prev => prev.filter(p => p.id !== id));
  };

  const startEdit = (p: Promo) => {
    setEditing(p);
    setEditName(p.name);
    setEditDesc(p.description || "");
    setEditPrice(p.promoPrice?.toString() || "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    const res = await fetch("/api/admin/promotions", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id, name: editName, description: editDesc, promoPrice: editPrice ? Number(editPrice) : null }),
    });
    const data = await res.json();
    if (data.promotion) {
      setPromos(prev => prev.map(p => p.id === editing.id ? { ...p, name: editName, description: editDesc, promoPrice: editPrice ? Number(editPrice) : null } : p));
    }
    setEditing(null);
  };

  const filtered = promos.filter(p => {
    if (p.status === "DELETED") return false;
    if (filter === "all") return true;
    return p.status === filter;
  });

  if (sessionLoading) return <p style={{ color: "#F4A623", fontFamily: F, padding: 40 }}>Cargando...</p>;

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", margin: 0 }}>Promociones</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <select
            value={selectedLocal}
            onChange={e => setSelectedLocal(e.target.value)}
            style={{ padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 10, color: "white", fontFamily: F, fontSize: "0.82rem", outline: "none" }}
          >
            {restaurants.map(r => <option key={r.id} value={r.id} style={{ background: "#1A1A1A" }}>{r.name}</option>)}
          </select>
          <button onClick={handleGenerate} disabled={generating} style={{
            padding: "8px 16px", background: generating ? "rgba(244,166,35,0.3)" : "#F4A623",
            color: "#0a0a0a", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: generating ? "wait" : "pointer",
          }}>
            {generating ? "🧞 Analizando..." : "🧞 Generar sugerencias"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {[
          { key: "all", label: "Todas" },
          { key: "SUGGESTED", label: "Sugeridas" },
          { key: "ACTIVE", label: "Activas" },
          { key: "PAUSED", label: "Pausadas" },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
            fontFamily: F, fontSize: "0.72rem", fontWeight: 600,
            background: filter === f.key ? "#F4A623" : "rgba(255,255,255,0.05)",
            color: filter === f.key ? "#0a0a0a" : "#888",
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Edit modal */}
      {editing && (
        <div style={{ background: "#1A1A1A", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontFamily: F, fontSize: "1rem", color: "white", marginBottom: 16 }}>Editar promoción</h3>
          <input placeholder="Nombre" value={editName} onChange={e => setEditName(e.target.value)} style={I} />
          <textarea placeholder="Descripción" value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} style={{ ...I, resize: "vertical" }} />
          <input placeholder="Precio promo" type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} style={I} />
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button onClick={saveEdit} style={{ padding: "10px 20px", background: "#F4A623", color: "#0a0a0a", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>Guardar</button>
            <button onClick={() => setEditing(null)} style={{ padding: "10px 20px", background: "none", border: "1px solid #2A2A2A", borderRadius: 8, color: "#888", fontFamily: F, fontSize: "0.85rem", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: "#F4A623", fontFamily: F, padding: 40, textAlign: "center" }}>Cargando...</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(p => {
            const st = STATUS_STYLES[p.status] || STATUS_STYLES.SUGGESTED;
            const isOpen = expanded === p.id;
            const dishNames = p.dishes?.map(d => d.name) || p.dishNames || [];
            return (
              <div key={p.id} style={{ background: "#1A1A1A", border: `1px solid ${isOpen ? "rgba(244,166,35,0.3)" : "#2A2A2A"}`, borderRadius: 14, overflow: "hidden" }}>
                {/* Header */}
                <button onClick={() => setExpanded(isOpen ? null : p.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: st.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>
                    {p.generatedBy === "ai" ? "🧞" : "🏷️"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: F, fontSize: "0.95rem", color: "white", fontWeight: 600 }}>{p.name}</span>
                      <span style={{ fontSize: "0.6rem", padding: "2px 8px", borderRadius: 4, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                    </div>
                    <p style={{ fontFamily: F, fontSize: "0.72rem", color: "#666", margin: "4px 0 0" }}>
                      {p.discountPct && `${p.discountPct}% off`}
                      {p.promoPrice && ` · $${p.promoPrice.toLocaleString("es-CL")}`}
                      {dishNames.length > 0 && ` · ${dishNames.join(", ")}`}
                    </p>
                  </div>
                  <span style={{ fontFamily: F, fontSize: "0.7rem", color: "#555", flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
                </button>

                {/* Detail */}
                {isOpen && (
                  <div style={{ padding: "0 18px 18px", borderTop: "1px solid #2A2A2A" }}>
                    {p.description && <p style={{ fontFamily: F, fontSize: "0.85rem", color: "#aaa", margin: "12px 0", lineHeight: 1.5 }}>{p.description}</p>}

                    {p.aiJustification && (
                      <div style={{ background: "rgba(244,166,35,0.05)", border: "1px solid rgba(244,166,35,0.12)", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
                        <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#F4A623", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Por qué el Genio lo recomienda</p>
                        <p style={{ fontFamily: F, fontSize: "0.82rem", color: "#ccc", lineHeight: 1.5, margin: 0 }}>{p.aiJustification}</p>
                      </div>
                    )}

                    {/* Dishes */}
                    {(p.dishes?.length || 0) > 0 && (
                      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                        {p.dishes!.map(d => (
                          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", border: "1px solid #2A2A2A", borderRadius: 8, padding: "6px 10px" }}>
                            {d.photos?.[0] && <img src={d.photos[0]} alt="" style={{ width: 28, height: 28, borderRadius: 5, objectFit: "cover" }} />}
                            <div>
                              <p style={{ fontFamily: F, fontSize: "0.78rem", color: "white", margin: 0 }}>{d.name}</p>
                              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                {p.promoPrice && <span style={{ fontFamily: F, fontSize: "0.72rem", color: "#4ade80", fontWeight: 600 }}>${p.promoPrice.toLocaleString("es-CL")}</span>}
                                <span style={{ fontFamily: F, fontSize: "0.68rem", color: "#666", textDecoration: p.promoPrice ? "line-through" : "none" }}>${d.price.toLocaleString("es-CL")}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Prices */}
                    <div style={{ display: "flex", gap: 12, fontFamily: F, fontSize: "0.8rem", color: "#888", marginBottom: 14 }}>
                      {p.originalPrice && <span>Original: ${p.originalPrice.toLocaleString("es-CL")}</span>}
                      {p.promoPrice && <span style={{ color: "#4ade80" }}>Promo: ${p.promoPrice.toLocaleString("es-CL")}</span>}
                      {p.discountPct && <span style={{ color: "#F4A623" }}>{p.discountPct}% descuento</span>}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {p.status === "SUGGESTED" && (
                        <>
                          <button onClick={() => handleStatus(p.id, "ACTIVE")} style={btnStyle("#4ade80")}>Aprobar</button>
                          <button onClick={() => handleDelete(p.id)} style={btnStyle("#ff6b6b")}>Descartar</button>
                        </>
                      )}
                      {p.status === "ACTIVE" && (
                        <>
                          <button onClick={() => handleStatus(p.id, "PAUSED")} style={btnStyle("#888")}>Pausar</button>
                          <button onClick={() => startEdit(p)} style={btnStyle("#7fbfdc")}>Editar</button>
                          <button onClick={() => handleDelete(p.id)} style={btnStyle("#ff6b6b")}>Eliminar</button>
                        </>
                      )}
                      {p.status === "PAUSED" && (
                        <>
                          <button onClick={() => handleStatus(p.id, "ACTIVE")} style={btnStyle("#4ade80")}>Activar</button>
                          <button onClick={() => startEdit(p)} style={btnStyle("#7fbfdc")}>Editar</button>
                          <button onClick={() => handleDelete(p.id)} style={btnStyle("#ff6b6b")}>Eliminar</button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 60 }}>
              <p style={{ fontSize: "2rem", marginBottom: 12 }}>🧞</p>
              <p style={{ fontFamily: F, fontSize: "0.92rem", color: "#888" }}>No hay promociones</p>
              <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#555" }}>Toca "Generar sugerencias" para que el Genio analice la carta</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const I: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "#111", border: "1px solid #2A2A2A", borderRadius: 8, color: "white", fontFamily: "var(--font-display)", fontSize: "0.85rem", outline: "none", marginBottom: 10, boxSizing: "border-box" };
function btnStyle(color: string): React.CSSProperties {
  return { padding: "8px 16px", background: `${color}15`, border: `1px solid ${color}40`, borderRadius: 8, color, fontFamily: "var(--font-display)", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" };
}
