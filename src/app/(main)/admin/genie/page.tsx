"use client";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAdminSession } from "@/lib/admin/useAdminSession";

const F = "var(--font-display)";
const VIEW_LABELS: Record<string, string> = { premium: "Galería", lista: "Lista", viaje: "Espacial" };
const DIET_LABELS: Record<string, string> = { omnivore: "Carnívoro", vegetarian: "Vegetariano", vegan: "Vegano", OMNIVORE: "Carnívoro", VEGETARIAN: "Vegetariano", VEGAN: "Vegano" };
const SOURCE_LABELS: Record<string, string> = {
  post_genio_CONVERTED: "Genio",
  cta_post_genio_CONVERTED: "CTA Genio",
  cta_repeat_dish_CONVERTED: "CTA Plato",
  cta_promo_unlock_CONVERTED: "CTA Promo",
  birthday_banner_CONVERTED: "Cumpleaños",
  favorites_CONVERTED: "Favoritos",
  unknown_CONVERTED: "Directo",
};

function formatLanguage(lang: string): string {
  const LANG_MAP: Record<string, string> = {
    es: "Español", en: "Inglés", pt: "Portugués", fr: "Francés", de: "Alemán", it: "Italiano",
    ja: "Japonés", ko: "Coreano", zh: "Chino", ru: "Ruso", ar: "Árabe", hi: "Hindi",
    nl: "Holandés", sv: "Sueco", da: "Danés", no: "Noruego", fi: "Finlandés", pl: "Polaco",
    tr: "Turco", he: "Hebreo", th: "Tailandés", vi: "Vietnamita", uk: "Ucraniano", cs: "Checo",
    ro: "Rumano", hu: "Húngaro", el: "Griego", id: "Indonesio", ms: "Malayo", ca: "Catalán",
  };
  const REGION_MAP: Record<string, string> = {
    US: "EE.UU.", GB: "Reino Unido", AU: "Australia", CA: "Canadá", NZ: "Nueva Zelanda",
    ES: "España", MX: "México", AR: "Argentina", CL: "Chile", CO: "Colombia", PE: "Perú",
    VE: "Venezuela", EC: "Ecuador", UY: "Uruguay", BR: "Brasil", PT: "Portugal",
    FR: "Francia", DE: "Alemania", AT: "Austria", CH: "Suiza", IT: "Italia",
    JP: "Japón", KR: "Corea", CN: "China", TW: "Taiwán", HK: "Hong Kong",
    IN: "India", RU: "Rusia", ZA: "Sudáfrica",
  };
  const code = lang.split("-")[0].toLowerCase();
  const region = lang.split("-")[1]?.toUpperCase();
  const name = LANG_MAP[code] || code;
  if (region && REGION_MAP[region]) return `${name} (${REGION_MAP[region]})`;
  if (region) return `${name} (${region})`;
  return name;
}

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

function parseUA(ua: string | null): string {
  if (!ua) return "";
  let browser = "Navegador desconocido";
  let os = "";
  // OS
  if (/iPhone|iPad/.test(ua)) os = "iOS";
  else if (/Android/.test(ua)) { const m = ua.match(/Android\s([\d.]+)/); os = m ? `Android ${m[1]}` : "Android"; }
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/Linux/.test(ua)) os = "Linux";
  // Browser
  if (/Instagram/.test(ua)) browser = "Instagram";
  else if (/FBAN|FBAV/.test(ua)) browser = "Facebook";
  else if (/CriOS/.test(ua)) browser = "Chrome (iOS)";
  else if (/FxiOS/.test(ua)) browser = "Firefox (iOS)";
  else if (/EdgA?\//.test(ua)) browser = "Edge";
  else if (/SamsungBrowser/.test(ua)) browser = "Samsung Browser";
  else if (/OPR|Opera/.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua) && !/Edg/.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  return os ? `${browser} · ${os}` : browser;
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
  isBot: boolean;
  isAbandoned: boolean;
  pickedDishId: string | null;
  pickedDish: { id: string; name: string; price: number; photos: string[] } | null;
  restaurant: { id: string; name: string; slug: string; logoUrl: string | null };
  guest: { id: string; visitCount: number; totalSessions: number; linkedQrUserId: string | null; preferences: any };
  qrUser: { id: string; name: string | null; email: string; dietType: string | null; createdAt: string; interactions: { type: string; createdAt: string; restaurant: { name: string } }[] } | null;
  tableId: string | null;
  isQrScan: boolean;
  usedGenio: boolean;
  genioData: { timesUsed: number; completed: boolean; profileEdits?: number; lastStep?: string; birthdayClicked?: boolean; birthdaySaved?: boolean; birthdayModalAutoShown?: boolean } | null;
  personalizationData: { shown: number; tapped: number; dishes: { name: string; score: number; tapped: boolean }[] } | null;
  visitDays: number;
  ipAddress: string | null;
  userAgent: string | null;
  referer: string | null;
  externalReferer: string | null;
  language: string | null;
  cartaLang: string | null;
  dishesViewed: { dishId: string; detailMs: number; order?: number; dish: { id: string; name: string; photos: string[]; price: number } | null; isPopular?: boolean; isRecommended?: boolean; isNew?: boolean }[];
  categoriesViewed: { categoryId: string; dwellMs: number; name: string }[];
  dishFavorites: { id: string; dishId: string; dish: { id: string; name: string; photos: string[] } | null; createdAt: string }[];
  experienceSubmissions: { id: string; templateName: string; templateEmoji: string; resultName: string | null; resultTraits: string[]; status: string; submittedAt: string }[];
  waiterCalls: { id: string; tableName: string | null; calledAt: string; answeredAt: string | null; responseTime: number | null }[];
  heroClicks: { dishId: string; dishName: string; dishPhoto: string | null; view: string; clickedAt: string }[];
}

