"use client";
import { useState, useEffect, useRef } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import PlanGate from "@/components/admin/PlanGate";
import { toast } from "sonner";
import Link from "next/link";
import { Eye, QrCode, Bell, ExternalLink, Smartphone, Cake, Users, RefreshCw } from "lucide-react";
import DemoBanner from "@/components/qr/carta/DemoBanner";

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
    { name: "pizza", count: 15 },
    { name: "pasta", count: 12 },
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
};

const DEMO_INSIGHTS = [
  { id: "2", type: "menu_gap", title: "Considera agregar más postres", body: "Las búsquedas de postres representan el 12% del total pero tu carta tiene pocas opciones. Agregar más podría subir el ticket promedio.", priority: 1 },
  { id: "3", type: "opportunity", title: "Destaca Pizza Margherita", body: "Tu plato estrella recibe muchas vistas pero no está marcado como recomendado. Agrégale la etiqueta para que aparezca primero.", priority: 2 },
];

interface DashData {
  visitsThisWeek: number; visitsDelta: number | null;
  avgSessionDuration: number; genioUsedThisWeek: number;
  topDishesViewed: { name: string; count: number; photo?: string | null }[];
  topSearches: { name: string; count: number }[];
  starDish: { name: string; count: number; photo: string | null } | null;
  todayScans: number; todayWaiterCalls: number; todayWaiterPending: number;
  lastScanAt: string | null; todayUniqueVisitors: number;
  todayBirthdays?: number; weekBirthdays: number; genioToday: number; todayAvgDuration: number;
}

interface Insight { id: string; type: string; title: string; body: string; priority: number; }

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
  const [insights, setInsights] = useState<Insight[]>([]);
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

    // Demo restaurants get fake data
    if (isDemo) {
      setData(DEMO_DATA);
      setInsights(DEMO_INSIGHTS);
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      fetch(`/api/admin/dashboard?restaurantId=${selectedRestaurantId}`).then(r => r.json()),
      fetch(`/api/admin/insights?restaurantId=${selectedRestaurantId}`).then(r => r.json()),
    ]).then(([d, i]) => {
      if (!d.error) setData(d);
      setInsights(i.insights || []);
    }).catch(() => {}).finally(() => setLoading(false));
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
  const cartaUrl = rest ? `https://quierocomer.cl/qr/${rest.slug}${(rest as any).qrToken ? `?t=${(rest as any).qrToken}` : ""}` : "#";
  const delta = data.visitsDelta;

  return (
    <div style={{ maxWidth: 640 }}>


      {/* ═══ Quick actions ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <a href={cartaUrl} target="_blank" rel="noopener noreferrer" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.045)", borderRadius: 20, padding: 16, display: "flex", alignItems: "center", gap: 13, textDecoration: "none" }}>
          <div style={{ width: 38, height: 38, borderRadius: 14, background: "rgba(244,166,35,0.12)", display: "grid", placeItems: "center" }}><Eye size={18} color={GOLD} /></div>
          <div style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 800, color: "#d7d9dd", lineHeight: 1.25 }}>Ver mi<br/>carta QR</div>
        </a>
        <Link href="/panel/qr" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.045)", borderRadius: 20, padding: 16, display: "flex", alignItems: "center", gap: 13, textDecoration: "none" }}>
          <div style={{ width: 38, height: 38, borderRadius: 14, background: "rgba(244,166,35,0.12)", display: "grid", placeItems: "center" }}><QrCode size={18} color={GOLD} /></div>
          <div style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 800, color: "#d7d9dd", lineHeight: 1.25 }}>Imprimir<br/>códigos QR</div>
        </Link>
      </div>

      {/* ═══ HERO — En vivo ═══ */}
      <div style={{
        position: "relative", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 28,
        padding: 24, minHeight: 160, marginBottom: 24,
        background: "linear-gradient(135deg, rgba(255,173,24,0.10), rgba(255,173,24,0.02) 46%, rgba(255,255,255,0.01)), var(--adm-card)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
      }}>
        <div style={{ position: "absolute", width: 190, height: 190, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,173,24,0.15), transparent 62%)", right: -80, top: -70, filter: "blur(2px)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 20 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#36e982", boxShadow: "0 0 18px rgba(54,233,130,0.8)", animation: "livePulse 2s ease-in-out infinite" }} />
          <span style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text3)", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>En vivo hoy</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 8, fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", fontWeight: 500 }}><RefreshCw size={9} /> hace 13 min</span>
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
        <div style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 17 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <strong style={{ fontFamily: F, fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1, color: "var(--adm-text)" }}>{data.todayScans}</strong>
            <Smartphone size={16} color="var(--adm-text3)" />
          </div>
          <span style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", fontWeight: 700 }}>Sesiones abiertas</span>
        </div>
        <div style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 17 }}>
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
        <div style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 17 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <strong style={{ fontFamily: F, fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1, color: "var(--adm-text)" }}>{data.visitsThisWeek}</strong>
            <Users size={16} color="var(--adm-text3)" />
          </div>
          <span style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", fontWeight: 700 }}>Visitas totales</span>
          {delta !== null && <small style={{ display: "block", color: delta > 0 ? "#36e982" : "#ef4444", fontFamily: F, fontSize: "0.72rem", fontWeight: 900, marginTop: 8 }}>{delta > 0 ? "+" : ""}{delta}% vs anterior</small>}
        </div>
        <div style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 17 }}>
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
          border: "1px solid rgba(255,255,255,0.08)", borderRadius: 25, padding: 14, marginBottom: 18,
          background: "linear-gradient(135deg, rgba(255,173,24,0.13), rgba(255,255,255,0.035)), var(--adm-card)",
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
        <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 25, background: "rgba(255,255,255,0.045)", padding: "19px 18px", marginBottom: 18 }}>
          <h3 style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 14px" }}>🔥 Más vistos esta semana</h3>
          {topViewed.slice(0, 5).map((d, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "22px 1fr 42px", alignItems: "center", gap: 10, marginTop: i > 0 ? 14 : 0 }}>
              <div style={{ fontFamily: F, fontSize: "0.88rem", color: "var(--adm-text3)", textAlign: "right" }}>{i + 1}</div>
              <div style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 850, letterSpacing: "-0.02em", color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
              <div style={{ fontFamily: F, fontSize: "0.82rem", color: GOLD, fontWeight: 900, textAlign: "right" }}>{d.count}</div>
              <div style={{ gridColumn: "2 / 4", height: 5, background: "rgba(255,255,255,0.055)", borderRadius: 10, overflow: "hidden", marginTop: -4 }}>
                <div style={{ height: "100%", width: `${(d.count / maxCount) * 100}%`, background: GOLD, borderRadius: 10 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ Consejos semanales del Genio ═══ */}
      {insights.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px" }}>🧞 Consejos semanales del Genio</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {insights.map(ins => {
              const icons: Record<string, string> = { menu_gap: "🍽️", segment_opportunity: "👥", pricing: "💰", engagement: "📈", platform: "🌐", comparison: "⚖️", opportunity: "🎯" };
              return (
                <div key={ins.id} style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(244,166,35,0.12)", borderRadius: 20, padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <span style={{ fontSize: "1.1rem", flexShrink: 0, marginTop: 1 }}>{icons[ins.type] || "💡"}</span>
                    <div>
                      <p style={{ fontFamily: F, fontSize: "0.88rem", color: "var(--adm-text)", fontWeight: 700, margin: "0 0 4px" }}>{ins.title}</p>
                      <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", lineHeight: 1.5, margin: 0 }}>{ins.body}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      </PlanGate>
    </div>
  );
}
