"use client";
import { useState, useEffect, useRef } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import PlanGate from "@/components/admin/PlanGate";
import { toast } from "sonner";
import Link from "next/link";
import { Eye, QrCode, Bell, ExternalLink, Cake, Users } from "lucide-react";
import DemoBanner from "@/components/qr/carta/DemoBanner";
import { TrialBanner } from "./layout";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

// ═══ Fake data for demo restaurants ═══
const DEMO_DATA: DashData = {
  visitsThisWeek: 147,
  visitsDelta: 23,
  avgSessionDuration: 94,
  genioUsedThisWeek: 38,
  topDishesViewed: [
    { name: "Pizza Margherita", count: 42, photo: null },
    { name: "Pasta Carbonara", count: 35, photo: null },
    { name: "Tiramisú", count: 28, photo: null },
    { name: "Bruschetta", count: 22, photo: null },
    { name: "Risotto Funghi", count: 18, photo: null },
  ],
  topSearches: [
    { name: "especial", count: 15 },
    { name: "combo", count: 12 },
    { name: "postre", count: 8 },
  ],
  starDish: { name: "Pizza Margherita", count: 42, photo: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=200&q=80" },
  todayScans: 24,
  todayWaiterCalls: 3,
  todayWaiterPending: 1,
  lastScanAt: new Date(Date.now() - 4 * 60000).toISOString(),
  todayUniqueVisitors: 18,
  todayBirthdays: 4,
  weekBirthdays: 21,
  genioToday: 7,
  todayAvgDuration: 82,
  weekGenio: { starts: 38, dietMarked: 32, completed: 28, completionRate: 74, dietRate: 84 },
  weekDietDistribution: [{ type: "omnivore", count: 45 }, { type: "vegetarian", count: 12 }, { type: "vegan", count: 6 }],
  weekRestrictionsList: [{ name: "gluten", count: 8 }, { name: "lactosa", count: 5 }, { name: "frutos secos", count: 3 }],
};

interface DashData {
  visitsThisWeek: number; visitsDelta: number | null;
  avgSessionDuration: number; genioUsedThisWeek: number;
  topDishesViewed: { name: string; count: number; photo?: string | null }[];
  topSearches: { name: string; count: number }[];
  starDish: { name: string; count: number; photo: string | null } | null;
  todayScans: number; todayWaiterCalls: number; todayWaiterPending: number;
  lastScanAt: string | null; todayUniqueVisitors: number;
  todayBirthdays?: number; weekBirthdays: number; genioToday: number; todayAvgDuration: number;
  // Genio funnel + diet/restrictions (week-based)
  weekGenio?: { starts: number; dietMarked: number; completed: number; completionRate: number; dietRate: number };
  weekDietDistribution?: { type: string; count: number }[];
  weekRestrictionsList?: { name: string; count: number }[];
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Sin escaneos aún";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Hace menos de 1 min";
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  return `Hace ${Math.floor(hours / 24)} día${Math.floor(hours / 24) > 1 ? "s" : ""}`;
}

function fmtDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function PanelDashboard() {
  const { restaurants, loading: sessionLoading, selectedRestaurantId, name: ownerName } = useAdminSession();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [restSettings, setRestSettings] = useState<any>(null);
  const [cartaReviewed, setCartaReviewed] = useState(true);
  const [qrGenerated, setQrGenerated] = useState(true);
  const [dietModal, setDietModal] = useState(false);
  const [dietValue, setDietValue] = useState("");
  const [savingChecklist, setSavingChecklist] = useState(false);
  const welcomeShown = useRef(false);

  const selectedRestaurant = restaurants.find(r => r.id === selectedRestaurantId);
  const isDemo = !!(selectedRestaurant as any)?.isDemo;

  useEffect(() => {
    if (welcomeShown.current) return;
    const name = sessionStorage.getItem("panel_welcome");
    if (name) {
      sessionStorage.removeItem("panel_welcome");
      welcomeShown.current = true;
      toast.success(`Bienvenido, ${name.split(" ")[0]}`, { duration: 2500 });
    }
  }, []);

  useEffect(() => {
    if (sessionLoading || !selectedRestaurantId) return;

    // Demo restaurants: fetch real dishes, use fake numbers
    if (isDemo) {
      fetch(`/api/admin/locales/${selectedRestaurantId}/dishes-demo`)
        .then(r => r.json())
        .then(d => {
          if (d.dishes?.length) {
            const fakeCounts = [42, 35, 28, 22, 18];
            const dishes = d.dishes.slice(0, 5).map((dd: any, i: number) => ({ name: dd.name, count: fakeCounts[i], photo: dd.photo }));
            setData({ ...DEMO_DATA, topDishesViewed: dishes, starDish: { name: dishes[0].name, count: dishes[0].count, photo: dishes[0].photo } });
          } else {
            setData(DEMO_DATA);
          }
        })
        .catch(() => { setData(DEMO_DATA); })
        .finally(() => setLoading(false));
      return;
    }

    setLoading(true);
    const rid = selectedRestaurantId;
    // Fetch each API independently so a single failure doesn't blank the whole page
    const safeFetch = (url: string) => fetch(url).then(r => r.ok ? r.json() : null).catch(() => null);
    Promise.all([
      safeFetch(`/api/admin/dashboard?restaurantId=${rid}`),
      safeFetch(`/api/admin/locales/${rid}`),
    ]).then(([d, settings]) => {
      if (d && !d.error) setData(d);
      else {
        // Provide minimal empty data so the page renders instead of "Sin datos disponibles"
        setData({
          visitsThisWeek: 0, visitsDelta: null, avgSessionDuration: 0, genioUsedThisWeek: 0,
          topDishesViewed: [], topSearches: [], starDish: null,
          todayScans: 0, todayWaiterCalls: 0, todayWaiterPending: 0,
          lastScanAt: null, todayUniqueVisitors: 0, todayBirthdays: 0,
          weekBirthdays: 0, genioToday: 0, todayAvgDuration: 0,
        });
      }
      if (settings && !settings.error) {
        setRestSettings(settings);
      }
      setCartaReviewed(localStorage.getItem(`qc_carta_reviewed_${rid}`) === "1");
      setQrGenerated(localStorage.getItem(`qc_qr_generated_${rid}`) === "1");
    }).finally(() => setLoading(false));
  }, [sessionLoading, selectedRestaurantId, isDemo]);

  if (loading || sessionLoading) return (
    <div style={{ maxWidth: 640 }}>
      <div className="skel-pulse" style={{ height: 100, borderRadius: 16, marginBottom: 14 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        <div className="skel-pulse" style={{ height: 64, borderRadius: 12 }} />
        <div className="skel-pulse" style={{ height: 64, borderRadius: 12 }} />
        <div className="skel-pulse" style={{ height: 64, borderRadius: 12 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <div className="skel-pulse" style={{ height: 72, borderRadius: 12 }} />
        <div className="skel-pulse" style={{ height: 72, borderRadius: 12 }} />
        <div className="skel-pulse" style={{ height: 72, borderRadius: 12 }} />
        <div className="skel-pulse" style={{ height: 72, borderRadius: 12 }} />
      </div>
      <div className="skel-pulse" style={{ height: 90, borderRadius: 14, marginBottom: 14 }} />
      <div className="skel-pulse" style={{ height: 120, borderRadius: 14 }} />
      <style>{`
        @keyframes skelPulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }
        .skel-pulse { background: var(--adm-card-border, #2a2a2a); animation: skelPulse 1.4s ease-in-out infinite; }
      `}</style>
    </div>
  );
  if (!data) return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "var(--adm-text2)", fontFamily: F }}>Sin datos disponibles</p></div>;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const topViewed = data.topDishesViewed || [];
  const maxCount = topViewed[0]?.count || 1;

  const rest = restaurants.find(r => r.id === selectedRestaurantId);
  const cartaUrl = rest ? `https://quierocomer.cl/qr/${rest.slug}` : "#";
  const delta = data.visitsDelta;

  return (
    <div style={{ maxWidth: 640 }}>

      {/* ═══ Saludo desktop ═══ */}
      <p className="panel-greeting" style={{
        fontFamily: F, fontSize: "1.3rem", fontWeight: 900, color: "var(--adm-text)",
        margin: "0 0 20px", letterSpacing: "-0.03em",
        display: "none", // hidden by default (mobile)
      }}>
        {greeting}, {ownerName?.split(" ")[0] || ""}
      </p>
      <style>{`@media (min-width: 768px) { .panel-greeting { display: block !important; } }`}</style>


      {/* ═══ Setup checklist ═══ */}
      {!isDemo && restSettings && (() => {
        const checks = [
          { key: "logo", label: "Sube el logo de tu local", done: !!restSettings.logoUrl, href: "/panel/mi-restaurante" },
          // { key: "carta", label: "Revisa que tu carta esté bien", done: cartaReviewed, action: true },
          { key: "qr", label: "Generar código QR", done: qrGenerated, qrAction: true },
        ];
        const doneCount = checks.filter(c => c.done).length;
        const pct = Math.round((doneCount / checks.length) * 100);
        if (pct >= 100) return null;
        return (
          <div style={{
            background: "var(--adm-card)", border: `1px solid ${GOLD}33`,
            borderRadius: 20, padding: "18px 18px 14px", marginBottom: 16,
            boxShadow: "0 2px 12px rgba(244,166,35,0.08)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "1.1rem" }}>⚙️</span>
                <div>
                  <span style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 800, color: "var(--adm-text)", display: "block" }}>Completa tu local</span>
                  <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>
                    {checks.length - doneCount === 1 ? "Te falta 1 paso" : `Te faltan ${checks.length - doneCount} pasos`}
                  </span>
                </div>
              </div>
              <span style={{
                fontFamily: F, fontSize: "0.72rem", fontWeight: 800, color: GOLD,
                background: `${GOLD}18`, padding: "3px 10px", borderRadius: 999,
              }}>{doneCount}/{checks.length}</span>
            </div>
            {/* Progress bar */}
            <div style={{ height: 5, background: "var(--adm-card-border)", borderRadius: 10, marginBottom: 14, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: GOLD, borderRadius: 10, transition: "width 0.4s ease" }} />
            </div>
            {/* Items */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {checks.map(c => (
                <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                    background: c.done ? `${GOLD}20` : "var(--adm-hover)",
                    border: c.done ? `1.5px solid ${GOLD}` : "1.5px solid var(--adm-card-border)",
                    display: "grid", placeItems: "center",
                    fontSize: "0.65rem", color: c.done ? GOLD : "transparent",
                  }}>✓</div>
                  <span style={{
                    flex: 1, fontFamily: FB, fontSize: "0.82rem",
                    color: c.done ? "var(--adm-text3)" : "var(--adm-text)",
                    textDecoration: c.done ? "line-through" : "none",
                    opacity: c.done ? 0.5 : 1,
                  }}>{c.label}</span>
                  {!c.done && ((c as any).qrAction ? (
                    <a href={`/qr/generar/${restSettings?.slug || ""}`} target="_blank" rel="noopener noreferrer" onClick={() => {
                      if (selectedRestaurantId) {
                        localStorage.setItem(`qc_qr_generated_${selectedRestaurantId}`, "1");
                        setQrGenerated(true);
                      }
                    }} style={{
                      padding: "5px 12px", borderRadius: 999, cursor: "pointer", textDecoration: "none",
                      background: `${GOLD}12`, border: `1px solid ${GOLD}30`,
                      color: GOLD, fontFamily: F, fontSize: "0.72rem", fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}>Generar QR</a>
                  ) : (c as any).action ? (
                    <button onClick={() => {
                      if (selectedRestaurantId) {
                        localStorage.setItem(`qc_carta_reviewed_${selectedRestaurantId}`, "1");
                        setCartaReviewed(true);
                        toast.success("Marcado como revisado");
                      }
                    }} style={{
                      padding: "5px 12px", borderRadius: 999, cursor: "pointer",
                      background: `${GOLD}12`, border: `1px solid ${GOLD}30`,
                      color: GOLD, fontFamily: F, fontSize: "0.72rem", fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}>Ya la revisé</button>
                  ) : (c as any).modal ? (
                    <button onClick={() => {
                      if ((c as any).modal === "diet") setDietModal(true);
                    }} style={{
                      padding: "5px 12px", borderRadius: 999, cursor: "pointer",
                      background: `${GOLD}12`, border: `1px solid ${GOLD}30`,
                      color: GOLD, fontFamily: F, fontSize: "0.72rem", fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}>{(c as any).modal === "ig" ? "Agregar" : "Elegir"}</button>
                  ) : (
                    <Link href={(c as any).href!} style={{
                      padding: "5px 12px", borderRadius: 999, textDecoration: "none",
                      background: `${GOLD}12`, border: `1px solid ${GOLD}30`,
                      color: GOLD, fontFamily: F, fontSize: "0.72rem", fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}>{(c as any).btnLabel || "Configurar"}</Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ═══ Quick actions ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <a href={cartaUrl} target="_blank" rel="noopener noreferrer" style={{ border: "1px solid var(--adm-card-border)", background: "var(--adm-card)", borderRadius: 20, padding: 16, display: "flex", alignItems: "center", gap: 13, textDecoration: "none", boxShadow: "var(--adm-card-shadow)" }}>
          <div style={{ width: 38, height: 38, borderRadius: 14, background: "rgba(244,166,35,0.12)", display: "grid", placeItems: "center" }}><Eye size={18} color={GOLD} /></div>
          <div style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 800, color: "var(--adm-text2)", lineHeight: 1.25 }}>Ver mi<br/>carta QR</div>
        </a>
        <Link href="/panel/qr" style={{ border: "1px solid var(--adm-card-border)", background: "var(--adm-card)", borderRadius: 20, padding: 16, display: "flex", alignItems: "center", gap: 13, textDecoration: "none", boxShadow: "var(--adm-card-shadow)" }}>
          <div style={{ width: 38, height: 38, borderRadius: 14, background: "rgba(244,166,35,0.12)", display: "grid", placeItems: "center" }}><QrCode size={18} color={GOLD} /></div>
          <div style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 800, color: "var(--adm-text2)", lineHeight: 1.25 }}>Generar<br/>código QR</div>
        </Link>
      </div>

      {/* ═══ HERO — En vivo ═══ */}
      <div style={{
        position: "relative", overflow: "hidden", border: "1px solid var(--adm-card-border)", borderRadius: 28,
        padding: 24, minHeight: 160, marginBottom: 24,
        background: "linear-gradient(135deg, rgba(255,173,24,0.10), rgba(255,173,24,0.02) 46%, rgba(255,255,255,0.01)), var(--adm-card)",
        boxShadow: "var(--adm-card-shadow)",
      }}>
        <div style={{ position: "absolute", width: 190, height: 190, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,173,24,0.15), transparent 62%)", right: -80, top: -70, filter: "blur(2px)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 20 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#36e982", boxShadow: "0 0 18px rgba(54,233,130,0.8)", animation: "livePulse 2s ease-in-out infinite" }} />
          <span style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text3)", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>En vivo hoy</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
          <div>
            <div style={{ fontFamily: F, fontSize: "3.2rem", fontWeight: 900, letterSpacing: "-0.06em", lineHeight: 0.9, color: "var(--adm-text)" }}>{data.todayUniqueVisitors}</div>
            <div style={{ marginTop: 10, fontFamily: FB, fontSize: "0.92rem", color: "var(--adm-text2)", fontWeight: 700, lineHeight: 1.35 }}>personas han abierto tu carta</div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, opacity: 0.9, height: 42 }}>
            {[20, 33, 27, 40, 31].map((h, i) => (
              <div key={i} style={{ width: 7, height: h, borderRadius: 8, background: "linear-gradient(to top, #F4A623, #ffe0a2)" }} />
            ))}
          </div>
        </div>
        <style>{`@keyframes livePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      </div>

      <PlanGate plan={(rest as any)?.plan} feature="stats_basic">

      {/* ═══ HOY ═══ */}
      <h3 style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px" }}>Hoy</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 20, padding: 17, boxShadow: "var(--adm-card-shadow)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <strong style={{ fontFamily: F, fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1, color: "var(--adm-text)" }}>{data.todayScans}</strong>
            <Eye size={16} color="var(--adm-text3)" />
          </div>
          <span style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", fontWeight: 700 }}>Sesiones abiertas</span>
        </div>
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 20, padding: 17, boxShadow: "var(--adm-card-shadow)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <strong style={{ fontFamily: F, fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1, color: "var(--adm-text)" }}>{(data as any).todayBirthdays || 0}</strong>
            <Cake size={16} color="var(--adm-text3)" />
          </div>
          <span style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", fontWeight: 700 }}>Cumples registrados</span>
        </div>
      </div>

      {/* ═══ ESTA SEMANA ═══ */}
      <h3 style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px" }}>Esta semana</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 20, padding: 17, boxShadow: "var(--adm-card-shadow)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <strong style={{ fontFamily: F, fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1, color: "var(--adm-text)" }}>{data.visitsThisWeek}</strong>
            <Users size={16} color="var(--adm-text3)" />
          </div>
          <span style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", fontWeight: 700 }}>Visitas totales</span>
          {delta !== null && <small style={{ display: "block", color: delta > 0 ? "#36e982" : "#ef4444", fontFamily: F, fontSize: "0.72rem", fontWeight: 900, marginTop: 8 }}>{delta > 0 ? "+" : ""}{delta}% vs anterior</small>}
        </div>
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 20, padding: 17, boxShadow: "var(--adm-card-shadow)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <strong style={{ fontFamily: F, fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1, color: "var(--adm-text)" }}>{data.weekBirthdays || 0}</strong>
            <Cake size={16} color="var(--adm-text3)" />
          </div>
          <span style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", fontWeight: 700 }}>Cumples registrados</span>
          <small style={{ display: "block", color: "#36e982", fontFamily: F, fontSize: "0.72rem", fontWeight: 900, marginTop: 8 }}>+12 vs anterior</small>
        </div>
      </div>

      {/* ═══ Plato estrella ═══ */}
      {data.starDish && (
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          border: "1px solid var(--adm-card-border)", borderRadius: 25, padding: 14, marginBottom: 18,
          background: "linear-gradient(135deg, rgba(255,173,24,0.10), rgba(255,255,255,0.01)), var(--adm-card)",
          boxShadow: "var(--adm-card-shadow)",
        }}>
          {data.starDish.photo ? (
            <img src={data.starDish.photo} alt={data.starDish.name} style={{ width: 72, height: 72, borderRadius: 23, objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: 23, background: "rgba(244,166,35,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", flexShrink: 0 }}>🍽️</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ display: "block", fontFamily: F, fontSize: "0.68rem", color: GOLD, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>⭐ Producto ganador</b>
            <h3 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 900, color: "var(--adm-text)", margin: "0 0 6px", letterSpacing: "-0.04em" }}>{data.starDish.name}</h3>
            <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0, fontWeight: 700 }}><span style={{ color: GOLD }}>{data.starDish.count}</span> vistas esta semana</p>
          </div>
        </div>
      )}

      {/* ═══ Top 5 más vistos ═══ */}
      {topViewed.length > 0 && (
        <div style={{ border: "1px solid var(--adm-card-border)", borderRadius: 25, background: "var(--adm-card)", padding: "19px 18px", marginBottom: 18, boxShadow: "var(--adm-card-shadow)" }}>
          <h3 style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 14px" }}>🔥 Más vistos esta semana</h3>
          {topViewed.slice(0, 5).map((d, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "22px 1fr 42px", alignItems: "center", gap: 10, marginTop: i > 0 ? 14 : 0 }}>
              <div style={{ fontFamily: F, fontSize: "0.88rem", color: "var(--adm-text3)", textAlign: "right" }}>{i + 1}</div>
              <div style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 850, letterSpacing: "-0.02em", color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
              <div style={{ fontFamily: F, fontSize: "0.82rem", color: GOLD, fontWeight: 900, textAlign: "right" }}>{d.count}</div>
              <div style={{ gridColumn: "2 / 4", height: 5, background: "var(--adm-hover)", borderRadius: 10, overflow: "hidden", marginTop: -4 }}>
                <div style={{ height: "100%", width: `${(d.count / maxCount) * 100}%`, background: GOLD, borderRadius: 10 }} />
              </div>
            </div>
          ))}
        </div>
      )}


      </PlanGate>

    </div>
  );
}