export default function AdminSessions() {
  const { restaurants, loading: sessionLoading } = useAdminSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const filterRestaurant = searchParams.get("restaurantId") || "";
  const filterDate = searchParams.get("date") || "";
  const filterPreset = searchParams.get("preset") || "";
  const filterActivity = searchParams.get("activity") || "";
  const page = parseInt(searchParams.get("page") || "1");

  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dishSort, setDishSort] = useState<"time" | "order">("order");
  const [groupByVisitor, setGroupByVisitor] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toDateStr = (d: Date) => d.toISOString().split("T")[0];
  const today = () => toDateStr(new Date());
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return toDateStr(d); };
  const weekAgo = () => { const d = new Date(); d.setDate(d.getDate() - 7); return toDateStr(d); };

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }, [searchParams, router]);

  const setPage = (p: number) => updateParams({ page: p <= 1 ? null : String(p) });
  const setFilterRestaurant = (v: string) => updateParams({ restaurantId: v || null, page: null });
  const setFilterDate = (v: string) => updateParams({ date: v || null, preset: null, page: null });
  const applyPreset = (preset: string) => updateParams({ preset, date: null, page: null });

  useEffect(() => {
    if (sessionLoading) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (filterRestaurant) params.set("restaurantId", filterRestaurant);
    if (filterActivity) params.set("activity", filterActivity);
    if (filterDate) {
      params.set("date", filterDate);
    } else if (filterPreset === "hoy") {
      params.set("date", today());
    } else if (filterPreset === "ayer") {
      params.set("date", yesterday());
    } else if (filterPreset === "semana") {
      params.set("from", weekAgo());
      params.set("to", today());
    }
    fetch(`/api/admin/sessions?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.sessions) { setSessions(d.sessions); setTotalPages(d.totalPages); setTotal(d.total); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterRestaurant, filterDate, filterPreset, filterActivity, sessionLoading, page, refreshKey]);

  if (loading) return <p style={{ color: "#F4A623", fontFamily: F, padding: 40 }}>Cargando sesiones...</p>;

  return (
    <div style={{ maxWidth: 900 }}>
      <div className="adm-flex-wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", margin: 0 }}>Sesiones</h1>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#888", margin: "4px 0 0" }}>{total} sesiones totales</p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {/* Quick presets */}
          {[
            { key: "hoy", label: "Hoy" },
            { key: "ayer", label: "Ayer" },
            { key: "semana", label: "Esta semana" },
          ].map(p => {
            const active = filterPreset === p.key && !filterDate;
            return (
              <button
                key={p.key}
                onClick={() => { if (active) { updateParams({ preset: null, page: null }); } else { applyPreset(p.key); } }}
                style={{
                  padding: "7px 14px", borderRadius: 10, cursor: "pointer", fontFamily: F, fontSize: "0.78rem", fontWeight: 600,
                  background: active ? "rgba(244,166,35,0.15)" : "rgba(255,255,255,0.04)",
                  border: active ? "1px solid rgba(244,166,35,0.4)" : "1px solid #2A2A2A",
                  color: active ? "#F4A623" : "#888",
                }}
              >{p.label}</button>
            );
          })}
          {/* Date picker */}
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            style={{ padding: "7px 12px", background: "rgba(255,255,255,0.04)", border: `1px solid ${filterDate ? "rgba(244,166,35,0.4)" : "#2A2A2A"}`, borderRadius: 10, color: filterDate ? "#F4A623" : "white", fontFamily: F, fontSize: "0.78rem", outline: "none", colorScheme: "dark" }}
          />
          {(filterDate || filterPreset) && (
            <button onClick={() => updateParams({ date: null, preset: null, page: null })} style={{ padding: "7px 12px", background: "none", border: "1px solid #2A2A2A", borderRadius: 10, color: "#888", fontFamily: F, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>✕</button>
          )}
          {/* Restaurant filter */}
          <select
            value={filterRestaurant}
            onChange={e => setFilterRestaurant(e.target.value)}
            style={{ padding: "7px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #2A2A2A", borderRadius: 10, color: "white", fontFamily: F, fontSize: "0.78rem", outline: "none" }}
          >
            <option value="" style={{ background: "#1A1A1A" }}>Todos los locales</option>
            {restaurants.map(r => <option key={r.id} value={r.id} style={{ background: "#1A1A1A" }}>{r.name}</option>)}
          </select>
          <button onClick={() => setRefreshKey(k => k + 1)} title="Actualizar" style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #2A2A2A", background: "rgba(255,255,255,0.04)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", color: "#888" }}>↻</button>
        </div>
      </div>

      {/* Activity filters */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { key: "genio", label: "🧞 Genio" },
          { key: "garzon", label: "🔔 Garzón" },
          { key: "cumple", label: "🎂 Cumpleaños" },
          { key: "favoritos", label: "❤️ Favoritos" },
        ].map(f => {
          const active = filterActivity === f.key;
          return (
            <button
              key={f.key}
              onClick={() => updateParams({ activity: active ? null : f.key, page: null })}
              style={{
                padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: F, fontSize: "0.74rem", fontWeight: 600,
                background: active ? "rgba(244,166,35,0.15)" : "rgba(255,255,255,0.04)",
                border: active ? "1px solid rgba(244,166,35,0.4)" : "1px solid #2A2A2A",
                color: active ? "#F4A623" : "#666",
              }}
            >{f.label}</button>
          );
        })}
        {filterActivity && (
          <button
            onClick={() => updateParams({ activity: null, page: null })}
            style={{ padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: F, fontSize: "0.74rem", fontWeight: 600, background: "none", border: "1px solid #2A2A2A", color: "#888" }}
          >✕</button>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setGroupByVisitor(g => !g)}
          style={{
            padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: F, fontSize: "0.74rem", fontWeight: 600,
            background: groupByVisitor ? "rgba(127,191,220,0.15)" : "rgba(255,255,255,0.04)",
            border: groupByVisitor ? "1px solid rgba(127,191,220,0.4)" : "1px solid #2A2A2A",
            color: groupByVisitor ? "#7fbfdc" : "#666",
          }}
        >👤 Agrupar por visitante</button>
      </div>

      {sessions.length === 0 ? (
        <p style={{ fontFamily: F, fontSize: "0.85rem", color: "#999", textAlign: "center", padding: 60 }}>No hay sesiones registradas todavia</p>
      ) : groupByVisitor ? (
        /* ═══ GROUPED BY VISITOR ═══ */
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(() => {
            const groups: Record<string, typeof sessions> = {};
            const order: string[] = [];
            for (const s of sessions) {
              if (!groups[s.guest.id]) { groups[s.guest.id] = []; order.push(s.guest.id); }
              groups[s.guest.id].push(s);
            }
            return order.map(guestId => {
              const group = groups[guestId];
              const first = group[0];
              const isOpen = expanded === `group_${guestId}`;
              const totalDuration = group.reduce((a, s) => a + (s.durationMs || 0), 0);
              const totalDishes = group.reduce((a, s) => a + (s.dishesViewed?.length || 0), 0);
              const usedGenio = group.some(s => s.usedGenio);
              return (
                <div key={guestId} style={{ background: "#1A1A1A", border: `1px solid ${isOpen ? "rgba(127,191,220,0.3)" : "#2A2A2A"}`, borderRadius: 14, overflow: "hidden" }}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : `group_${guestId}`)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(127,191,220,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#7fbfdc", flexShrink: 0 }}>👤</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: F, fontSize: "0.85rem", color: "white", fontWeight: 600 }}>
                        Fantasma #{guestId.slice(0, 8)}
                        <span style={{ fontSize: "0.7rem", color: "#7fbfdc", marginLeft: 8, fontWeight: 600 }}>{group.length} sesiones</span>
                      </div>
                      <div style={{ fontFamily: F, fontSize: "0.7rem", color: "#888", display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                        <span>{first.restaurant.name}</span>
                        <span>· {formatDuration(totalDuration)} total</span>
                        {totalDishes > 0 && <span>· {totalDishes} platos</span>}
                        {usedGenio && <span style={{ color: "#F4A623" }}>· 🧞 Genio</span>}
                      </div>
                    </div>
                    <span style={{ fontSize: "1rem", color: "#555", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>▾</span>
                  </button>
                  {isOpen && (
                    <div style={{ borderTop: "1px solid #2A2A2A", padding: "8px" }}>
                      {group.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()).map((s, idx) => {
                        const sOpen = expandedSub === s.id;
                        const time = new Date(s.startedAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
                        return (
                          <div key={s.id} style={{ marginBottom: idx < group.length - 1 ? 6 : 0, background: sOpen ? "rgba(244,166,35,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${sOpen ? "rgba(244,166,35,0.2)" : "#2A2A2A"}`, borderRadius: 10, overflow: "hidden" }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); setExpandedSub(sOpen ? null : s.id); }}
                              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                            >
                              <span style={{ fontFamily: F, fontSize: "0.72rem", color: "#7fbfdc", fontWeight: 600, flexShrink: 0 }}>{idx + 1}ª</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontFamily: F, fontSize: "0.78rem", color: "white" }}>{time}</span>
                                <span style={{ fontFamily: F, fontSize: "0.7rem", color: "#888", marginLeft: 8 }}>
                                  {formatDuration(s.durationMs)} · {s.dishesViewed?.length || 0} platos
                                  {s.viewUsed && ` · ${s.viewUsed === "premium" ? "Galería" : s.viewUsed === "lista" ? "Lista" : "Espacial"}`}
                                </span>
                              </div>
                              <span style={{ fontSize: "0.8rem", color: "#555", transform: sOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
                            </button>
                            {sOpen && (
                              <div style={{ padding: "0 12px 12px", borderTop: "1px solid #2A2A2A" }}>
                                <div style={{ padding: "10px 0", fontSize: "0.75rem", fontFamily: F, color: "#aaa", display: "flex", gap: 12, flexWrap: "wrap" }}>
                                  {s.viewUsed && <span>Vista: {s.viewUsed === "premium" ? "Galería" : s.viewUsed === "lista" ? "Lista" : "Espacial"}</span>}
                                  {s.deviceType && <span>{s.deviceType}</span>}
                                  {s.cartaLang && <span>Carta: {s.cartaLang.toUpperCase()}</span>}
                                </div>
                                {s.usedGenio && s.genioData && (
                                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                                    {s.genioData.completed
                                      ? <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 4, background: "rgba(74,222,128,0.1)", color: "#4ade80", fontWeight: 600 }}>🧞 Configuró preferencias</span>
                                      : <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 4, background: "rgba(239,68,68,0.08)", color: "#ef4444", fontWeight: 600 }}>🧞 {s.genioData.lastStep ? `Abandonó en ${s.genioData.lastStep}` : "Abrió y cerró sin configurar"}</span>
                                    }
                                  </div>
                                )}
                                {s.dishesViewed.length > 0 && (
                                  <div style={{ marginBottom: 8 }}>
                                    <p style={{ fontFamily: F, fontSize: "0.68rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Platos ({s.dishesViewed.length})</p>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                      {[...s.dishesViewed].sort((a, b) => dishSort === "time" ? ((b.detailMs || 0) - (a.detailMs || 0)) : ((a.order ?? 0) - (b.order ?? 0))).map((d, i) => (
                                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: "rgba(255,255,255,0.02)", borderRadius: 6, fontSize: "0.75rem", fontFamily: F }}>
                                          {dishSort === "order" && <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "#7fbfdc", minWidth: 16, textAlign: "center", flexShrink: 0 }}>{i + 1}°</span>}
                                          <span style={{ color: "#ccc", flex: 1 }}>
                                            {d.dish?.name || d.dishId.slice(0, 8)}
                                            {d.isRecommended && <span style={{ fontSize: "0.55rem", marginLeft: 4, padding: "1px 4px", borderRadius: 3, background: "rgba(244,166,35,0.15)", color: "#F4A623", fontWeight: 600 }}>REC</span>}
                                            {d.isPopular && <span style={{ fontSize: "0.55rem", marginLeft: 4, padding: "1px 4px", borderRadius: 3, background: "rgba(239,68,68,0.12)", color: "#f87171", fontWeight: 600 }}>POP</span>}
                                            {d.isNew && <span style={{ fontSize: "0.55rem", marginLeft: 4, padding: "1px 4px", borderRadius: 3, background: "rgba(96,165,250,0.12)", color: "#60a5fa", fontWeight: 600 }}>NEW</span>}
                                          </span>
                                          <span style={{ color: (d.detailMs || 0) > 5000 ? "#4ade80" : "#555" }}>{formatDuration(d.detailMs || 0)} en detalle</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {s.categoriesViewed.length > 0 && (
                                  <div>
                                    <p style={{ fontFamily: F, fontSize: "0.68rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Categorías</p>
                                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                      {s.categoriesViewed.map((c: any, i: number) => (
                                        <span key={i} style={{ fontSize: "0.68rem", padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.04)", color: "#888", fontFamily: F }}>{c.name} · {formatDuration(c.dwellMs)}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      ) : (
        /* ═══ FLAT LIST ═══ */
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Bulk actions */}
          {sessions.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 16px", flexWrap: "wrap" }}>
              <input type="checkbox" checked={bulkSelected.size === sessions.length && sessions.length > 0} onChange={() => {
                if (bulkSelected.size === sessions.length) setBulkSelected(new Set());
                else setBulkSelected(new Set(sessions.map(s => s.id)));
              }} style={{ width: 16, height: 16, accentColor: "#F4A623", cursor: "pointer" }} />
              <span style={{ fontFamily: F, fontSize: "0.72rem", color: "#888" }}>
                {bulkSelected.size > 0 ? `${bulkSelected.size} seleccionada${bulkSelected.size > 1 ? "s" : ""}` : "Seleccionar todas"}
              </span>
              {bulkSelected.size > 0 && (
                <>
                  <button
                    disabled={bulkDeleting}
                    onClick={async () => {
                      if (!confirm(`¿Eliminar ${bulkSelected.size} sesión${bulkSelected.size > 1 ? "es" : ""}?`)) return;
                      setBulkDeleting(true);
                      const ids = Array.from(bulkSelected);
                      const res = await fetch("/api/admin/sessions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionIds: ids }) });
                      if (res.ok) {
                        setSessions(prev => prev.filter(s => !bulkSelected.has(s.id)));
                        setTotal(prev => prev - ids.length);
                        setBulkSelected(new Set());
                      }
                      setBulkDeleting(false);
                    }}
                    style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontFamily: F, fontSize: "0.72rem", fontWeight: 600, cursor: "pointer" }}
                  >
                    {bulkDeleting ? "Eliminando..." : `🗑 Eliminar ${bulkSelected.size}`}
                  </button>
                  <button onClick={() => setBulkSelected(new Set())} style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #2A2A2A", background: "none", color: "#888", fontFamily: F, fontSize: "0.72rem", cursor: "pointer" }}>Cancelar</button>
                </>
              )}
            </div>
          )}
          {sessions.map(s => {
            const isOpen = expanded === s.id;
            // visitsToday/visitNumToday come from the server now — they count
            // ALL sessions in DB for that guest+day, not just ones in this
            // paginated list. See /api/admin/sessions visitsTodayBySession.
            const totalVisitsToday = (s as any).visitsToday ?? 1;
            const visitNum = (s as any).visitNumToday ?? 1;
            return (
              <div key={s.id} style={{ background: bulkSelected.has(s.id) ? "rgba(244,166,35,0.04)" : "#1A1A1A", border: `1px solid ${bulkSelected.has(s.id) ? "rgba(244,166,35,0.25)" : isOpen ? "rgba(244,166,35,0.3)" : "#2A2A2A"}`, borderRadius: 14, overflow: "hidden", transition: "border-color 0.2s", position: "relative" }}>
                {/* Header row */}
                <button
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                >
                  <input type="checkbox" checked={bulkSelected.has(s.id)} onChange={(e) => { e.stopPropagation(); setBulkSelected(prev => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; }); }} onClick={e => e.stopPropagation()} style={{ width: 16, height: 16, accentColor: "#F4A623", cursor: "pointer", flexShrink: 0 }} />
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
                      {s.tableId
                        ? <span style={{ fontSize: "0.6rem", background: "rgba(74,222,128,0.15)", color: "#4ade80", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>QR Mesa {s.tableId}</span>
                        : s.isQrScan
                        ? <span style={{ fontSize: "0.6rem", background: "rgba(96,165,250,0.15)", color: "#60a5fa", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>QR General</span>
                        : <span style={{ fontSize: "0.6rem", background: "rgba(255,255,255,0.06)", color: "#888", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Link directo</span>}
                      {s.waiterCalls?.length > 0 && <span style={{ fontSize: "0.6rem", background: "rgba(74,222,128,0.15)", color: "#4ade80", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>🔔 Garzón</span>}
                      {s.isBot && <span style={{ fontSize: "0.6rem", background: "rgba(239,68,68,0.15)", color: "#ef4444", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Bot</span>}
                      {s.qrUser && (() => {
                        const regTime = new Date(s.qrUser.createdAt).getTime();
                        const sStart = new Date(s.startedAt).getTime() - 60_000;
                        const sEnd = s.endedAt ? new Date(s.endedAt).getTime() + 60_000 : Date.now() + 60_000;
                        const isRegistrationSession = regTime >= sStart && regTime <= sEnd;
                        if (!isRegistrationSession) return null;
                        const src = s.qrUser.interactions?.[0]?.type;
                        const label = src ? SOURCE_LABELS[src] || src.replace("_CONVERTED", "") : null;
                        return <span style={{ fontSize: "0.6rem", background: "rgba(74,222,128,0.15)", color: "#4ade80", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Registrado{label ? ` vía ${label}` : ""}</span>;
                      })()}
                      {!s.qrUser && !s.isBot && s.visitDays > 1 && <span style={{ fontSize: "0.6rem", background: "rgba(244,166,35,0.15)", color: "#F4A623", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Recurrente ({s.visitDays} días)</span>}
                      {totalVisitsToday > 1 && <span style={{ fontSize: "0.6rem", background: "rgba(127,191,220,0.12)", color: "#7fbfdc", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>{visitNum}ª visita hoy</span>}
                    </div>
                    <div style={{ fontFamily: F, fontSize: "0.7rem", color: "#999", display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                      <span>{formatDate(s.startedAt)}</span>
                      {s.viewUsed && <span>· {VIEW_LABELS[s.viewUsed] || s.viewUsed}</span>}
                      {s.deviceType && <span>· {s.deviceType}</span>}
                      {s.userAgent && !s.deviceType && <span>· {parseUA(s.userAgent).split(" · ")[0]}</span>}
                      <span>· {formatDuration(s.durationMs)}</span>
                      {s.dishesViewed.length > 0 && <span>· {s.dishesViewed.length} platos</span>}
                      {(() => {
                        const badged = s.dishesViewed.filter(d => d.isPopular || d.isRecommended || d.isNew);
                        return badged.length > 0 ? <span style={{ color: "#F4A623" }}>· 🏷️ {badged.length} con badge</span> : null;
                      })()}
                      {s.usedGenio && <span style={{ color: "#F4A623" }}>· 🧞 Genio</span>}
                      {s.genioData?.birthdaySaved && <span style={{ color: "#4ade80" }}>· 🎂 Cumple</span>}
                      {s.genioData?.birthdayClicked && !s.genioData?.birthdaySaved && <span style={{ color: "#f59e0b" }}>· 🎂 Abrió</span>}
                      {s.genioData?.birthdayModalAutoShown && !s.genioData?.birthdayClicked && !s.genioData?.birthdaySaved && <span style={{ color: "#a78bfa" }}>· 🎂 Modal auto</span>}
                      {s.personalizationData && s.personalizationData.shown > 0 && (
                        <span style={{ color: "#F4A623" }} title={s.personalizationData.dishes.map(d => `${d.name} (${d.score}pts)${d.tapped ? " ✓" : ""}`).join(", ")}>
                          · ✨ {s.personalizationData.tapped} de {s.personalizationData.shown} Para ti
                        </span>
                      )}
                      {s.waiterCalls?.length > 0 && <span style={{ color: "#16a34a" }}>· 🔔 Garzón ({s.waiterCalls.length})</span>}
                      {s.dishFavorites?.length > 0 && <span style={{ color: "#ef4444" }}>· ❤️ {s.dishFavorites.length}</span>}
                      {s.experienceSubmissions.length > 0 && <span style={{ color: "#c084fc" }}>· {s.experienceSubmissions[0].templateEmoji} Experiencia</span>}
                    </div>
                  </div>

                  <span style={{ fontFamily: F, fontSize: "0.7rem", color: "#555", flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const res = await fetch("/api/admin/sessions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: s.id }) });
                    if (res.ok) { setSessions(prev => prev.filter(x => x.id !== s.id)); setTotal(prev => prev - 1); }
                  }}
                  title="Eliminar sesión"
                  style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: "50%", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#ef4444", fontWeight: 600, zIndex: 2 }}
                >×</button>

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
                      {s.userAgent && <div><span style={{ color: "#999" }}>Navegador: </span>{parseUA(s.userAgent)}</div>}
                      {s.referer && <div><span style={{ color: "#999" }}>Página: </span>{(() => { try { const u = new URL(s.referer); return u.pathname === "/" ? "/" : u.pathname; } catch { return s.referer; } })()}</div>}
                      {s.externalReferer && <div><span style={{ color: "#999" }}>Fuente: </span>{(() => { try { return new URL(s.externalReferer).hostname; } catch { return s.externalReferer; } })()}</div>}
                      {s.language && <div><span style={{ color: "#999" }}>Idioma: </span>{formatLanguage(s.language)}{s.cartaLang && <span style={{ color: s.cartaLang === "es" ? "#888" : "#F4A623", marginLeft: 6 }}>· Carta en {s.cartaLang.toUpperCase()}</span>}</div>}
                      {s.qrUser && (() => {
                        const src = s.qrUser.interactions?.[0];
                        const label = src ? SOURCE_LABELS[src.type] || src.type.replace("_CONVERTED", "") : null;
                        return <>
                          <div><span style={{ color: "#999" }}>Registro: </span><span style={{ color: "#4ade80" }}>{label || "Desconocido"}{src?.restaurant ? ` en ${src.restaurant.name}` : ""}</span></div>
                          <div><span style={{ color: "#999" }}>Registrado el: </span>{formatDate(s.qrUser.createdAt)}</div>
                        </>;
                      })()}
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

                    {/* Genio onboarding data */}
                    {s.usedGenio && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                        {s.genioData?.completed
                          ? <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 4, background: "rgba(74,222,128,0.1)", color: "#4ade80", fontWeight: 600 }}>🧞 Configuró preferencias</span>
                          : <>
                              <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 4, background: "rgba(239,68,68,0.08)", color: "#ef4444", fontWeight: 600 }}>🧞 {s.genioData?.lastStep ? "Abandonó el Genio" : "Abrió y cerró sin configurar"}</span>
                              {s.genioData?.lastStep && <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 4, background: "rgba(127,191,220,0.1)", color: "#7fbfdc", fontWeight: 500 }}>Llegó a: {s.genioData.lastStep}</span>}
                            </>
                        }
                        {(s.genioData?.profileEdits ?? 0) > 0 && <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 4, background: "rgba(244,166,35,0.1)", color: "#F4A623", fontWeight: 500 }}>Editó perfil {s.genioData!.profileEdits}x</span>}
                        {s.genioData?.birthdaySaved && <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 4, background: "rgba(74,222,128,0.1)", color: "#4ade80", fontWeight: 600 }}>🎂 Cumpleaños guardado</span>}
                        {s.genioData?.birthdayClicked && !s.genioData?.birthdaySaved && <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 4, background: "rgba(245,158,11,0.1)", color: "#f59e0b", fontWeight: 600 }}>🎂 Abrió banner pero no guardó</span>}
                        {s.genioData?.birthdayModalAutoShown && <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 4, background: "rgba(167,139,250,0.1)", color: "#a78bfa", fontWeight: 500 }}>🎂 Modal auto (2da visita)</span>}
                      </div>
                    )}

                    {/* Birthday banner (without Genio) */}
                    {!s.usedGenio && (s.genioData?.birthdayClicked || s.genioData?.birthdaySaved || s.genioData?.birthdayModalAutoShown) && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                        {s.genioData?.birthdaySaved
                          ? <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 4, background: "rgba(74,222,128,0.1)", color: "#4ade80", fontWeight: 600 }}>🎂 Cumpleaños guardado</span>
                          : s.genioData?.birthdayClicked
                          ? <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 4, background: "rgba(245,158,11,0.1)", color: "#f59e0b", fontWeight: 600 }}>🎂 Abrió banner pero no guardó</span>
                          : <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 4, background: "rgba(167,139,250,0.1)", color: "#a78bfa", fontWeight: 500 }}>🎂 Modal auto (2da visita)</span>
                        }
                      </div>
                    )}

                    {/* Personalization data */}
                    {s.personalizationData && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                          <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 4, background: "rgba(244,166,35,0.1)", color: "#F4A623", fontWeight: 600 }}>✨ {s.personalizationData.shown} plato{s.personalizationData.shown !== 1 ? "s" : ""} sugerido{s.personalizationData.shown !== 1 ? "s" : ""}</span>
                          <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 4, background: s.personalizationData.tapped > 0 ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.05)", color: s.personalizationData.tapped > 0 ? "#4ade80" : "var(--adm-text3)", fontWeight: 600 }}>{s.personalizationData.tapped} abierto{s.personalizationData.tapped !== 1 ? "s" : ""}</span>
                        </div>
                        {s.personalizationData.dishes.length > 0 && (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {s.personalizationData.dishes.map((d, i) => (
                              <span key={i} style={{ fontSize: "0.65rem", padding: "2px 6px", borderRadius: 4, background: d.tapped ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.04)", color: d.tapped ? "#4ade80" : "var(--adm-text3)" }}>
                                {d.tapped ? "✓ " : ""}{d.name} <span style={{ opacity: 0.5 }}>({d.score}pts)</span>
                              </span>
                            ))}
                          </div>
                        )}
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

                    {/* Waiter calls */}
                    {s.waiterCalls?.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Llamados al garzón ({s.waiterCalls.length})</p>
                        {s.waiterCalls.map(wc => (
                          <div key={wc.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.15)", borderRadius: 8, marginBottom: 4 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: wc.answeredAt ? "#16a34a" : "#ef4444", flexShrink: 0 }} />
                            <span style={{ fontFamily: F, fontSize: "0.78rem", color: "#e0e0e0", flex: 1 }}>{wc.tableName || "Sin mesa"}</span>
                            <span style={{ fontFamily: F, fontSize: "0.68rem", color: "#888" }}>{new Date(wc.calledAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</span>
                            {wc.responseTime !== null ? (
                              <span style={{ fontFamily: F, fontSize: "0.68rem", color: "#16a34a", fontWeight: 600 }}>{wc.responseTime < 60 ? `${wc.responseTime}s` : `${Math.floor(wc.responseTime / 60)}m ${wc.responseTime % 60}s`}</span>
                            ) : (
                              <span style={{ fontFamily: F, fontSize: "0.68rem", color: "#ef4444" }}>Sin atender</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Dish favorites added during this session */}
                    {s.dishFavorites?.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Favoritos ❤️ ({s.dishFavorites.length})</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {s.dishFavorites.map((fav) => (
                            <div key={fav.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "rgba(239,68,68,0.04)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.12)" }}>
                              {fav.dish?.photos?.[0] ? (
                                <img src={fav.dish.photos[0]} alt="" style={{ width: 28, height: 28, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} />
                              ) : (
                                <div style={{ width: 28, height: 28, borderRadius: 5, background: "#2A2A2A", flexShrink: 0 }} />
                              )}
                              <span style={{ fontFamily: F, fontSize: "0.8rem", color: "#ef4444", flex: 1 }}>❤️ {fav.dish?.name || fav.dishId.slice(0, 8)}</span>
                            </div>
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

                    {/* Hero clicks */}
                    {s.heroClicks && s.heroClicks.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Clicks en Hero ({s.heroClicks.length})</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {s.heroClicks.map((h: any, i: number) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "rgba(244,166,35,0.06)", border: "1px solid rgba(244,166,35,0.12)", borderRadius: 8 }}>
                              {h.dishPhoto ? (
                                <img src={h.dishPhoto} alt="" style={{ width: 28, height: 28, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} />
                              ) : (
                                <div style={{ width: 28, height: 28, borderRadius: 5, background: "#2A2A2A", flexShrink: 0 }} />
                              )}
                              <span style={{ fontFamily: F, fontSize: "0.8rem", color: "#ccc", flex: 1 }}>
                                {h.dishName}
                                <span style={{ fontSize: "0.58rem", marginLeft: 5, padding: "1px 5px", borderRadius: 3, background: h.view === "premium" ? "rgba(127,191,220,0.15)" : "rgba(74,222,128,0.1)", color: h.view === "premium" ? "#7fbfdc" : "#4ade80", fontWeight: 600, verticalAlign: "middle" }}>
                                  {h.view === "premium" ? "GALERÍA" : "LISTA"}
                                </span>
                              </span>
                            </div>
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
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Platos vistos ({s.dishesViewed.length})</p>
                          <div style={{ display: "flex", gap: 2 }}>
                            <button onClick={() => setDishSort("order")} style={{ padding: "2px 8px", borderRadius: 4, border: "none", background: dishSort === "order" ? "rgba(244,166,35,0.15)" : "transparent", color: dishSort === "order" ? "#F4A623" : "#555", fontSize: "0.62rem", fontWeight: 600, cursor: "pointer", fontFamily: F }}>Recorrido</button>
                            <button onClick={() => setDishSort("time")} style={{ padding: "2px 8px", borderRadius: 4, border: "none", background: dishSort === "time" ? "rgba(244,166,35,0.15)" : "transparent", color: dishSort === "time" ? "#F4A623" : "#555", fontSize: "0.62rem", fontWeight: 600, cursor: "pointer", fontFamily: F }}>Más tiempo</button>
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {[...s.dishesViewed].sort((a, b) => dishSort === "time" ? ((b.detailMs || 0) - (a.detailMs || 0)) : ((a.order ?? 0) - (b.order ?? 0))).map((d, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
                              {dishSort === "order" && <span style={{ fontFamily: F, fontSize: "0.62rem", fontWeight: 700, color: "#7fbfdc", minWidth: 18, textAlign: "center", flexShrink: 0 }}>{i + 1}°</span>}
                              {d.dish?.photos?.[0] ? (
                                <img src={d.dish.photos[0]} alt="" style={{ width: 28, height: 28, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} />
                              ) : (
                                <div style={{ width: 28, height: 28, borderRadius: 5, background: "#2A2A2A", flexShrink: 0 }} />
                              )}
                              <span style={{ fontFamily: F, fontSize: "0.8rem", color: "#ccc", flex: 1 }}>
                                {d.dish?.name || d.dishId.slice(0, 8)}
                                {d.isRecommended && <span style={{ fontSize: "0.58rem", marginLeft: 5, padding: "1px 5px", borderRadius: 3, background: "rgba(244,166,35,0.15)", color: "#F4A623", fontWeight: 600, verticalAlign: "middle" }}>RECOMENDADO</span>}
                                {d.isPopular && <span style={{ fontSize: "0.58rem", marginLeft: 5, padding: "1px 5px", borderRadius: 3, background: "rgba(239,68,68,0.12)", color: "#f87171", fontWeight: 600, verticalAlign: "middle" }}>POPULAR</span>}
                                {d.isNew && <span style={{ fontSize: "0.58rem", marginLeft: 5, padding: "1px 5px", borderRadius: 3, background: "rgba(96,165,250,0.12)", color: "#60a5fa", fontWeight: 600, verticalAlign: "middle" }}>NUEVO</span>}
                              </span>
                              <span style={{ fontFamily: F, fontSize: "0.72rem", color: (d.detailMs || 0) > 5000 ? "#4ade80" : "#555", fontWeight: (d.detailMs || 0) > 5000 ? 600 : 400 }}>{formatDuration(d.detailMs || 0)} en detalle</span>
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
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #2A2A2A", background: page <= 1 ? "transparent" : "rgba(255,255,255,0.04)", color: page <= 1 ? "#555" : "white", fontFamily: F, fontSize: "0.8rem", cursor: page <= 1 ? "default" : "pointer" }}>Anterior</button>
          <span style={{ fontFamily: F, fontSize: "0.8rem", color: "#888", padding: "8px 12px" }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #2A2A2A", background: page >= totalPages ? "transparent" : "rgba(255,255,255,0.04)", color: page >= totalPages ? "#555" : "white", fontFamily: F, fontSize: "0.8rem", cursor: page >= totalPages ? "default" : "pointer" }}>Siguiente</button>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
}
