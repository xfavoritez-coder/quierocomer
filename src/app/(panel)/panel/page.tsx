"use client";
import { useState, useEffect, useRef } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession"; // reads from SessionContext in panel
import { Stat, RankList } from "@/components/admin/DashboardWidgets";
import { toast } from "sonner";
import Link from "next/link";
import { Eye, QrCode, Bell, Tag, ExternalLink } from "lucide-react";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

interface DashData {
  visitsThisWeek: number; visitsDelta: number | null;
  avgSessionDuration: number; genioUsedThisWeek: number;
  topDishesViewed: { name: string; count: number }[];
  topDishesGenio: { name: string; count: number }[];
  abandonedThisWeek: number;
  todayScans: number; todayWaiterCalls: number; todayWaiterPending: number;
  lastScanAt: string | null; activePromos: number; weekFavorites: number; weekWaiterCalls: number;
  todayUniqueVisitors: number;
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

export default function PanelDashboard() {
  const { restaurants, loading: sessionLoading, selectedRestaurantId, name: ownerName } = useAdminSession();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Insight[]>([]);
  const welcomeShown = useRef(false);

  // Welcome toast on first load after login
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
      {/* Hero skeleton */}
      <div className="skel-pulse" style={{ height: 90, borderRadius: 16, marginBottom: 20 }} />
      {/* Quick actions skeleton */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
        <div className="skel-pulse" style={{ height: 72, borderRadius: 12 }} />
        <div className="skel-pulse" style={{ height: 72, borderRadius: 12 }} />
        <div className="skel-pulse" style={{ height: 72, borderRadius: 12 }} />
      </div>
      {/* Section label */}
      <div className="skel-pulse" style={{ height: 14, width: 60, borderRadius: 4, marginBottom: 10 }} />
      {/* Stat cards skeleton */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <div className="skel-pulse" style={{ height: 80, borderRadius: 14 }} />
        <div className="skel-pulse" style={{ height: 80, borderRadius: 14 }} />
      </div>
      <div className="skel-pulse" style={{ height: 14, width: 100, borderRadius: 4, marginBottom: 10 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <div className="skel-pulse" style={{ height: 80, borderRadius: 14 }} />
        <div className="skel-pulse" style={{ height: 80, borderRadius: 14 }} />
        <div className="skel-pulse" style={{ height: 80, borderRadius: 14 }} />
        <div className="skel-pulse" style={{ height: 80, borderRadius: 14 }} />
      </div>
      <style>{`
        @keyframes skelPulse { 0%, 100% { opacity: 0.06; } 50% { opacity: 0.12; } }
        .skel-pulse { background: #F4A623; animation: skelPulse 1.4s ease-in-out infinite; }
      `}</style>
    </div>
  );
  if (!data) return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "var(--adm-text2)", fontFamily: F }}>Sin datos disponibles</p></div>;

  const deltaText = data.visitsDelta !== null ? `${data.visitsDelta > 0 ? "+" : ""}${data.visitsDelta}% vs semana pasada` : "Sin datos previos";
  const avgMin = Math.floor(data.avgSessionDuration / 60);
  const avgSec = data.avgSessionDuration % 60;
  const avgText = avgMin > 0 ? `${avgMin}m ${avgSec}s` : `${avgSec}s`;
  const restName = restaurants.find(r => r.id === selectedRestaurantId)?.name || "tu local";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";

  return (
    <div style={{ maxWidth: 640 }}>
      <p style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 20px" }}>
        {greeting}, {ownerName?.split(" ")[0] || ""} 👋
      </p>

      {/* Quick actions */}
      {(() => {
        const rest = restaurants.find(r => r.id === selectedRestaurantId);
        const cartaUrl = rest ? `https://quierocomer.cl/qr/${rest.slug}${(rest as any).qrToken ? `?t=${(rest as any).qrToken}` : ""}` : "#";
        return (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
            <a href={cartaUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 8px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, textDecoration: "none", boxShadow: "var(--adm-card-shadow, none)", position: "relative" }}>
              <ExternalLink size={12} color="var(--adm-text3)" style={{ position: "absolute", top: 8, right: 8 }} />
              <Eye size={20} color={GOLD} />
              <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text2)", textAlign: "center" }}>Ver mi carta</span>
            </a>
            {[
              { icon: QrCode, label: "Imprimir QR", href: "/panel/qr" },
              { icon: Bell, label: "Panel garzón", href: "/panel/garzon" },
            ].map(a => (
              <Link key={a.href} href={a.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 8px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, textDecoration: "none", boxShadow: "var(--adm-card-shadow, none)" }}>
                <a.icon size={20} color={GOLD} />
                <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text2)", textAlign: "center" }}>{a.label}</span>
              </Link>
            ))}
          </div>
        );
      })()}

      {/* Today */}
      <h2 style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Hoy</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <Stat icon="📱" label="Escaneos hoy" value={data.todayScans} />
        <Stat icon="👤" label="Visitantes únicos hoy" value={data.todayUniqueVisitors} />
        <Stat icon="🔔" label="Llamados garzón" value={data.todayWaiterCalls + data.todayWaiterPending} sub={data.todayWaiterPending > 0 ? `${data.todayWaiterPending} pendiente${data.todayWaiterPending > 1 ? "s" : ""}` : undefined} color={data.todayWaiterPending > 0 ? "#ef4444" : undefined} />
      </div>

      {/* Week */}
      <h2 style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Esta semana</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <Stat icon="⏱️" label="Duración promedio" value={avgText} />
        <Stat icon="🧞" label="Usaron el Genio" value={data.genioUsedThisWeek} color={GOLD} />
        <Stat icon="🔔" label="Llamados garzón" value={data.weekWaiterCalls || 0} />
        <Stat icon="👍" label="Me gusta" value={data.weekFavorites} />
      </div>


      {/* Abandonment */}
      {data.abandonedThisWeek > 0 && (
        <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <span>📉</span>
          <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "#b45309", margin: 0 }}>{data.abandonedThisWeek} persona{data.abandonedThisWeek > 1 ? "s" : ""} abrieron la carta pero se fueron sin explorar.</p>
        </div>
      )}

      {/* Rankings */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }} className="adm-grid-2">
        <RankList title="🔥 Más vistos" items={data.topDishesViewed} />
        <RankList title="🧞 Recomendados" items={data.topDishesGenio} />
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div>
          <h2 style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>🧞 Insights del Genio</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {insights.map(i => {
              const icons: Record<string, string> = { menu_gap: "🍽️", segment_opportunity: "👥", pricing: "💰", engagement: "📈", platform: "🌐", comparison: "⚖️", opportunity: "🎯" };
              return (
                <div key={i.id} style={{ background: "var(--adm-card)", border: "1px solid rgba(244,166,35,0.12)", borderRadius: 12, padding: "14px 16px", boxShadow: "var(--adm-card-shadow, none)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ fontSize: "1.1rem", flexShrink: 0, marginTop: 2 }}>{icons[i.type] || "💡"}</span>
                    <div>
                      <p style={{ fontFamily: F, fontSize: "0.88rem", color: "var(--adm-text)", fontWeight: 600, margin: "0 0 4px" }}>{i.title}</p>
                      <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", lineHeight: 1.5, margin: 0 }}>{i.body}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
