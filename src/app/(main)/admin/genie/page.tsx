"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";

const F = "var(--font-display)";
const VIEW_LABELS: Record<string, string> = { premium: "Clasica", lista: "Lista", viaje: "Espacial" };
const DIET_LABELS: Record<string, string> = { omnivore: "Omnívoro", vegetarian: "Vegetariano", vegan: "Vegano", pescetarian: "Pescetariano", OMNIVORE: "Omnívoro", VEGETARIAN: "Vegetariano", VEGAN: "Vegano", PESCETARIAN: "Pescetariano" };

function formatDate(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

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
  guest: { id: string; visitCount: number; totalSessions: number; linkedQrUserId: string | null; preferences: any };
  qrUser: { id: string; name: string | null; email: string; dietType: string | null } | null;
  usedGenio: boolean;
  genioData: { timesUsed: number; recommendations: { name: string; isBestMatch: boolean }[] } | null;
  visitDays: number;
  ipAddress: string | null;
  dishesViewed: { dishId: string; dwellMs: number; dish: { id: string; name: string; photos: string[]; price: number } | null }[];
  categoriesViewed: { categoryId: string; dwellMs: number; name: string }[];
  topFavorites: { name: string; score: number }[];
  experienceSubmissions: { id: string; templateName: string; templateEmoji: string; resultName: string | null; resultTraits: string[]; status: string; submittedAt: string }[];
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
        <p style={{ fontFamily: F, fontSize: "0.85rem", color: "#999", textAlign: "center", padding: 60 }}>No hay sesiones registradas todavia</p>
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
                      {!s.qrUser && s.visitDays > 1 && <span style={{ fontSize: "0.6rem", background: "rgba(244,166,35,0.15)", color: "#F4A623", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Recurrente ({s.visitDays} días)</span>}
                    </div>
                    <div style={{ fontFamily: F, fontSize: "0.7rem", color: "#999", display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                      <span>{formatDate(s.startedAt)}</span>
                      {s.viewUsed && <span>· {VIEW_LABELS[s.viewUsed] || s.viewUsed}</span>}
                      {s.deviceType && <span>· {s.deviceType}</span>}
                      <span>· {formatDuration(s.durationMs)}</span>
                      {s.dishesViewed.length > 0 && <span>· {s.dishesViewed.length} platos</span>}
                      {s.usedGenio && <span style={{ color: "#F4A623" }}>· 🧞 Genio</span>}
                      {s.experienceSubmissions.length > 0 && <span style={{ color: "#c084fc" }}>· {s.experienceSubmissions[0].templateEmoji} Experiencia</span>}
                    </div>
                  </div>

                  <span style={{ fontFamily: F, fontSize: "0.7rem", color: "#555", flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ padding: "0 16px 16px", borderTop: "1px solid #2A2A2A" }}>
                    {/* User info */}
                    <div style={{ padding: "12px 0", display: "flex", gap: 20, flexWrap: "wrap", fontSize: "0.8rem", fontFamily: F, color: "#aaa" }}>
                      <div>
                        <span style={{ color: "#999" }}>Usuario: </span>
                        <a href={`/admin/usuario/${s.guest.id}`} onClick={e => e.stopPropagation()} style={{ textDecoration: "none", borderBottom: "1px dashed" }}>
                          {s.qrUser ? (
                            <span style={{ color: "#4ade80" }}>{s.qrUser.name || s.qrUser.email}</span>
                          ) : (
                            <span style={{ color: "#F4A623" }}>Fantasma #{s.guest.id.slice(0, 8)}</span>
                          )}
                        </a>
                      </div>
                      <div><span style={{ color: "#999" }}>Fecha: </span>{formatDate(s.startedAt)}</div>
                      {s.weather && <div><span style={{ color: "#999" }}>Clima: </span>{s.weather}</div>}
                      {s.ipAddress && <div><span style={{ color: "#999" }}>IP: </span>{s.ipAddress}</div>}
                    </div>

                    {/* User preferences (always shown if present) */}
                    {(() => {
                      const prefs = s.guest.preferences as any;
                      const dietType = s.qrUser?.dietType || prefs?.dietType;
                      const restrictions = ((prefs?.restrictions || []) as string[]).filter((r: string) => r !== "ninguna");
                      const dislikes = (prefs?.dislikes || []) as string[];
                      const hasPrefData = dietType || restrictions.length > 0 || dislikes.length > 0;
                      return hasPrefData ? (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                          {dietType && <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 4, background: "rgba(74,222,128,0.1)", color: "#4ade80", fontWeight: 600 }}>{DIET_LABELS[dietType] || dietType}</span>}
                          {restrictions.map((r: string) => (
                            <span key={r} style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 4, background: "rgba(232,85,48,0.1)", color: "#ff8a6b" }}>⚠️ {r}</span>
                          ))}
                          {dislikes.map((d: string) => (
                            <span key={d} style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 4, background: "rgba(255,100,100,0.08)", color: "#ff6b6b" }}>🚫 {d}</span>
                          ))}
                        </div>
                      ) : null;
                    })()}

                    {/* Genio data */}
                    {s.usedGenio && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                        <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 4, background: "rgba(244,166,35,0.1)", color: "#F4A623", fontWeight: 600 }}>🧞 Genio{s.genioData?.timesUsed ? ` (${s.genioData.timesUsed}x)` : ""}</span>
                        {s.genioData?.recommendations?.map((rec, i) => (
                          <span key={i} style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 4, background: rec.isBestMatch ? "rgba(244,166,35,0.1)" : "rgba(74,222,128,0.1)", color: rec.isBestMatch ? "#F4A623" : "#4ade80", fontWeight: rec.isBestMatch ? 600 : 400 }}>
                            {rec.isBestMatch ? "⭐ " : ""}Recomendó: {rec.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Experience submissions */}
                    {s.experienceSubmissions.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Experiencias ({s.experienceSubmissions.length})</p>
                        {s.experienceSubmissions.map(exp => (
                          <div key={exp.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(192,132,252,0.06)", border: "1px solid rgba(192,132,252,0.15)", borderRadius: 10, marginBottom: 4 }}>
                            <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>{exp.templateEmoji}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontFamily: F, fontSize: "0.8rem", color: "#c084fc", fontWeight: 600, margin: 0 }}>{exp.templateName}</p>
                              {exp.resultName && <p style={{ fontFamily: F, fontSize: "0.72rem", color: "#e9d5ff", margin: "2px 0 0" }}>Resultado: {exp.resultName}</p>}
                              {exp.resultTraits.length > 0 && (
                                <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                                  {exp.resultTraits.map(t => <span key={t} style={{ fontSize: "0.62rem", padding: "1px 6px", borderRadius: 50, background: "rgba(192,132,252,0.1)", color: "#c084fc", border: "1px solid rgba(192,132,252,0.2)" }}>{t}</span>)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Guest favorite ingredients (accumulated) */}
                    {s.topFavorites.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Le gusta</p>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {s.topFavorites.map((fav, i) => (
                            <span key={fav.name} style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 4, background: i === 0 ? "rgba(74,222,128,0.12)" : "rgba(74,222,128,0.06)", color: "#4ade80", fontWeight: i === 0 ? 600 : 400, border: `1px solid ${i === 0 ? "rgba(74,222,128,0.25)" : "rgba(74,222,128,0.12)"}` }}>
                              {fav.name} ({fav.score})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* View history */}
                    {s.viewHistory && s.viewHistory.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Vistas usadas</p>
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
                        <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Platos vistos ({s.dishesViewed.length})</p>
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
                        <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Categorias exploradas</p>
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
