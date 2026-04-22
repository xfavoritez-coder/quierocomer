"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";

const F = "var(--font-display)";
const VIEW_LABELS: Record<string, string> = { premium: "Clásica", lista: "Lista", viaje: "Espacial" };
const DIET_LABELS: Record<string, string> = { VEGAN: "Vegano", VEGETARIAN: "Vegetariano", OMNIVORE: "Carnívoro", vegan: "Vegano", vegetarian: "Vegetariano", omnivore: "Carnívoro" };

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
  if (days < 30) return `hace ${days}d`;
  return new Date(date).toLocaleDateString("es-CL");
}

interface ExperienceEntry {
  id: string;
  templateName: string;
  templateSlug: string;
  templateEmoji: string;
  templateDescription: string;
  accentColor: string;
  experienceId: string;
  resultName: string | null;
  resultDescription: string | null;
  resultTraits: string[];
  resultImageUrl: string | null;
  personalizedMsg: string | null;
  teaserMsg: string | null;
  status: string;
  submittedAt: string;
}

interface GuestData {
  guest: { id: string; visitCount: number; totalSessions: number; createdAt: string; lastSeenAt: string; preferences: any; favoriteIngredients: Record<string, number> | null };
  user: { id: string; name: string | null; email: string; dietType: string | null; restrictions: string[]; birthDate: string | null; createdAt: string } | null;
  stats: { restaurantsVisited: number; totalSessions: number; avgDuration: number; totalDuration: number; topDishes: { name: string; count: number; totalMs: number }[]; viewPreferences: Record<string, number> };
  sessions: any[];
  experiences: ExperienceEntry[];
}

