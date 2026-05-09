"use client";
import { useState, useEffect, useRef } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import PlanGate from "@/components/admin/PlanGate";
import { toast } from "sonner";
import Link from "next/link";
import { Eye, QrCode, Bell, ExternalLink } from "lucide-react";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

interface DashData {
  visitsThisWeek: number; visitsDelta: number | null;
  avgSessionDuration: number; genioUsedThisWeek: number;
  topDishesViewed: { name: string; count: number; photo?: string | null }[];
  topSearches: { name: string; count: number }[];
  starDish: { name: string; count: number; photo: string | null } | null;
  todayScans: number; todayWaiterCalls: number; todayWaiterPending: number;
  lastScanAt: string | null; todayUniqueVisitors: number;
  weekBirthdays: number; genioToday: number; todayAvgDuration: number;
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
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/dashboard?restaurantId=${selectedRestaurantId}`).then(r => r.json()),
      fetch(`/api/admin/insights?restaurantId=${selectedRestaurantId}`).then(r => r.json()),
    ]).then(([d, i]) => {
      if (!d.error) setData(d);
      setInsights(i.insights || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [sessionLoading, selectedRestaurantId]);

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
        @keyframes skelPulse { 0%, 100% { opacity: 0.06; } 50% { opacity: 0.12; } }
        .skel-pulse { background: #F4A623; animation: skelPulse 1.4s ease-in-out infinite; }
      `}</style>
    </div>
  );
  if (!data) return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "var(--adm-text2)", fontFamily: F }}>Sin datos disponibles</p></div>;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const topViewed = data.topDishesViewed || [];
  const maxCount = topViewed[0]?.count || 1;

  return (
    <div style={{ maxWidth: 640 }}>
      {/* ═══ HERO — En vivo ═══ */}
      <div style={{ background: "linear-gradient(135deg, var(--adm-card) 0%, rgba(244,166,35,0.08) 100%)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px 22px", marginBottom: 14, position: "relative", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", animation: "livePulse 2s ease-in-out infinite" }} />
          <span style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>En vivo · {timeAgo(data.lastScanAt)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontFamily: F, fontSize: "2.8rem", fontWeight: 700, color: "var(--adm-text)", lineHeight: 1 }}>{data.todayUniqueVisitors}</span>
          <p style={{ fontFamily: F, fontSize: "0.88rem", color: "var(--adm-text2)", margin: 0, fontWeight: 600 }}>visitantes hoy</p>
        </div>
        <p style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text)", margin: "10px 0 0", fontWeight: 600 }}>
          {greeting}, {ownerName?.split(" ")[0] || ""} 👋
        </p>
        <style>{`@keyframes livePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      </div>

      {/* ═══ Quick actions ═══ */}
      {(() => {
        const rest = restaurants.find(r => r.id === selectedRestaurantId);
        const cartaUrl = rest ? `https://quierocomer.cl/qr/${rest.slug}${(rest as any).qrToken ? `?t=${(rest as any).qrToken}` : ""}` : "#";
        return (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            <a href={cartaUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "12px 8px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, textDecoration: "none", position: "relative" }}>
              <ExternalLink size={10} color="var(--adm-text3)" style={{ position: "absolute", top: 6, right: 6 }} />
              <Eye size={18} color={GOLD} />
              <span style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text2)", textAlign: "center" }}>Ver carta</span>
            </a>
            {[
              { icon: QrCode, label: "Imprimir QR", href: "/panel/qr" },
              { icon: Bell, label: "Panel garzón", href: "/panel/garzon" },
            ].map(a => (
              <Link key={a.href} href={a.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "12px 8px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, textDecoration: "none" }}>
                <a.icon size={18} color={GOLD} />
                <span style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text2)", textAlign: "center" }}>{a.label}</span>
              </Link>
            ))}
          </div>
        );
      })()}

      <PlanGate plan={(restaurants.find(r => r.id === selectedRestaurantId) as any)?.plan} feature="stats_basic">

      {/* ═══ Snapshot hoy — 2×2 ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { icon: "📱", label: "Escaneos hoy", value: data.todayScans },
          { icon: "🧞", label: "Abrieron Genio", value: data.genioToday || 0 },
          { icon: "👥", label: "Visitas semana", value: data.visitsThisWeek, sub: data.visitsDelta !== null ? `${data.visitsDelta > 0 ? "+" : ""}${data.visitsDelta}% vs ant.` : undefined, subColor: data.visitsDelta !== null && data.visitsDelta > 0 ? "#4ade80" : data.visitsDelta !== null && data.visitsDelta < 0 ? "#ef4444" : undefined },
          { icon: "🎂", label: "Cumpleaños sem.", value: data.weekBirthdays || 0 },
        ].map((s: any, i) => (
          <div key={i} style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.2rem" }}>{s.icon}</span>
            <div>
              <p style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 700, color: "var(--adm-text)", margin: 0, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>{s.label}</p>
              {s.sub && <p style={{ fontFamily: F, fontSize: "0.6rem", color: s.subColor || "var(--adm-text3)", margin: "1px 0 0", fontWeight: 600 }}>{s.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* ═══ Plato estrella ═══ */}
      {data.starDish && (
        <div style={{ background: "linear-gradient(135deg, var(--adm-card) 0%, rgba(244,166,35,0.06) 100%)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "14px 18px", marginBottom: 14, display: "flex", gap: 14, alignItems: "center" }}>
          {data.starDish.photo ? (
            <img src={data.starDish.photo} alt={data.starDish.name} style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", flexShrink: 0, boxShadow: "0 4px 12px rgba(0,0,0,0.12)" }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: 12, background: "rgba(244,166,35,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", flexShrink: 0 }}>🍽️</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: F, fontSize: "0.62rem", color: GOLD, margin: "0 0 3px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>⭐ Plato estrella esta semana</p>
            <p style={{ fontFamily: FB, fontSize: "0.95rem", color: "var(--adm-text)", margin: "0 0 2px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.starDish.name}</p>
            <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", margin: 0 }}><strong style={{ color: GOLD }}>{data.starDish.count}</strong> vistas</p>
          </div>
        </div>
      )}

      {/* ═══ Top 5 más vistos — barras ═══ */}
      {topViewed.length > 0 && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "14px 18px", marginBottom: 14 }}>
          <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px", fontWeight: 600 }}>🔥 Más vistos esta semana</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topViewed.slice(0, 5).map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", width: 16, textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                    <span style={{ fontFamily: F, fontSize: "0.72rem", color: GOLD, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>{d.count}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "var(--adm-hover)", overflow: "hidden" }}>
                    <div style={{ width: `${(d.count / maxCount) * 100}%`, height: "100%", background: GOLD, borderRadius: 2 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Más buscados — compacto ═══ */}
      {data.topSearches?.length > 0 && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "14px 18px", marginBottom: 14 }}>
          <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px", fontWeight: 600 }}>🔍 Más buscado esta semana</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {data.topSearches.slice(0, 5).map((s, i) => (
              <span key={i} style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text)", background: "var(--adm-hover)", padding: "5px 10px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 4 }}>
                &ldquo;{s.name}&rdquo;
                <span style={{ fontFamily: F, fontSize: "0.65rem", color: GOLD, fontWeight: 700 }}>{s.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Insights del Genio ═══ */}
      {insights.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, fontWeight: 600 }}>🧞 Insights del Genio</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {insights.map(ins => {
              const icons: Record<string, string> = { menu_gap: "🍽️", segment_opportunity: "👥", pricing: "💰", engagement: "📈", platform: "🌐", comparison: "⚖️", opportunity: "🎯" };
              return (
                <div key={ins.id} style={{ background: "var(--adm-card)", border: "1px solid rgba(244,166,35,0.12)", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: 1 }}>{icons[ins.type] || "💡"}</span>
                    <div>
                      <p style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text)", fontWeight: 600, margin: "0 0 3px" }}>{ins.title}</p>
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
