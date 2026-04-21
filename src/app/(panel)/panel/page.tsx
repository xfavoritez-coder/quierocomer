"use client";
import { useState, useEffect, useRef } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { Stat, RankList } from "@/components/admin/DashboardWidgets";
import { toast } from "sonner";
import Link from "next/link";
import { UtensilsCrossed, QrCode, Bell, Tag } from "lucide-react";

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
  lastScanAt: string | null; activePromos: number; weekFavorites: number;
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

  if (loading || sessionLoading) return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: GOLD, fontFamily: F }}>🧞 Cargando...</p></div>;
  if (!data) return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "var(--adm-text2)", fontFamily: F }}>Sin datos disponibles</p></div>;

  const deltaText = data.visitsDelta !== null ? `${data.visitsDelta > 0 ? "+" : ""}${data.visitsDelta}% vs semana pasada` : "Sin datos previos";
  const avgMin = Math.floor(data.avgSessionDuration / 60);
  const avgSec = data.avgSessionDuration % 60;
  const avgText = avgMin > 0 ? `${avgMin}m ${avgSec}s` : `${avgSec}s`;
  const restName = restaurants.find(r => r.id === selectedRestaurantId)?.name || "tu local";

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #FFF4E0, #FDEFC7)", border: "1px solid #E8D0A0", borderRadius: 16, padding: "20px", marginBottom: 20 }}>
        <p style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 600, color: "#1a1a1a", margin: "0 0 4px" }}>👋 Hola, {ownerName?.split(" ")[0] || ""}</p>
        <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "#8a7550", margin: 0 }}>Así va <strong>{restName}</strong> esta semana</p>
        <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "#b8a888", margin: "8px 0 0" }}>{timeAgo(data.lastScanAt)}</p>
      </div>

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
        {[
          { icon: UtensilsCrossed, label: "Editar carta", href: "/panel/menus" },
          { icon: QrCode, label: "Mi QR", href: "/panel/qr" },
          { icon: Bell, label: "Garzón", href: "/panel/garzon" },
        ].map(a => (
          <Link key={a.href} href={a.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 8px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, textDecoration: "none", boxShadow: "var(--adm-card-shadow, none)" }}>
            <a.icon size={20} color={GOLD} />
            <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text2)", textAlign: "center" }}>{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Today */}
      <h2 style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Hoy</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <Stat icon="📱" label="Escaneos hoy" value={data.todayScans} />
        <Stat icon="🔔" label="Llamados garzón" value={data.todayWaiterCalls + data.todayWaiterPending} sub={data.todayWaiterPending > 0 ? `${data.todayWaiterPending} pendiente${data.todayWaiterPending > 1 ? "s" : ""}` : undefined} color={data.todayWaiterPending > 0 ? "#ef4444" : undefined} />
      </div>

      {/* Week */}
      <h2 style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Esta semana</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <Stat icon="👥" label="Visitas" value={data.visitsThisWeek} sub={deltaText} color={data.visitsDelta !== null && data.visitsDelta > 0 ? "var(--adm-positive)" : undefined} />
        <Stat icon="⏱️" label="Duración promedio" value={avgText} />
        <Stat icon="🧞" label="Usaron el Genio" value={data.genioUsedThisWeek} color={GOLD} />
        <Stat icon="❤️" label="Platos favoriteados" value={data.weekFavorites} />
      </div>

      {/* Promos */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "var(--adm-card-shadow, none)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Tag size={18} color={GOLD} />
          <div>
            <p style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text)", margin: 0, fontWeight: 600 }}>{data.activePromos} oferta{data.activePromos !== 1 ? "s" : ""} activa{data.activePromos !== 1 ? "s" : ""}</p>
            {data.activePromos === 0 && <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>Crea tu primera oferta</p>}
          </div>
        </div>
        <Link href="/panel/promociones" style={{ padding: "6px 14px", background: `${GOLD}18`, border: `1px solid ${GOLD}30`, borderRadius: 8, color: GOLD, fontFamily: F, fontSize: "0.72rem", fontWeight: 600, textDecoration: "none" }}>{data.activePromos === 0 ? "Crear" : "Gestionar"}</Link>
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
