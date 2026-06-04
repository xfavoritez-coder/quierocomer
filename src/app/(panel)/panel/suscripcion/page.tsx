"use client";
import { useEffect, useState, useContext } from "react";
import { CreditCard, Shield, Receipt, XCircle, ExternalLink, Lock, Check } from "lucide-react";
import { SessionContext } from "@/lib/admin/SessionContext";
import { toast } from "sonner";
import { PLANS, PLAN_ORDER, planNetAmount, ivaOf, grossOf, type PlanKey, PLAN_LABELS } from "@/lib/billing/plans-config";

type BillingStatus = {
  restaurantId: string;
  plan: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  lastPaymentAt: string | null;
  hasSubscription: boolean;
  activeFlowPlan: string | null;
  billingExempt: boolean;
  customPlanPriceNet?: number | null;
  ivaRate?: number;
  billingInfo?: { isComplete: boolean; missingFields: string[] };
};

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";
const PREMIUM_COLOR = "#7c3aed";
const PREMIUM_LIGHT = "#c4b5fd";

function formatCLP(amount: number) { return `$${amount.toLocaleString("es-CL")}`; }
function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

// All features for the grid — ordered from basic to premium
const ALL_FEATURES: { text: string; minPlan: PlanKey }[] = [
  { text: "Carta QR profesional", minPlan: "FREE" },
  { text: "Genio IA", minPlan: "FREE" },
  { text: "Panel autoadministrable", minPlan: "FREE" },
  { text: "3 vistas de carta", minPlan: "SILVER" },
  { text: "Destacar platos", minPlan: "SILVER" },
  { text: "Ofertas y promociones", minPlan: "SILVER" },
  { text: "Dark / Light mode", minPlan: "GOLD" },
  { text: "Diseño personalizado", minPlan: "GOLD" },
  { text: "Estadísticas", minPlan: "GOLD" },
  { text: "Multilenguaje", minPlan: "GOLD" },
  { text: "Llamar al garzón", minPlan: "PREMIUM" },
  { text: "Clientes y cumpleaños", minPlan: "PREMIUM" },
];

const PLAN_RANK: Record<string, number> = { FREE: 0, SILVER: 1, GOLD: 2, PREMIUM: 3 };

// Upsell messages per plan
const UPSELL: Record<string, { stat: string; hint: string; cta: string; price: string }> = {
  FREE: { stat: "", hint: "Con Silver puedes destacar platos estrella y crear ofertas.", cta: "Activar Silver", price: formatCLP(PLANS.SILVER.priceMonthly) },
  SILVER: { stat: "", hint: "Con Gold puedes ver estadísticas, personalizar colores y traducir tu carta.", cta: "Subir a Gold", price: formatCLP(PLANS.GOLD.priceMonthly) },
  GOLD: { stat: "", hint: "Con Premium capturas clientes, envías campañas y automatizas cumpleaños.", cta: "Subir a Premium", price: formatCLP(PLANS.PREMIUM.priceMonthly) },
};

