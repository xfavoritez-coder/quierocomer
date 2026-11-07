"use client";

import { useState, useEffect } from "react";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import LoyaltyNav from "../LoyaltyNav";
import { TrendingUp, Users, Star, Gift, Award, BarChart2 } from "lucide-react";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

function clpShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
}

interface LoyaltyReport {
  program: { name: string; stampGoal: number; active: boolean; stampIcon: string; rewards: { stamp: number; reward: string }[] };
  members: {
    total: number; newThisMonth: number; newPrevMonth: number; activeThisMonth: number;
    stampsDistribution: { label: string; count: number }[];
  };
  stamps: { totalIssued: number; totalCardsCompleted: number; totalRedemptions: number };
  monthlyGrowth: { month: string; newMembers: number }[];
  recentMembers: { name: string; phone: string; stamps: number; completedCards: number; enrolledAt: string; lastStampAt: string | null }[];
}

function KpiCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px", borderTop: `3px solid ${color}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={14} color={color} />
        </div>
        <span style={{ fontFamily: F, fontSize: "0.65rem", fontWeight: 700, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: ".07em" }}>{label}</span>
      </div>
      <div style={{ fontFamily: F, fontSize: "1.5rem", fontWeight: 900, color: "var(--adm-text)", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function GrowthChart({ data }: { data: { month: string; newMembers: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.newMembers));
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 16 }}>Nuevos miembros — últimos 6 meses</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 120 }}>
        {data.map((d, i) => {
          const pct = d.newMembers > 0 ? Math.max(4, Math.round((d.newMembers / max) * 100)) : 0;
          const isLast = i === data.length - 1;
          return (
            <div key={d.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}>
              <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                <div style={{ position: "relative", width: "70%", height: `${pct}%`, background: isLast ? GOLD : `${GOLD}60`, borderRadius: "4px 4px 0 0", minHeight: d.newMembers > 0 ? 4 : 0 }}>
                  {d.newMembers > 0 && (
                    <span style={{ position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 2, fontFamily: F, fontSize: "0.6rem", fontWeight: 800, color: "var(--adm-text)", whiteSpace: "nowrap" }}>{d.newMembers}</span>
                  )}
                </div>
              </div>
              <span style={{ fontFamily: F, fontSize: "0.6rem", color: "var(--adm-text3)", marginTop: 4, textTransform: "capitalize" }}>{d.month}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StampsDistribution({ distribution, goal, icon }: { distribution: { label: string; count: number }[]; goal: number; icon: string }) {
  const total = distribution.reduce((s, d) => s + d.count, 0);
  const colors = ["var(--adm-text3)", `${GOLD}80`, GOLD, "#16a34a"];
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 16 }}>Distribución por sellos {icon}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {distribution.map((d, i) => {
          const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
          return (
            <div key={d.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)" }}>{d.label}</span>
                <span style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-text)" }}>{d.count} <span style={{ color: "var(--adm-text3)", fontWeight: 400 }}>({pct}%)</span></span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: "var(--adm-card-border)", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: colors[i] || GOLD, borderRadius: 999, transition: "width .3s" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" }).format(new Date(iso));
}

export default function LoyaltyReportesPage() {
  const { selectedRestaurantId } = usePanelSession();
  const [data, setData] = useState<LoyaltyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedRestaurantId) return;
    setLoading(true); setError("");
    fetch(`/api/loyalty/report?restaurantId=${selectedRestaurantId}`)
      .then(r => r.ok ? r.json() : r.json().then((e: any) => Promise.reject(e.error || "Error")))
      .then(d => setData(d))
      .catch(e => setError(typeof e === "string" ? e : "No se pudo cargar el reporte"))
      .finally(() => setLoading(false));
  }, [selectedRestaurantId]);

  return (
    <div style={{ maxWidth: 720 }}>
      <LoyaltyNav />

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-text)", margin: "0 0 4px" }}>Reportes de lealtad</h1>
        <p style={{ fontFamily: FB, fontSize: "0.84rem", color: "var(--adm-text3)", margin: 0 }}>Rendimiento de tu programa de fidelización.</p>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--adm-text3)", fontFamily: FB, fontSize: "0.85rem" }}>Cargando…</div>
      )}

      {error && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "32px", textAlign: "center", color: "var(--adm-text3)", fontFamily: FB, fontSize: "0.85rem" }}>
          {error === "Sin programa" ? "Aún no tienes un programa de lealtad configurado." : error}
        </div>
      )}

      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Estado del programa */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, background: data.program.active ? "#dcfce7" : "var(--adm-card)", border: `1px solid ${data.program.active ? "#16a34a" : "var(--adm-card-border)"}` }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: data.program.active ? "#16a34a" : "var(--adm-text3)" }} />
            <span style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 700, color: data.program.active ? "#16a34a" : "var(--adm-text3)" }}>
              {data.program.active ? "Programa activo" : "Programa inactivo"} · Meta: {data.program.stampGoal} {data.program.stampIcon}
            </span>
          </div>

          {/* KPIs principales */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            <KpiCard icon={Users} label="Total miembros" value={data.members.total}
              sub={data.members.newThisMonth > 0 ? `+${data.members.newThisMonth} este mes` : "Sin nuevos este mes"}
              color={GOLD} />
            <KpiCard icon={TrendingUp} label="Nuevos este mes" value={data.members.newThisMonth}
              sub={data.members.newPrevMonth > 0 ? `${data.members.newPrevMonth} el mes anterior` : undefined}
              color="#3b82f6" />
            <KpiCard icon={Star} label="Activos este mes" value={data.members.activeThisMonth}
              sub={data.members.total > 0 ? `${Math.round(data.members.activeThisMonth / data.members.total * 100)}% del total` : undefined}
              color="#8b5cf6" />
            <KpiCard icon={Award} label="Tarjetas completas" value={data.stamps.totalCardsCompleted}
              sub="Desde el inicio"
              color="#16a34a" />
            <KpiCard icon={Gift} label="Premios canjeados" value={data.stamps.totalRedemptions}
              sub="Total histórico"
              color="#ef4444" />
            <KpiCard icon={BarChart2} label="Sellos entregados" value={clpShort(data.stamps.totalIssued)}
              sub="Total histórico"
              color="#f59e0b" />
          </div>

          {/* Gráfico de crecimiento */}
          <GrowthChart data={data.monthlyGrowth} />

          {/* Distribución por sellos */}
          <StampsDistribution distribution={data.members.stampsDistribution} goal={data.program.stampGoal} icon={data.program.stampIcon} />

          {/* Recompensas configuradas */}
          {data.program.rewards?.length > 0 && (
            <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "18px 20px" }}>
              <div style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 14 }}>Recompensas</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.program.rewards.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--adm-bg)", borderRadius: 10, border: "1px solid var(--adm-card-border)" }}>
                    <span style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 800, color: GOLD, background: `${GOLD}18`, borderRadius: 8, padding: "3px 10px", whiteSpace: "nowrap" }}>
                      {r.stamp} {data.program.stampIcon}
                    </span>
                    <span style={{ fontFamily: FB, fontSize: "0.84rem", color: "var(--adm-text)" }}>{r.reward}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Últimos inscritos */}
          {data.recentMembers.length > 0 && (
            <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "18px 20px" }}>
              <div style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 14 }}>Últimos inscritos</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 8, padding: "0 6px 8px", borderBottom: "1px solid var(--adm-card-border)" }}>
                  {["Nombre", "Sellos", "Completas", "Inscripción"].map(h => (
                    <span key={h} style={{ fontFamily: F, fontSize: "0.6rem", fontWeight: 700, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: ".06em", textAlign: h !== "Nombre" ? "right" : "left" }}>{h}</span>
                  ))}
                </div>
                {data.recentMembers.map((m, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 8, padding: "8px 6px", borderRadius: 8, background: i % 2 === 0 ? "transparent" : "var(--adm-bg)" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 600, color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
                      {m.phone && <div style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)" }}>{m.phone}</div>}
                    </div>
                    <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: GOLD, textAlign: "right", alignSelf: "center" }}>{m.stamps} {data.program.stampIcon}</span>
                    <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: m.completedCards > 0 ? "#16a34a" : "var(--adm-text3)", textAlign: "right", alignSelf: "center" }}>{m.completedCards}</span>
                    <span style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", textAlign: "right", alignSelf: "center", whiteSpace: "nowrap" }}>{fmtDate(m.enrolledAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