export default function GuestProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<GuestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [expandedExp, setExpandedExp] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/guest?guestId=${id}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p style={{ color: "#F4A623", fontFamily: F, padding: 40 }}>Cargando perfil...</p>;
  if (!data) return <p style={{ color: "#ff6b6b", fontFamily: F, padding: 40 }}>Usuario no encontrado</p>;

  const { guest, user, stats, sessions, experiences } = data;
  const isRegistered = !!user;
  const prefs = guest.preferences as any;

  return (
    <div style={{ maxWidth: 800 }}>
      <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#F4A623", fontFamily: F, fontSize: "0.85rem", cursor: "pointer", marginBottom: 20 }}>&larr; Volver</button>

      {/* Header */}
      <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: isRegistered ? "#F4A623" : "rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: isRegistered ? "22px" : "14px", fontWeight: 700,
            color: isRegistered ? "#0a0a0a" : "rgba(255,255,255,0.5)",
          }}>
            {user?.name?.charAt(0).toUpperCase() || "👤"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ fontFamily: F, fontSize: "1.3rem", color: "white", margin: 0 }}>
                {user?.name || `Fantasma #${guest.id.slice(0, 8)}`}
              </h1>
              <span style={{ fontSize: "0.6rem", padding: "2px 8px", borderRadius: 4, fontWeight: 600, background: isRegistered ? "rgba(74,222,128,0.1)" : "rgba(244,166,35,0.1)", color: isRegistered ? "#4ade80" : "#F4A623" }}>
                {isRegistered ? "Registrado" : "Fantasma"}
              </span>
            </div>
            {user?.email && <p style={{ fontFamily: F, fontSize: "0.82rem", color: "#888", margin: "2px 0 0" }}>{user.email}</p>}
            <p style={{ fontFamily: F, fontSize: "0.72rem", color: "#555", margin: "4px 0 0" }}>
              Primera visita: {new Date(guest.createdAt).toLocaleDateString("es-CL")} · Última: {timeAgo(guest.lastSeenAt)}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="adm-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[
            { label: "Sesiones", value: stats.totalSessions, color: "#F4A623" },
            { label: "Locales", value: stats.restaurantsVisited, color: "#7fbfdc" },
            { label: "Duración prom.", value: `${stats.avgDuration}s`, color: "#4ade80" },
            { label: "Tiempo total", value: `${Math.floor(stats.totalDuration / 60)}m`, color: "white" },
          ].map(s => (
            <div key={s.label} style={{ background: "#111", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
              <p style={{ fontFamily: F, fontSize: "1.2rem", color: s.color, fontWeight: 700, margin: 0 }}>{s.value}</p>
              <p style={{ fontFamily: F, fontSize: "0.65rem", color: "#666", margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Preferences & Diet */}
      {(user?.dietType || user?.restrictions?.length || prefs) && (
        <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 16, padding: "18px 20px", marginBottom: 20 }}>
          <h3 style={{ fontFamily: F, fontSize: "0.72rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Preferencias</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {user?.dietType && <span style={{ fontFamily: F, fontSize: "0.78rem", padding: "4px 12px", background: "rgba(244,166,35,0.1)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 6, color: "#F4A623" }}>{DIET_LABELS[user.dietType] || user.dietType}</span>}
            {user?.restrictions?.filter(r => r !== "ninguna").map(r => (
              <span key={r} style={{ fontFamily: F, fontSize: "0.78rem", padding: "4px 12px", background: "rgba(255,100,100,0.08)", border: "1px solid rgba(255,100,100,0.15)", borderRadius: 6, color: "#ff6b6b" }}>Sin {r}</span>
            ))}
            {user?.birthDate && <span style={{ fontFamily: F, fontSize: "0.78rem", padding: "4px 12px", background: "rgba(127,191,220,0.1)", border: "1px solid rgba(127,191,220,0.2)", borderRadius: 6, color: "#7fbfdc" }}>🎂 {new Date(user.birthDate).toLocaleDateString("es-CL")}</span>}
            {prefs?.dietType && !user?.dietType && <span style={{ fontFamily: F, fontSize: "0.78rem", padding: "4px 12px", background: "rgba(244,166,35,0.1)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 6, color: "#F4A623" }}>{DIET_LABELS[prefs.dietType] || prefs.dietType} (localStorage)</span>}
          </div>
        </div>
      )}

      {/* Favorite ingredients + Dislikes */}
      {(() => {
        const favIngs = guest.favoriteIngredients || {};
        const topFavs = Object.entries(favIngs).sort((a, b) => b[1] - a[1]).slice(0, 12);
        const dislikesList = (prefs?.dislikes || []) as string[];
        if (topFavs.length === 0 && dislikesList.length === 0) return null;
        return (
          <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 16, padding: "18px 20px", marginBottom: 20 }}>
            <h3 style={{ fontFamily: F, fontSize: "0.72rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Gustos de ingredientes</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {topFavs.map(([name, score]) => (
                <span key={name} style={{ fontFamily: F, fontSize: "0.78rem", padding: "4px 12px", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 6, color: "#4ade80" }}>
                  {name} <span style={{ opacity: 0.5, fontSize: "0.65rem" }}>({score})</span>
                </span>
              ))}
              {dislikesList.map((d: string) => (
                <span key={d} style={{ fontFamily: F, fontSize: "0.78rem", padding: "4px 12px", background: "rgba(255,100,100,0.08)", border: "1px solid rgba(255,100,100,0.15)", borderRadius: 6, color: "#ff6b6b" }}>
                  🚫 {d}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Top dishes + View preferences side by side */}
      <div className="adm-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {stats.topDishes.length > 0 && (
          <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 16, padding: "18px 20px" }}>
            <h3 style={{ fontFamily: F, fontSize: "0.72rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Platos más vistos</h3>
            {stats.topDishes.slice(0, 5).map((d, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontFamily: F, fontSize: "0.8rem" }}>
                <span style={{ color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{d.name}</span>
                <span style={{ color: "#888", marginLeft: 8, flexShrink: 0 }}>{d.count}x · {formatDuration(d.totalMs)}</span>
              </div>
            ))}
          </div>
        )}
        {Object.keys(stats.viewPreferences).length > 0 && (
          <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 16, padding: "18px 20px" }}>
            <h3 style={{ fontFamily: F, fontSize: "0.72rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Vistas preferidas</h3>
            {Object.entries(stats.viewPreferences).sort((a, b) => b[1] - a[1]).map(([view, count], i) => (
              <div key={view} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontFamily: F, fontSize: "0.8rem" }}>
                <span style={{ color: i === 0 ? "#F4A623" : "#ccc", fontWeight: i === 0 ? 600 : 400 }}>{VIEW_LABELS[view] || view}{i === 0 ? " ★" : ""}</span>
                <span style={{ color: "#888" }}>{count}x</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Experiences */}
      {experiences && experiences.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: F, fontSize: "1rem", color: "#c084fc", marginBottom: 12 }}>Experiencias ({experiences.length})</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {experiences.map((exp: ExperienceEntry) => {
              const isExpOpen = expandedExp === exp.id;
              const accent = exp.accentColor || "#c084fc";
              return (
                <div key={exp.id} style={{ background: "#1A1A1A", border: `1px solid ${isExpOpen ? `${accent}50` : "#2A2A2A"}`, borderRadius: 14, overflow: "hidden", transition: "border-color 0.2s" }}>
                  {/* Experience card header */}
                  <button
                    onClick={() => setExpandedExp(isExpOpen ? null : exp.id)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                  >
                    <span style={{ fontSize: "1.8rem", flexShrink: 0 }}>{exp.templateEmoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: F, fontSize: "0.88rem", color: "white", fontWeight: 600 }}>{exp.templateName}</span>
                        <span style={{ fontSize: "0.6rem", padding: "1px 6px", borderRadius: 4, fontWeight: 600, background: exp.status === "sent" ? "rgba(74,222,128,0.1)" : exp.status === "processing" ? "rgba(244,166,35,0.1)" : "rgba(255,255,255,0.06)", color: exp.status === "sent" ? "#4ade80" : exp.status === "processing" ? "#F4A623" : "#888" }}>
                          {exp.status === "sent" ? "Enviado" : exp.status === "processing" ? "Procesando" : exp.status === "pending" ? "Pendiente" : exp.status}
                        </span>
                      </div>
                      <div style={{ fontFamily: F, fontSize: "0.72rem", color: "#888", marginTop: 2 }}>
                        {exp.resultName ? (
                          <span style={{ color: accent, fontWeight: 600 }}>Resultado: {exp.resultName}</span>
                        ) : (
                          <span>Sin resultado aún</span>
                        )}
                        <span> · {timeAgo(exp.submittedAt)}</span>
                      </div>
                    </div>
                    <span style={{ fontFamily: F, fontSize: "0.7rem", color: "#555", flexShrink: 0 }}>{isExpOpen ? "▲" : "▼"}</span>
                  </button>

                  {/* Expanded result */}
                  {isExpOpen && (
                    <div style={{ padding: "0 16px 20px", borderTop: "1px solid #2A2A2A" }}>
                      {exp.resultName ? (
                        <div style={{ textAlign: "center", padding: "20px 0" }}>
                          {exp.resultImageUrl && (
                            <img src={exp.resultImageUrl} alt="" style={{ width: 80, height: 80, borderRadius: 16, objectFit: "cover", margin: "0 auto 16px" }} />
                          )}
                          <p style={{ fontFamily: F, fontSize: "0.7rem", color: accent, letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 6px" }}>Resultado</p>
                          <h3 style={{ fontFamily: "var(--font-playfair), serif", fontSize: "1.6rem", fontWeight: 600, color: accent, margin: "0 0 12px" }}>{exp.resultName}</h3>
                          {exp.resultTraits.length > 0 && (
                            <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
                              {exp.resultTraits.map(t => (
                                <span key={t} style={{ fontSize: "0.7rem", padding: "3px 10px", borderRadius: 50, background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}>{t}</span>
                              ))}
                            </div>
                          )}
                          {exp.resultDescription && (
                            <p style={{ fontFamily: F, fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.6, margin: "0 0 16px", maxWidth: 500, marginLeft: "auto", marginRight: "auto" }}>{exp.resultDescription}</p>
                          )}
                          {exp.personalizedMsg && (
                            <div style={{ background: `${accent}08`, border: `1px solid ${accent}20`, borderRadius: 12, padding: "14px 18px", textAlign: "left", marginBottom: 16 }}>
                              <p style={{ fontFamily: F, fontSize: "0.68rem", color: accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Mensaje personalizado</p>
                              <p style={{ fontFamily: F, fontSize: "0.82rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{exp.personalizedMsg}</p>
                            </div>
                          )}
                          {exp.teaserMsg && (
                            <p style={{ fontFamily: F, fontSize: "0.75rem", color: "#888", fontStyle: "italic", margin: "0 0 16px" }}>Teaser: &ldquo;{exp.teaserMsg}&rdquo;</p>
                          )}
                          <button
                            onClick={() => window.open(`/qr/experience/${exp.templateSlug}`, "_blank")}
                            style={{ background: accent, color: "#0a0a0a", border: "none", borderRadius: 50, padding: "10px 24px", fontSize: "0.82rem", fontWeight: 700, fontFamily: F, cursor: "pointer" }}
                          >
                            Repetir
                          </button>
                        </div>
                      ) : (
                        <p style={{ fontFamily: F, fontSize: "0.82rem", color: "#888", padding: "16px 0", textAlign: "center" }}>Resultado pendiente de procesamiento</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sessions timeline */}
      <h2 style={{ fontFamily: F, fontSize: "1rem", color: "#F4A623", marginBottom: 12 }}>Historial de sesiones ({sessions.length})</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sessions.map((s: any) => {
          const isOpen = expandedSession === s.id;
          return (
            <div key={s.id} style={{ background: "#1A1A1A", border: `1px solid ${isOpen ? "rgba(244,166,35,0.3)" : "#2A2A2A"}`, borderRadius: 12, overflow: "hidden" }}>
              <button onClick={() => setExpandedSession(isOpen ? null : s.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                {s.restaurant?.logoUrl ? (
                  <a href={`/qr/${s.restaurant.slug}`} target="_blank" onClick={e => e.stopPropagation()}>
                    <img src={s.restaurant.logoUrl} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  </a>
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(244,166,35,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#F4A623", flexShrink: 0 }}>{s.restaurant?.name?.charAt(0)}</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <a href={`/qr/${s.restaurant?.slug}`} target="_blank" onClick={e => e.stopPropagation()} style={{ textDecoration: "none" }}>
                    <span style={{ fontFamily: F, fontSize: "0.85rem", color: "white", fontWeight: 600, borderBottom: "1px dashed rgba(255,255,255,0.2)" }}>{s.restaurant?.name}</span>
                  </a>
                  <div style={{ fontFamily: F, fontSize: "0.68rem", color: "#666", display: "flex", gap: 8, marginTop: 2 }}>
                    <span>{timeAgo(s.startedAt)}</span>
                    {s.viewUsed && <span>· {VIEW_LABELS[s.viewUsed] || s.viewUsed}</span>}
                    <span>· {formatDuration(s.durationMs)}</span>
                    {s.dishesViewed?.length > 0 && <span>· {s.dishesViewed.length} platos</span>}
                  </div>
                </div>
                <span style={{ fontFamily: F, fontSize: "0.7rem", color: "#555" }}>{isOpen ? "▲" : "▼"}</span>
              </button>

              {isOpen && (
                <div style={{ padding: "0 14px 14px", borderTop: "1px solid #2A2A2A" }}>
                  <div style={{ padding: "10px 0", fontFamily: F, fontSize: "0.75rem", color: "#888", display: "flex", gap: 16, flexWrap: "wrap" }}>
                    {s.deviceType && <span>Dispositivo: {s.deviceType}</span>}
                    {s.weather && <span>Clima: {s.weather}</span>}
                    {s.closeReason && <span>Cierre: {s.closeReason}</span>}
                  </div>

                  {s.dishesViewed?.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <p style={{ fontFamily: F, fontSize: "0.68rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Platos vistos</p>
                      {s.dishesViewed.map((d: any, i: number) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                          {d.dish?.photos?.[0] && <img src={d.dish.photos[0]} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: "cover" }} />}
                          <span style={{ fontFamily: F, fontSize: "0.78rem", color: "#ccc", flex: 1 }}>{d.dish?.name || d.dishId?.slice(0, 8)}</span>
                          <span style={{ fontFamily: F, fontSize: "0.7rem", color: d.dwellMs > 5000 ? "#F4A623" : "#555" }}>{formatDuration(d.dwellMs)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {s.categoriesViewed?.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {s.categoriesViewed.map((c: any, i: number) => (
                        <span key={i} style={{ fontFamily: F, fontSize: "0.7rem", padding: "3px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 4, color: "#aaa" }}>{c.name} · {formatDuration(c.dwellMs)}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