export default function SuscripcionPage() {
  const ctx = useContext(SessionContext);
  const selectedRestaurantId = ctx?.selectedRestaurantId || null;
  const selectedRest = ctx?.restaurants?.find((r: any) => r.id === selectedRestaurantId) as any;
  const isDemo = !!selectedRest?.isDemo;
  const slug = selectedRest?.slug || "";

  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(false);
  const [sessions, setSessions] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    setLoading(true);
    fetch(`/api/billing/status?restaurantId=${selectedRestaurantId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setStatus(d); if (d?.sessions30d !== undefined) setSessions(d.sessions30d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedRestaurantId]);

  const handleUpgrade = (tab?: string) => {
    window.dispatchEvent(new CustomEvent("show-plan-modal", { detail: tab ? { initialTab: tab } : undefined }));
  };

  const handleCancel = async () => {
    if (!status?.restaurantId || actioning) return;
    if (!window.confirm("¿Seguro que quieres cancelar tu suscripción? Mantendrás acceso hasta el final del periodo pagado.")) return;
    setActioning(true);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: status.restaurantId, atPeriodEnd: true }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "No se pudo cancelar"); setActioning(false); return; }
      toast.success("Suscripción cancelada. Mantienes acceso hasta el final del periodo.");
      setTimeout(() => window.location.reload(), 1200);
    } catch { toast.error("Error de conexión"); setActioning(false); }
  };

  if (loading) return <div style={{ padding: 32, fontFamily: FB, color: "var(--adm-text3)" }}>Cargando…</div>;

  /* ─── DEMO MODE ─── */
  if (isDemo) {
    const promoPrice = 4900;
    const premiumGross = grossOf(planNetAmount("PREMIUM"));
    return (
      <div style={{ padding: "24px 16px", maxWidth: 720, margin: "0 auto", fontFamily: FB }}>
        <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 8 }}>
          <CreditCard size={20} color="var(--adm-text3)" /> Mi suscripción
        </h1>
        <p style={{ fontSize: "0.92rem", color: "var(--adm-text2)", margin: "0 0 24px" }}>Estado de tu plan y activación</p>

        <div style={{ background: "var(--adm-card)", border: "1px solid rgba(124,58,237,.25)", borderRadius: 22, padding: "24px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: "0.7rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700 }}>PLAN ACTUAL</p>
              <p style={{ fontFamily: F, fontSize: "1.8rem", fontWeight: 800, color: PREMIUM_LIGHT, margin: "6px 0 4px" }}>Premium Demo</p>
              <p style={{ fontSize: "0.85rem", color: "var(--adm-text2)", margin: 0 }}>Activa para publicar tu carta.</p>
            </div>
            <span style={{ fontSize: "0.72rem", fontWeight: 800, padding: "6px 14px", borderRadius: 999, background: "rgba(124,58,237,.15)", color: PREMIUM_LIGHT, border: "1px solid rgba(124,58,237,.3)" }}>DEMO</span>
          </div>

          <div style={{ background: `linear-gradient(135deg, rgba(124,58,237,.12), rgba(124,58,237,.04))`, border: "1px solid rgba(124,58,237,.2)", borderRadius: 16, padding: "20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontFamily: F, fontSize: "2.2rem", fontWeight: 900, color: "white" }}>{formatCLP(promoPrice)}</span>
                <span style={{ fontSize: "0.85rem", color: "var(--adm-text3)", textDecoration: "line-through" }}>{formatCLP(premiumGross)}</span>
              </div>
              <p style={{ fontSize: "0.78rem", color: "var(--adm-text3)", margin: "4px 0 0" }}>Después {formatCLP(premiumGross)}/mes · Cancela cuando quieras</p>
            </div>
            <span style={{ background: PREMIUM_COLOR, color: "white", fontSize: "0.7rem", fontWeight: 900, padding: "4px 12px", borderRadius: 999, flexShrink: 0 }}>90% OFF</span>
          </div>

          <a href={`/activar/${slug}`} style={{
            display: "block", textAlign: "center", padding: "14px 20px",
            background: `linear-gradient(135deg, ${PREMIUM_COLOR}, #9333ea)`, color: "white",
            borderRadius: 999, fontFamily: F, fontSize: "0.95rem", fontWeight: 800,
            textDecoration: "none", boxShadow: "0 4px 20px rgba(124,58,237,.35)",
          }}>
            Activar mi carta por {formatCLP(promoPrice)} →
          </a>
        </div>
      </div>
    );
  }

  /* ─── NORMAL MODE ─── */
  if (!status) return <div style={{ padding: 32, fontFamily: FB, color: "var(--adm-text3)" }}>No se pudo cargar la información.</div>;

  const plan = (status.plan || "FREE") as PlanKey;
  const isExempt = status.billingExempt;
  const isFree = plan === "FREE";
  const hasActiveSub = status.hasSubscription && ["TRIALING", "ACTIVE", "PAST_DUE"].includes(status.subscriptionStatus);
  const isCanceled = status.subscriptionStatus === "CANCELED";
  const inTrial = status.subscriptionStatus === "TRIALING";
  const monthlyNet = status.customPlanPriceNet ?? planNetAmount(plan);
  const monthlyGross = grossOf(monthlyNet);
  const planRank = PLAN_RANK[plan] ?? 0;
  const upsell = UPSELL[plan];
  const nextPlan = plan === "FREE" ? "SILVER" : plan === "SILVER" ? "GOLD" : plan === "GOLD" ? "PREMIUM" : null;
  const planColor = plan === "PREMIUM" ? PREMIUM_LIGHT : plan === "GOLD" ? GOLD : plan === "SILVER" ? "#94a3b8" : "#4ade80";
  const statusLabel = isExempt ? "Bonificado" : inTrial ? "Prueba gratis" : hasActiveSub ? "Activo" : isCanceled ? "Cancelado" : isFree ? "Gratis" : "Sin suscripción";
  const statusColor = isExempt || hasActiveSub || inTrial ? "#4ade80" : isCanceled ? "#fbbf24" : isFree ? "#4ade80" : "var(--adm-text3)";

  return (
    <div style={{ padding: "24px 16px", maxWidth: 720, margin: "0 auto", fontFamily: FB }}>
      <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 8 }}>
        <CreditCard size={20} color="var(--adm-text3)" /> Mi suscripción
      </h1>
      <p style={{ fontSize: "0.92rem", color: "var(--adm-text2)", margin: "0 0 24px" }}>Estado de tu plan, pagos y opciones</p>

      {/* ═══ Main plan card ═══ */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 22, padding: "24px 20px", marginBottom: 16 }}>

        {/* Plan header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: "0.7rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700 }}>PLAN ACTUAL</p>
            <p style={{ fontFamily: F, fontSize: "1.8rem", fontWeight: 800, color: planColor, margin: "6px 0 4px" }}>
              {PLAN_LABELS[plan] || "Gratis"}{inTrial ? " (prueba)" : ""}
            </p>
            <p style={{ fontSize: "0.85rem", color: "var(--adm-text2)", margin: 0 }}>
              {isExempt ? "Plan bonificado por QuieroComer." : isFree ? "Tu carta QR ya está funcionando." : hasActiveSub ? `Activo hasta el ${formatDate(status.currentPeriodEnd)}.` : inTrial && status.trialEndsAt ? `Prueba gratis hasta el ${formatDate(status.trialEndsAt)}.` : "Tu carta sigue activa."}
            </p>
          </div>
          <span style={{
            fontSize: "0.72rem", fontWeight: 800, padding: "6px 14px", borderRadius: 999,
            background: `${statusColor}18`, color: statusColor,
          }}>
            {statusLabel}
          </span>
        </div>

        {/* Trial warning */}
        {inTrial && status.trialEndsAt && !isExempt && (
          <div style={{ background: "rgba(168,85,247,.06)", border: "1px solid rgba(168,85,247,.2)", borderRadius: 14, padding: "14px", marginBottom: 16 }}>
            <p style={{ fontSize: "0.85rem", color: "#a855f7", margin: 0, lineHeight: 1.5 }}>
              🎁 Estás disfrutando Premium gratis. Al terminar, tu carta sigue activa en plan Gratis sin cobros.
            </p>
          </div>
        )}

        {/* Past due warning */}
        {status.subscriptionStatus === "PAST_DUE" && (
          <div style={{ background: "rgba(248,113,113,.06)", border: "1px solid rgba(248,113,113,.2)", borderRadius: 14, padding: "14px", marginBottom: 16 }}>
            <p style={{ fontSize: "0.85rem", color: "#f87171", margin: 0, fontWeight: 700 }}>Hay un problema con tu tarjeta. Estamos reintentando el cobro.</p>
          </div>
        )}

        {/* Canceled warning */}
        {isCanceled && status.currentPeriodEnd && (
          <div style={{ background: "rgba(251,191,36,.06)", border: "1px solid rgba(251,191,36,.2)", borderRadius: 14, padding: "14px", marginBottom: 16 }}>
            <p style={{ fontSize: "0.85rem", color: "#fbbf24", margin: 0 }}>Cancelada. Mantienes acceso hasta el {formatDate(status.currentPeriodEnd)}.</p>
          </div>
        )}

        {/* Stats box — only if there are sessions */}
        {sessions !== null && sessions > 0 && upsell && (
          <div style={{
            background: `${GOLD}0C`, border: `1px solid ${GOLD}25`,
            borderRadius: 14, padding: "16px 18px", marginBottom: 16,
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap",
          }}>
            <div>
              <span style={{ fontFamily: F, fontSize: "2rem", fontWeight: 900, color: GOLD }}>{sessions}</span>
              <span style={{ fontSize: "0.82rem", color: "var(--adm-text3)", marginLeft: 8 }}>visitas este mes</span>
            </div>
            <p style={{ fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0 }}>{upsell.hint}</p>
          </div>
        )}

        {/* Features grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8, marginBottom: 16 }}>
          {ALL_FEATURES.map(f => {
            const has = planRank >= (PLAN_RANK[f.minPlan] ?? 0);
            return (
              <div key={f.text} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
                background: has ? "rgba(255,255,255,.03)" : `${GOLD}06`,
                border: `1px solid ${has ? "var(--adm-card-border)" : `${GOLD}15`}`,
                borderRadius: 12,
              }}>
                {has ? (
                  <Check size={14} color="#4ade80" strokeWidth={3} style={{ flexShrink: 0 }} />
                ) : (
                  <Lock size={13} color={GOLD} style={{ flexShrink: 0, opacity: 0.6 }} />
                )}
                <span style={{
                  fontSize: "0.78rem", fontWeight: 700,
                  color: has ? "var(--adm-text)" : "var(--adm-text3)",
                }}>{f.text}</span>
              </div>
            );
          })}
        </div>

        {/* Upgrade box */}
        {!isExempt && nextPlan && upsell && (
          <div style={{
            background: "rgba(255,255,255,.04)", border: "1px solid var(--adm-card-border)",
            borderRadius: 16, padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap",
          }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ fontFamily: F, fontSize: "1rem", fontWeight: 800, color: "var(--adm-text)", margin: "0 0 4px" }}>
                Haz que tu carta trabaje por ti
              </p>
              <p style={{ fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
                {upsell.hint}
              </p>
            </div>
            <button onClick={() => handleUpgrade(nextPlan)} style={{
              padding: "13px 24px", borderRadius: 999, border: "none", cursor: "pointer",
              background: `linear-gradient(135deg, #ffc44f, ${GOLD})`, color: "#100b03",
              fontFamily: F, fontSize: "0.88rem", fontWeight: 800, whiteSpace: "nowrap",
              boxShadow: "0 4px 14px rgba(244,166,35,.2)",
            }}>
              {upsell.cta} desde {upsell.price}
            </button>
          </div>
        )}

        {/* Active sub: change plan / cancel */}
        {hasActiveSub && !isExempt && (
          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => handleUpgrade()} style={{
              padding: "10px 20px", borderRadius: 999, cursor: "pointer",
              background: "rgba(255,255,255,.05)", color: "var(--adm-text)",
              border: "1px solid var(--adm-card-border)", fontFamily: F, fontSize: "0.82rem", fontWeight: 600,
            }}>
              Cambiar plan
            </button>
          </div>
        )}

        {/* Canceled: reactivate */}
        {isCanceled && !isExempt && (
          <button onClick={() => handleUpgrade()} style={{
            marginTop: 16, padding: "13px 24px", borderRadius: 999, border: "none", cursor: "pointer",
            background: `linear-gradient(135deg, #ffc44f, ${GOLD})`, color: "#100b03",
            fontFamily: F, fontSize: "0.88rem", fontWeight: 800,
          }}>
            Reactivar suscripción
          </button>
        )}
      </div>

      {/* ═══ Payment details ═══ */}
      {(hasActiveSub || status.lastPaymentAt) && !isExempt && (
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 22, padding: "24px 20px", marginBottom: 16 }}>
          <h2 style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 800, color: "var(--adm-text3)", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: ".6px", display: "flex", alignItems: "center", gap: 8 }}>
            <Receipt size={14} /> Pagos
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {hasActiveSub && (
              <>
                <div>
                  <p style={{ fontSize: "0.7rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em" }}>Cobro mensual</p>
                  <p style={{ fontSize: "0.92rem", color: "var(--adm-text)", margin: "2px 0 0", fontWeight: 600 }}>{formatCLP(monthlyGross)}</p>
                  <p style={{ fontSize: "0.68rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>{formatCLP(monthlyNet)} + IVA</p>
                </div>
                <div>
                  <p style={{ fontSize: "0.7rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em" }}>Pasarela</p>
                  <p style={{ fontSize: "0.92rem", color: "var(--adm-text)", margin: "2px 0 0", fontWeight: 600 }}>MercadoPago</p>
                </div>
              </>
            )}
            {status.lastPaymentAt && (
              <div>
                <p style={{ fontSize: "0.7rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em" }}>Último pago</p>
                <p style={{ fontSize: "0.92rem", color: "var(--adm-text)", margin: "2px 0 0", fontWeight: 600 }}>{formatDate(status.lastPaymentAt)}</p>
              </div>
            )}
            {status.currentPeriodEnd && (
              <div>
                <p style={{ fontSize: "0.7rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em" }}>Periodo termina</p>
                <p style={{ fontSize: "0.92rem", color: "var(--adm-text)", margin: "2px 0 0", fontWeight: 600 }}>{formatDate(status.currentPeriodEnd)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Cancel ═══ */}
      {!isExempt && hasActiveSub && (
        <div style={{ background: "var(--adm-card)", border: "1px solid rgba(248,113,113,.15)", borderRadius: 22, padding: "24px 20px" }}>
          <p style={{ fontSize: "0.84rem", color: "var(--adm-text2)", margin: "0 0 14px", lineHeight: 1.6 }}>
            Si cancelas, mantienes acceso hasta el final del periodo pagado. Tu carta sigue funcionando en plan Gratis.
          </p>
          <button onClick={handleCancel} disabled={actioning} style={{
            padding: "10px 18px", background: "transparent", color: "#f87171",
            border: "1px solid rgba(248,113,113,.3)", borderRadius: 999,
            fontFamily: F, fontSize: "0.82rem", fontWeight: 600,
            cursor: actioning ? "wait" : "pointer",
          }}>
            {actioning ? "Cancelando…" : "Cancelar mi plan"}
          </button>
        </div>
      )}
    </div>
  );
}
