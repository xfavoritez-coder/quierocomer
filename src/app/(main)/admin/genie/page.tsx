"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";

const F = "var(--font-display)";
const VIEW_LABELS: Record<string, string> = { premium: "Clasica", lista: "Lista", viaje: "Espacial" };
const TIME_LABELS: Record<string, string> = { MORNING: "Mañana", LUNCH: "Almuerzo", AFTERNOON: "Tarde", DINNER: "Cena", LATE: "Noche" };

function formatDuration(ms: number | null) {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

interface SessionData {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  viewUsed: string | null;
  deviceType: string | null;
  closeReason: string | null;
  weather: string | null;
  timeOfDay: string | null;
  viewHistory: { view: string; durationMs: number }[] | null;
  isAbandoned: boolean;
  pickedDishId: string | null;
  pickedDish: { id: string; name: string; price: number; photos: string[] } | null;
  restaurant: { id: string; name: string; slug: string; logoUrl: string | null };
  guest: { id: string; visitCount: number; totalSessions: number; linkedQrUserId: string | null };
  qrUser: { id: string; name: string | null; email: string; dietType: string | null } | null;
  dishesViewed: { dishId: string; dwellMs: number; dish: { id: string; name: string; photos: string[]; price: number } | null }[];
  categoriesViewed: { categoryId: string; dwellMs: number; name: string }[];
}

export default function AdminSessions() {
  const { restaurants, loading: sessionLoading } = useAdminSession();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterRestaurant, setFilterRestaurant] = useState<string>("");

  useEffect(() => {
    if (sessionLoading) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (filterRestaurant) params.set("restaurantId", filterRestaurant);
    fetch(`/api/admin/sessions?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.sessions) { setSessions(d.sessions); setTotalPages(d.totalPages); setTotal(d.total); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterRestaurant, sessionLoading, page]);

  if (loading) return <p style={{ color: "#F4A623", fontFamily: F, padding: 40 }}>Cargando sesiones...</p>;

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", margin: 0 }}>Sesiones</h1>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#888", margin: "4px 0 0" }}>{total} sesiones totales</p>
        </div>
        <select
          value={filterRestaurant}
          onChange={e => { setFilterRestaurant(e.target.value); setPage(1); }}
          style={{ padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 10, color: "white", fontFamily: F, fontSize: "0.82rem", outline: "none" }}
        >
          <option value="" style={{ background: "#1A1A1A" }}>Todos los locales</option>
          {restaurants.map(r => <option key={r.id} value={r.id} style={{ background: "#1A1A1A" }}>{r.name}</option>)}
        </select>
      </div>

      {sessions.length === 0 ? (
        <p style={{ fontFamily: F, fontSize: "0.85rem", color: "#666", textAlign: "center", padding: 60 }}>No hay sesiones registradas todavia</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sessions.map(s => {
            const isOpen = expanded === s.id;
            return (
              <div key={s.id} style={{ background: "#1A1A1A", border: `1px solid ${isOpen ? "rgba(244,166,35,0.3)" : "#2A2A2A"}`, borderRadius: 14, overflow: "hidden", transition: "border-color 0.2s" }}>
                {/* Header row */}
                <button
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                >
                  {/* Restaurant logo */}
                  {s.restaurant.logoUrl ? (
                    <img src={s.restaurant.logoUrl} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(244,166,35,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#F4A623", flexShrink: 0 }}>{s.restaurant.name.charAt(0)}</div>
                  )}

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: F, fontSize: "0.88rem", color: "white", fontWeight: 600 }}>{s.restaurant.name}</span>
                      {s.qrUser && <span style={{ fontSize: "0.6rem", background: "rgba(74,222,128,0.15)", color: "#4ade80", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Registrado</span>}
                      {!s.qrUser && s.guest.visitCount > 1 && <span style={{ fontSize: "0.6rem", background: "rgba(244,166,35,0.15)", color: "#F4A623", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Recurrente ({s.guest.visitCount}x)</span>}
                    </div>
                    <div style={{ fontFamily: F, fontSize: "0.7rem", color: "#666", display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                      <span>{timeAgo(s.startedAt)}</span>
                      {s.viewUsed && <span>· {VIEW_LABELS[s.viewUsed] || s.viewUsed}</span>}
                      {s.deviceType && <span>· {s.deviceType}</span>}
                      <span>· {formatDuration(s.durationMs)}</span>
                      {s.dishesViewed.length > 0 && <span>· {s.dishesViewed.length} platos vistos</span>}
                    </div>
                  </div>

                  {/* Status */}
                  <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    {s.isAbandoned && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff6b6b" }} />}
                    {!s.isAbandoned && s.endedAt && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80" }} />}
                    {!s.endedAt && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#F4A623", animation: "pulse 2s infinite" }} />}
                    <span style={{ fontFamily: F, fontSize: "0.7rem", color: "#555" }}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ padding: "0 16px 16px", borderTop: "1px solid #2A2A2A" }}>
                    {/* User info */}
                    <div style={{ padding: "12px 0", display: "flex", gap: 20, flexWrap: "wrap", fontSize: "0.8rem", fontFamily: F, color: "#aaa" }}>
                      <div>
                        <span style={{ color: "#666" }}>Usuario: </span>
                        {s.qrUser ? (
                          <span style={{ color: "#4ade80" }}>{s.qrUser.name || s.qrUser.email}{s.qrUser.dietType ? ` · ${s.qrUser.dietType}` : ""}</span>
                        ) : (
                          <span style={{ color: "#F4A623" }}>Fantasma #{s.guest.id.slice(0, 8)}</span>
                        )}
                      </div>
                      {s.weather && <div><span style={{ color: "#666" }}>Clima: </span>{s.weather}</div>}
                      {s.timeOfDay && <div><span style={{ color: "#666" }}>Hora: </span>{TIME_LABELS[s.timeOfDay] || s.timeOfDay}</div>}
                      {s.closeReason && <div><span style={{ color: "#666" }}>Cierre: </span>{s.closeReason}</div>}
                    </div>

                    {/* View history */}
                    {s.viewHistory && s.viewHistory.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Vistas usadas</p>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {s.viewHistory.sort((a: any, b: any) => b.durationMs - a.durationMs).map((v: any, i: number) => (
                            <span key={i} style={{
                              fontFamily: F, fontSize: "0.75rem", padding: "5px 12px",
                              background: i === 0 ? "rgba(244,166,35,0.1)" : "rgba(255,255,255,0.04)",
                              border: `1px solid ${i === 0 ? "rgba(244,166,35,0.25)" : "#2A2A2A"}`,
                              borderRadius: 8, color: i === 0 ? "#F4A623" : "#aaa",
                              fontWeight: i === 0 ? 600 : 400,
                            }}>
                              {VIEW_LABELS[v.view] || v.view} · {formatDuration(v.durationMs)}
                              {i === 0 && " ★"}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Picked dish */}
                    {s.pickedDish && (
                      <div style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 10, padding: "10px 12px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: "1rem" }}>✅</span>
                        <div>
                          <p style={{ fontFamily: F, fontSize: "0.82rem", color: "#4ade80", fontWeight: 600, margin: 0 }}>Eligio: {s.pickedDish.name}</p>
                          <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#888", margin: 0 }}>${s.pickedDish.price.toLocaleString("es-CL")}</p>
                        </div>
                      </div>
                    )}

                    {/* Dishes viewed */}
                    {s.dishesViewed.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Platos vistos ({s.dishesViewed.length})</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {s.dishesViewed.map((d, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
                              {d.dish?.photos?.[0] ? (
                                <img src={d.dish.photos[0]} alt="" style={{ width: 28, height: 28, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} />
                              ) : (
                                <div style={{ width: 28, height: 28, borderRadius: 5, background: "#2A2A2A", flexShrink: 0 }} />
                              )}
                              <span style={{ fontFamily: F, fontSize: "0.8rem", color: "#ccc", flex: 1 }}>{d.dish?.name || d.dishId.slice(0, 8)}</span>
                              <span style={{ fontFamily: F, fontSize: "0.72rem", color: d.dwellMs > 5000 ? "#F4A623" : "#555", fontWeight: d.dwellMs > 5000 ? 600 : 400 }}>{formatDuration(d.dwellMs)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Categories viewed */}
                    {s.categoriesViewed.length > 0 && (
                      <div>
                        <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Categorias exploradas</p>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {s.categoriesViewed.map((c, i) => (
                            <span key={i} style={{ fontFamily: F, fontSize: "0.72rem", padding: "4px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 6, color: "#aaa" }}>
                              {c.name} · {formatDuration(c.dwellMs)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {s.dishesViewed.length === 0 && s.categoriesViewed.length === 0 && (
                      <p style={{ fontFamily: F, fontSize: "0.8rem", color: "#555", fontStyle: "italic" }}>Sin actividad detallada registrada</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #2A2A2A", background: page <= 1 ? "transparent" : "rgba(255,255,255,0.04)", color: page <= 1 ? "#555" : "white", fontFamily: F, fontSize: "0.8rem", cursor: page <= 1 ? "default" : "pointer" }}>Anterior</button>
          <span style={{ fontFamily: F, fontSize: "0.8rem", color: "#888", padding: "8px 12px" }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #2A2A2A", background: page >= totalPages ? "transparent" : "rgba(255,255,255,0.04)", color: page >= totalPages ? "#555" : "white", fontFamily: F, fontSize: "0.8rem", cursor: page >= totalPages ? "default" : "pointer" }}>Siguiente</button>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
}
