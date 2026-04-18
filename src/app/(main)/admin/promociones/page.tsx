"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import RestaurantPicker from "@/lib/admin/RestaurantPicker";

const F = "var(--font-display)";
const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  SUGGESTED: { label: "Sugerida por Genio", color: "#F4A623", bg: "rgba(244,166,35,0.1)" },
  ACTIVE: { label: "Activa", color: "#4ade80", bg: "rgba(74,222,128,0.1)" },
  ARCHIVED: { label: "Archivada", color: "#888", bg: "rgba(255,255,255,0.05)" },
  REJECTED: { label: "Rechazada", color: "#ff6b6b", bg: "rgba(255,100,100,0.1)" },
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
  const { selectedRestaurantId, loading: sessionLoading } = useAdminSession();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (sessionLoading || !selectedRestaurantId) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/admin/promotions?restaurantId=${selectedRestaurantId}`)
      .then(r => r.json()).then(d => setPromos(d.promotions || []))
      .catch(() => {}).finally(() => setLoading(false));
  }, [selectedRestaurantId, sessionLoading]);

  const handleGenerate = async () => {
    if (!selectedRestaurantId) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/promotions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suggest", restaurantId: selectedRestaurantId }),
      });
      const data = await res.json();
      if (data.promotions) setPromos(prev => [...data.promotions, ...prev]);
    } catch (e) { console.error(e); }
    setGenerating(false);
  };

  const handleStatusChange = async (id: string, status: string) => {
    const res = await fetch("/api/admin/promotions", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const data = await res.json();
    if (data.promotion) setPromos(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  };

  const filtered = filter === "all" ? promos : promos.filter(p => p.status === filter);

  if (loading) return <p style={{ color: "#F4A623", fontFamily: F, padding: 40 }}>Cargando promociones...</p>;

  if (!selectedRestaurantId) return (
    <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "#888", fontFamily: F }}>Selecciona un local</p><RestaurantPicker /></div>
  );

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", margin: 0 }}>Promociones</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <RestaurantPicker />
          <button onClick={handleGenerate} disabled={generating} style={{
            padding: "8px 16px", background: generating ? "rgba(244,166,35,0.3)" : "#F4A623",
            color: "#0a0a0a", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: generating ? "wait" : "pointer",
          }}>
            {generating ? "🧞 Generando..." : "🧞 Generar sugerencias"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {["all", "SUGGESTED", "ACTIVE", "ARCHIVED", "REJECTED"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
            fontFamily: F, fontSize: "0.72rem", fontWeight: 600,
            background: filter === f ? "#F4A623" : "rgba(255,255,255,0.05)",
            color: filter === f ? "#0a0a0a" : "#888",
          }}>
            {f === "all" ? "Todas" : STATUS_STYLES[f]?.label || f}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(p => {
          const st = STATUS_STYLES[p.status] || STATUS_STYLES.SUGGESTED;
          const isOpen = expanded === p.id;
          return (
            <div key={p.id} style={{ background: "#1A1A1A", border: `1px solid ${isOpen ? "rgba(244,166,35,0.3)" : "#2A2A2A"}`, borderRadius: 14, overflow: "hidden" }}>
              <button onClick={() => setExpanded(isOpen ? null : p.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: st.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>
                  {p.generatedBy === "ai" ? "🧞" : "🏷️"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: F, fontSize: "0.95rem", color: "white", fontWeight: 600 }}>{p.name}</span>
                    <span style={{ fontSize: "0.6rem", padding: "2px 8px", borderRadius: 4, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                  </div>
                  <p style={{ fontFamily: F, fontSize: "0.72rem", color: "#666", margin: "4px 0 0" }}>
                    {p.discountPct && `${p.discountPct}% off`}
                    {p.promoPrice && ` · $${p.promoPrice.toLocaleString("es-CL")}`}
                    {p.dishes?.length ? ` · ${p.dishes.map(d => d.name).join(", ")}` : p.dishNames?.length ? ` · ${p.dishNames.join(", ")}` : ""}
                  </p>
                </div>
                <span style={{ fontFamily: F, fontSize: "0.7rem", color: "#555", flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
              </button>

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
                            <p style={{ fontFamily: F, fontSize: "0.68rem", color: "#888", margin: 0 }}>${d.price.toLocaleString("es-CL")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 12, fontFamily: F, fontSize: "0.8rem", color: "#888", marginBottom: 14 }}>
                    {p.originalPrice && <span>Original: ${p.originalPrice.toLocaleString("es-CL")}</span>}
                    {p.promoPrice && <span style={{ color: "#4ade80" }}>Promo: ${p.promoPrice.toLocaleString("es-CL")}</span>}
                    {p.discountPct && <span style={{ color: "#F4A623" }}>{p.discountPct}% descuento</span>}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8 }}>
                    {p.status === "SUGGESTED" && (
                      <>
                        <button onClick={() => handleStatusChange(p.id, "ACTIVE")} style={{ padding: "8px 16px", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 8, color: "#4ade80", fontFamily: F, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>Aprobar</button>
                        <button onClick={() => handleStatusChange(p.id, "REJECTED")} style={{ padding: "8px 16px", background: "rgba(255,100,100,0.1)", border: "1px solid rgba(255,100,100,0.2)", borderRadius: 8, color: "#ff6b6b", fontFamily: F, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>Rechazar</button>
                      </>
                    )}
                    {p.status === "ACTIVE" && (
                      <button onClick={() => handleStatusChange(p.id, "ARCHIVED")} style={{ padding: "8px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid #2A2A2A", borderRadius: 8, color: "#888", fontFamily: F, fontSize: "0.78rem", cursor: "pointer" }}>Archivar</button>
                    )}
                    {p.status === "REJECTED" && (
                      <button onClick={() => handleStatusChange(p.id, "ACTIVE")} style={{ padding: "8px 16px", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 8, color: "#4ade80", fontFamily: F, fontSize: "0.78rem", cursor: "pointer" }}>Reactivar</button>
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
            <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#555" }}>Toca "Generar sugerencias" para que el Genio analice tu carta</p>
          </div>
        )}
      </div>
    </div>
  );
}
