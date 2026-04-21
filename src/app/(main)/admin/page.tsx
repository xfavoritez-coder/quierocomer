"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { Stat, RankList, DistributionBar } from "@/components/admin/DashboardWidgets";
import Link from "next/link";
import { UtensilsCrossed, QrCode, Bell, Tag } from "lucide-react";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

const DIET_LABELS: Record<string, string> = { omnivore: "Omnívoro", vegetarian: "Vegetariano", vegan: "Vegano", pescetarian: "Pescetariano" };
const VIEW_LABELS: Record<string, string> = { premium: "Clásica", lista: "Lista", viaje: "Espacial" };

interface DashData {
  visitsThisWeek: number; visitsLastWeek: number; visitsDelta: number | null;
  totalGuests: number; registeredGuests: number; conversionRate: number;
  avgSessionDuration: number; genioUsedThisWeek: number;
  viewDistribution: Record<string, number>; deviceDistribution: Record<string, number>;
  topDishesViewed: { name: string; count: number }[];
  topDishesGenio: { name: string; count: number }[];
  dietDistribution: { type: string; count: number }[];
  abandonedThisWeek: number; activeThisWeek: number;
  activeRestaurantsCount: number; topRestaurants: { name: string; visits: number }[];
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
  const days = Math.floor(hours / 24);
  return `Hace ${days} día${days > 1 ? "s" : ""}`;
}

