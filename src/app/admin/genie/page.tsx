"use client";
import { useState, useEffect, useCallback } from "react";
import { adminFetch } from "@/lib/adminFetch";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Session = any;

const ACTION_EMOJI: Record<string, string> = { VIEWED: "👁️", SELECTED: "✅", IGNORED: "❌", LOVED: "😍", MEH: "😐", DISLIKED: "😕" };
const WEATHER_EMOJI: Record<string, string> = { clear: "☀️", cloudy: "☁️", rain: "🌧️", drizzle: "🌦️", snow: "❄️" };
const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function AdminGenie() {
  const [data, setData] = useState<{ stats: any; sessions: Session[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [geoCache, setGeoCache] = useState<Record<string, string>>({});

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (geoCache[key]) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&addressdetails=1`, { headers: { "Accept-Language": "es" } });
      const d = await res.json();
      const addr = d.address ?? {};
      const parts = [addr.road, addr.suburb || addr.neighbourhood, addr.city || addr.town || addr.village, addr.state, addr.country].filter(Boolean);
      setGeoCache(prev => ({ ...prev, [key]: parts.join(", ") || `${lat.toFixed(4)}, ${lng.toFixed(4)}` }));
    } catch {
      setGeoCache(prev => ({ ...prev, [key]: `${lat.toFixed(4)}, ${lng.toFixed(4)}` }));
    }
  }, [geoCache]);

  useEffect(() => {
    adminFetch("/api/admin/genie")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ fontFamily: "var(--font-display)", color: "rgba(240,234,214,0.4)", padding: 40 }}>Cargando...</p>;
  if (!data) return <p style={{ fontFamily: "var(--font-display)", color: "#ff6b6b", padding: 40 }}>Error al cargar</p>;

  const { stats, sessions } = data;
  const actionMap: Record<string, number> = {};
  (stats.actionCounts ?? []).forEach((a: any) => { actionMap[a.action] = a._count; });

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", color: "#FFD600", marginBottom: 20 }}>🧞 Sesiones del Genio</h1>

      {/* Stats */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
        {[
          { label: "Interacciones", value: stats.totalInteractions, color: "#FFD600" },
          { label: "Sesiones", value: stats.totalSessions, color: "#3db89e" },
          { label: "Perfiles", value: stats.totalProfiles, color: "#a78bfa" },
          { label: "Ratings", value: stats.totalRatings, color: "#ec4899" },
        ].map(s => (
          <div key={s.label} style={{ background: "rgba(45,26,8,0.7)", border: "1px solid rgba(232,168,76,0.12)", borderRadius: 12, padding: "12px 18px", flex: "1 1 0", minWidth: 100, textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", color: s.color, margin: "0 0 2px", fontWeight: 700 }}>{s.value}</p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "0.72rem", color: "rgba(240,234,214,0.4)", margin: 0 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Action breakdown */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        {Object.entries(ACTION_EMOJI).map(([action, emoji]) => (
          <span key={action} style={{ padding: "4px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", fontFamily: "var(--font-display)", fontSize: "0.75rem", color: "rgba(240,234,214,0.5)" }}>
            {emoji} {action}: {actionMap[action] ?? 0}
          </span>
        ))}
      </div>

      {/* Sessions list */}
      {sessions.length === 0 ? (
        <p style={{ fontFamily: "var(--font-display)", color: "rgba(240,234,214,0.3)", textAlign: "center", padding: 40 }}>Sin sesiones aún</p>
      ) : (
        sessions.map((s: Session) => {
          const isOpen = expanded === s.sessionId;
          const viewed = s.actions.filter((a: any) => a.action === "VIEWED").length;
          const selected = s.actions.filter((a: any) => a.action === "SELECTED").length;
          const ignored = s.actions.filter((a: any) => a.action === "IGNORED").length;

          return (
            <div key={s.sessionId} style={{ background: "rgba(45,26,8,0.7)", border: "1px solid rgba(232,168,76,0.1)", borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
              {/* Header */}
              <div onClick={() => setExpanded(isOpen ? null : s.sessionId)} style={{ padding: "12px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem", color: "#FFD600" }}>
                    {s.userId ? "👤" : "👻"} {s.sessionId.slice(0, 8)}
                  </span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "0.72rem", color: "rgba(240,234,214,0.3)", marginLeft: 10 }}>
                    {new Date(s.lastSeen).toLocaleDateString("es-CL")} {new Date(s.lastSeen).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", color: "rgba(240,234,214,0.35)" }}>👁️{viewed} ✅{selected} ❌{ignored}</span>
                  {s.weather && <span style={{ fontSize: 14 }}>{WEATHER_EMOJI[s.weather.condition] ?? "🌡️"} {s.weather.temp}°</span>}
                  <span style={{ color: "rgba(240,234,214,0.3)", fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* Detail */}
              {isOpen && (
                <div style={{ padding: "0 16px 14px", borderTop: "1px solid rgba(232,168,76,0.06)" }}>
                  {/* Context */}
                  {s.context && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10, marginBottom: 8 }}>
                      {s.context.ctxCompany && <span style={chipStyle}>{s.context.ctxCompany}</span>}
                      {s.context.ctxHunger && <span style={chipStyle}>{s.context.ctxHunger}</span>}
                      {s.context.ctxBudget && <span style={chipStyle}>${s.context.ctxBudget.toLocaleString("es-CL")}</span>}
                      {s.context.ctxOccasion && <span style={chipStyle}>{s.context.ctxOccasion}</span>}
                    </div>
                  )}
                  {s.weather && (
                    <p style={{ fontFamily: "var(--font-display)", fontSize: "0.72rem", color: "rgba(240,234,214,0.3)", margin: "4px 0" }}>
                      {WEATHER_EMOJI[s.weather.condition]} {s.weather.temp}°C | {s.weather.condition} | {s.weather.humidity}% humedad
                    </p>
                  )}
                  {s.location && (() => {
                    const geoKey = `${s.location.lat?.toFixed(4)},${s.location.lng?.toFixed(4)}`;
                    if (!geoCache[geoKey]) reverseGeocode(s.location.lat, s.location.lng);
                    return (
                      <p style={{ fontFamily: "var(--font-display)", fontSize: "0.72rem", color: "rgba(240,234,214,0.4)", margin: "4px 0" }}>
                        📍 {geoCache[geoKey] || "Cargando ubicación..."}
                      </p>
                    );
                  })()}

                  {/* Insight */}
                  {s.insight?.conclusion && (
                    <div style={{ background: "rgba(232,168,76,0.06)", border: "1px solid rgba(232,168,76,0.15)", borderRadius: 10, padding: "10px 14px", marginTop: 10, marginBottom: 8 }}>
                      <p style={{ fontFamily: "var(--font-display)", fontSize: "0.78rem", color: "#FFD600", margin: "0 0 6px", fontWeight: 700 }}>Perfil de sesion</p>
                      <p style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", color: "rgba(240,234,214,0.55)", margin: 0, lineHeight: 1.6 }}>{s.insight.conclusion}</p>
                      {s.insight.topIngredients?.length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                          {s.insight.topIngredients.map((ing: string) => (
                            <span key={ing} style={{ padding: "2px 6px", borderRadius: 6, background: "rgba(61,184,158,0.08)", border: "1px solid rgba(61,184,158,0.2)", fontFamily: "var(--font-display)", fontSize: "0.65rem", color: "#3db89e" }}>{ing}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions timeline */}
                  <div style={{ marginTop: 10 }}>
                    {s.actions.map((a: any, i: number) => (
                      <div key={a.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", borderBottom: i < s.actions.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                        <span style={{ fontSize: 14, width: 20, textAlign: "center" }}>{ACTION_EMOJI[a.action] ?? "•"}</span>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: "0.78rem", color: "#FFFFFF", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.menuItem.nombre}</span>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: "0.68rem", color: "rgba(240,234,214,0.25)" }}>{a.menuItem.local.nombre}</span>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: "0.65rem", color: "rgba(240,234,214,0.2)" }}>
                          {a.hour != null ? `${a.hour}h` : ""} {a.dayOfWeek != null ? DAY_NAMES[a.dayOfWeek] : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

const chipStyle: React.CSSProperties = { padding: "3px 8px", borderRadius: 8, background: "rgba(232,168,76,0.08)", border: "1px solid rgba(232,168,76,0.15)", fontFamily: "var(--font-display)", fontSize: "0.68rem", color: "#FFD600" };