export default function AdminDashboard() {
  const { restaurants, isSuper, loading: sessionLoading, selectedRestaurantId, name: ownerName } = useAdminSession();
  const [filterRestaurant, setFilterRestaurant] = useState<string>("");
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [emailHealth, setEmailHealth] = useState<{ failuresLast24h: number; configured: boolean } | null>(null);

  useEffect(() => {
    if (sessionLoading) return;
    setLoading(true);
    const rid = isSuper ? filterRestaurant : selectedRestaurantId;
    const params = rid ? `?restaurantId=${rid}` : "";
    Promise.all([
      fetch(`/api/admin/dashboard${params}`).then(r => r.json()),
      rid
        ? fetch(`/api/admin/insights?restaurantId=${rid}`).then(r => r.json())
        : fetch(`/api/admin/insights?mode=global`).then(r => r.json()),
    ]).then(([dashData, insightData]) => {
      if (!dashData.error) setData(dashData);
      setInsights(insightData.insights || []);
    }).catch(() => {}).finally(() => setLoading(false));
    if (isSuper) {
      fetch("/api/admin/email-health").then(r => r.ok ? r.json() : null).then(d => { if (d) setEmailHealth(d); }).catch(() => {});
    }
  }, [filterRestaurant, sessionLoading, selectedRestaurantId, isSuper]);

  if (loading || sessionLoading) {
    return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: GOLD, fontFamily: F, fontSize: "0.85rem" }}>🧞 Cargando dashboard...</p></div>;
  }
  if (!data) {
    return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "var(--adm-text2)", fontFamily: F }}>Sin datos disponibles</p></div>;
  }

  const deltaText = data.visitsDelta !== null ? `${data.visitsDelta > 0 ? "+" : ""}${data.visitsDelta}% vs semana pasada` : "Sin datos previos";
  const avgMin = Math.floor(data.avgSessionDuration / 60);
  const avgSec = data.avgSessionDuration % 60;
  const avgText = avgMin > 0 ? `${avgMin}m ${avgSec}s` : `${avgSec}s`;

  // ─── OWNER DASHBOARD ───
  if (!isSuper) {
    const restName = restaurants.find(r => r.id === selectedRestaurantId)?.name || "tu local";
    return (
      <div style={{ maxWidth: 640 }}>
        {/* Hero */}
        <div style={{ background: "linear-gradient(135deg, #FFF4E0, #FDEFC7)", border: "1px solid #E8D0A0", borderRadius: 16, padding: "20px", marginBottom: 20 }}>
          <p style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 600, color: "#1a1a1a", margin: "0 0 4px" }}>
            👋 Hola, {ownerName?.split(" ")[0] || ""}
          </p>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "#8a7550", margin: 0 }}>
            Así va <strong>{restName}</strong> esta semana
          </p>
          <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "#b8a888", margin: "8px 0 0" }}>
            {timeAgo(data.lastScanAt)}
          </p>
        </div>

        {/* Quick actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
          {[
            { icon: UtensilsCrossed, label: "Editar carta", href: "/admin/menus" },
            { icon: QrCode, label: "Mi QR", href: "/admin/mi-restaurante#qr" },
            { icon: Bell, label: "Garzón", href: "/admin/mi-restaurante#garzon" },
          ].map(a => (
            <Link key={a.href} href={a.href} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              padding: "14px 8px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
              borderRadius: 12, textDecoration: "none", boxShadow: "var(--adm-card-shadow, none)",
            }}>
              <a.icon size={20} color={GOLD} />
              <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text2)", textAlign: "center" }}>{a.label}</span>
            </Link>
          ))}
        </div>

        {/* Today metrics */}
        <h2 style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Hoy</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          <Stat icon="📱" label="Escaneos hoy" value={data.todayScans} />
          <Stat icon="🔔" label="Llamados garzón" value={data.todayWaiterCalls + data.todayWaiterPending}
            sub={data.todayWaiterPending > 0 ? `${data.todayWaiterPending} pendiente${data.todayWaiterPending > 1 ? "s" : ""}` : undefined}
            color={data.todayWaiterPending > 0 ? "#ef4444" : undefined} />
        </div>

        {/* Week metrics */}
        <h2 style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Esta semana</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          <Stat icon="👥" label="Visitas" value={data.visitsThisWeek} sub={deltaText}
            color={data.visitsDelta !== null && data.visitsDelta > 0 ? "var(--adm-positive)" : undefined} />
          <Stat icon="⏱️" label="Duración promedio" value={avgText} />
          <Stat icon="🧞" label="Usaron el Genio" value={data.genioUsedThisWeek} color={GOLD} />
          <Stat icon="❤️" label="Platos favoriteados" value={data.weekFavorites} />
        </div>

        {/* Promos status */}
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "var(--adm-card-shadow, none)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Tag size={18} color={GOLD} />
            <div>
              <p style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text)", margin: 0, fontWeight: 600 }}>
                {data.activePromos} oferta{data.activePromos !== 1 ? "s" : ""} activa{data.activePromos !== 1 ? "s" : ""}
              </p>
              {data.activePromos === 0 && (
                <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>Crea tu primera oferta para atraer más clientes</p>
              )}
            </div>
          </div>
          <Link href="/admin/promociones" style={{ padding: "6px 14px", background: `${GOLD}18`, border: `1px solid ${GOLD}30`, borderRadius: 8, color: GOLD, fontFamily: F, fontSize: "0.72rem", fontWeight: 600, textDecoration: "none" }}>
            {data.activePromos === 0 ? "Crear" : "Gestionar"}
          </Link>
        </div>

        {/* Engagement */}
        {data.abandonedThisWeek > 0 && (
          <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1rem" }}>📉</span>
            <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "#b45309", margin: 0 }}>
              {data.abandonedThisWeek} persona{data.abandonedThisWeek > 1 ? "s" : ""} abrieron la carta pero se fueron sin explorar. Considera agregar fotos a tus platos.
            </p>
          </div>
        )}

        {/* Rankings */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }} className="adm-grid-2">
          <RankList title="🔥 Más vistos" items={data.topDishesViewed} />
          <RankList title="🧞 Recomendados por Genio" items={data.topDishesGenio} />
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <h2 style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>🧞 Insights del Genio</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {insights.map(i => {
                const typeIcons: Record<string, string> = { menu_gap: "🍽️", segment_opportunity: "👥", pricing: "💰", engagement: "📈", platform: "🌐", comparison: "⚖️", opportunity: "🎯" };
                return (
                  <div key={i.id} style={{ background: "var(--adm-card)", border: "1px solid rgba(244,166,35,0.12)", borderRadius: 12, padding: "14px 16px", boxShadow: "var(--adm-card-shadow, none)" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span style={{ fontSize: "1.1rem", flexShrink: 0, marginTop: 2 }}>{typeIcons[i.type] || "💡"}</span>
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

  // ─── SUPERADMIN DASHBOARD ───
  return (
    <div style={{ maxWidth: 800 }}>
      <div className="adm-flex-wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 10 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: GOLD, margin: 0 }}>Dashboard</h1>
        <select
          value={filterRestaurant}
          onChange={e => setFilterRestaurant(e.target.value)}
          style={{ padding: "8px 12px", background: "var(--adm-select-bg)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", outline: "none" }}
        >
          <option value="" style={{ background: "var(--adm-select-bg)" }}>Todos los locales</option>
          {restaurants.map(r => <option key={r.id} value={r.id} style={{ background: "var(--adm-select-bg)" }}>{r.name}</option>)}
        </select>
      </div>

      {/* Email health warning */}
      {emailHealth && (emailHealth.failuresLast24h > 0 || !emailHealth.configured) && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "1.1rem" }}>⚠️</span>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#ef4444", margin: 0 }}>
            {!emailHealth.configured
              ? "Resend API key no configurada."
              : `${emailHealth.failuresLast24h} email${emailHealth.failuresLast24h > 1 ? "s" : ""} fallido${emailHealth.failuresLast24h > 1 ? "s" : ""} en las últimas 24h.`}
          </p>
        </div>
      )}

      {/* Main metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        <Stat label="Visitas esta semana" value={data.visitsThisWeek} sub={deltaText} color={data.visitsDelta !== null && data.visitsDelta > 0 ? "var(--adm-positive)" : undefined} />
        <Stat label="Visitantes únicos" value={data.totalGuests} />
        <Stat label="Registrados" value={data.registeredGuests} sub={`${data.conversionRate}% conversión`} color="var(--adm-positive)" />
        <Stat label="Duración promedio" value={avgText} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        <Stat label="🧞 Genio usado esta semana" value={data.genioUsedThisWeek} color={GOLD} />
      </div>

      <div className="adm-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <DistributionBar title="Vista preferida" data={data.viewDistribution} labels={VIEW_LABELS} />
        <DistributionBar title="Dispositivo" data={data.deviceDistribution} />
      </div>

      <div className="adm-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <RankList title="🔥 Platos más vistos" items={data.topDishesViewed} />
        <RankList title="🧞 Más recomendados por Genio" items={data.topDishesGenio} />
      </div>

      <DistributionBar title="Tipo de dieta de los clientes" data={Object.fromEntries(data.dietDistribution.map(d => [d.type, d.count]))} labels={DIET_LABELS} />

      {data.topRestaurants.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <RankList title="🏆 Top locales por visitas" items={data.topRestaurants.map(r => ({ name: r.name, count: r.visits }))} />
          <div style={{ marginTop: 12 }}>
            <Stat label="Locales activos (últimos 30 días)" value={data.activeRestaurantsCount} color="#7fbfdc" />
          </div>
        </div>
      )}

      {/* Insights */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontFamily: F, fontSize: "1rem", color: GOLD, margin: 0 }}>🧞 Insights del Genio</h2>
          <button
            onClick={async () => {
              setGeneratingInsights(true);
              try {
                const res = await fetch("/api/admin/insights", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ restaurantId: filterRestaurant || null, action: "generate", mode: filterRestaurant ? undefined : "global" }),
                });
                const d = await res.json();
                if (d.insights) setInsights(d.insights);
              } catch {} finally { setGeneratingInsights(false); }
            }}
            disabled={generatingInsights}
            style={{ padding: "6px 14px", background: "rgba(244,166,35,0.1)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 8, color: GOLD, fontFamily: F, fontSize: "0.72rem", fontWeight: 600, cursor: generatingInsights ? "wait" : "pointer" }}
          >
            {generatingInsights ? "Analizando..." : "Generar insights"}
          </button>
        </div>
        {insights.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {insights.map(i => {
              const typeIcons: Record<string, string> = { menu_gap: "🍽️", segment_opportunity: "👥", pricing: "💰", engagement: "📈", platform: "🌐", comparison: "⚖️", opportunity: "🎯" };
              return (
                <div key={i.id} style={{ background: "var(--adm-card)", border: "1px solid rgba(244,166,35,0.12)", borderRadius: 12, padding: "14px 16px", boxShadow: "var(--adm-card-shadow, none)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ fontSize: "1.1rem", flexShrink: 0, marginTop: 2 }}>{typeIcons[i.type] || "💡"}</span>
                    <div>
                      <p style={{ fontFamily: F, fontSize: "0.88rem", color: "var(--adm-text)", fontWeight: 600, margin: "0 0 4px" }}>{i.title}</p>
                      <p style={{ fontFamily: F, fontSize: "0.8rem", color: "var(--adm-text2)", lineHeight: 1.5, margin: 0 }}>{i.body}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "24px 16px", textAlign: "center" }}>
            <p style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text3)" }}>Toca "Generar insights" para que el Genio analice tu data</p>
          </div>
        )}
      </div>
    </div>
  );
}
