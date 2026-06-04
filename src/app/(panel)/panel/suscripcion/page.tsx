"use client";
import { useEffect, useState, useContext } from "react";
import { CreditCard, Sparkles, Shield, Receipt, XCircle, ExternalLink, Lock, Check } from "lucide-react";
import { SessionContext } from "@/lib/admin/SessionContext";
import { toast } from "sonner";
import { PLANS, PLAN_ORDER, planNetAmount, ivaOf, grossOf, type PlanKey, PLAN_LABELS } from "@/lib/billing/plans-config";
import FacturacionPage from "@/components/admin/pages/facturacionPage";

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
  sessions30d?: number;
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

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  NONE:      { label: "Sin plan activo",       color: "var(--adm-text3)",     bg: "rgba(128,128,128,.1)" },
  TRIALING:  { label: "Activo",                color: "#4ade80", bg: "rgba(74,222,128,.12)" },
  ACTIVE:    { label: "Activa",                color: "#4ade80", bg: "rgba(74,222,128,.12)" },
  PAST_DUE:  { label: "Pago atrasado",         color: "#f87171", bg: "rgba(248,113,113,.12)" },
  CANCELED:  { label: "Cancelada",             color: "#fbbf24", bg: "rgba(251,191,36,.12)" },
  UNPAID:    { label: "Sin pago",              color: "#f87171", bg: "rgba(248,113,113,.12)" },
};

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 22, padding: "24px 20px", marginBottom: 16, ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 800, color: "var(--adm-text3)", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", letterSpacing: ".6px" }}>
      {icon} {children}
    </h2>
  );
}

// Features grid for FREE / low-plan upsell
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
const UPSELL: Record<string, { hint: string; cta: string; nextPlan: PlanKey; price: string }> = {
  FREE: { hint: "Con Silver puedes destacar platos estrella y crear ofertas.", cta: "Activar Silver", nextPlan: "SILVER", price: formatCLP(PLANS.SILVER.priceMonthly) },
  SILVER: { hint: "Con Gold puedes ver estadísticas, personalizar colores y traducir tu carta.", cta: "Subir a Gold", nextPlan: "GOLD", price: formatCLP(PLANS.GOLD.priceMonthly) },
  GOLD: { hint: "Con Premium capturas clientes, envías campañas y automatizas cumpleaños.", cta: "Subir a Premium", nextPlan: "PREMIUM", price: formatCLP(PLANS.PREMIUM.priceMonthly) },
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

  useEffect(() => {
    if (!selectedRestaurantId) return;
    setLoading(true);
    fetch(`/api/billing/status?restaurantId=${selectedRestaurantId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setStatus(d); setLoading(false); })
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

  /* ═══ DEMO MODE ═══ */
  if (isDemo) {
    const premiumNet = planNetAmount("PREMIUM");
    const premiumGross = premiumNet + ivaOf(premiumNet);
    const promoPrice = 4900;

    return (
      <div style={{ padding: "24px 16px", maxWidth: 720, margin: "0 auto", fontFamily: FB }}>
        <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 8 }}>
          <CreditCard size={20} color="var(--adm-text3)" /> Mi suscripción
        </h1>
        <p style={{ fontSize: "0.92rem", color: "var(--adm-text2)", margin: "0 0 24px" }}>Estado de tu plan y activación</p>
        <Card style={{ background: `linear-gradient(145deg, rgba(124,58,237,.08) 0%, rgba(124,58,237,.02) 100%)`, border: `1px solid rgba(124,58,237,.25)` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: "0.72rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em" }}>Tu plan actual</p>
              <p style={{ fontFamily: F, fontSize: "2rem", fontWeight: 700, color: PREMIUM_LIGHT, margin: "2px 0 0" }}>Premium</p>
            </div>
            <span style={{ fontSize: "0.72rem", fontWeight: 800, padding: "6px 14px", borderRadius: 999, background: "rgba(124,58,237,.15)", color: PREMIUM_LIGHT, letterSpacing: ".5px", border: "1px solid rgba(124,58,237,.3)" }}>DEMO</span>
          </div>
          <div style={{ background: "rgba(124,58,237,.06)", border: "1px solid rgba(124,58,237,.15)", borderRadius: 14, padding: "16px 14px", marginBottom: 20 }}>
            <p style={{ fontSize: "0.88rem", color: "var(--adm-text)", margin: 0, lineHeight: 1.5 }}>Estás en <strong style={{ color: PREMIUM_LIGHT }}>Premium demo</strong> — activa para publicar tu carta.</p>
          </div>
          <div style={{ background: `linear-gradient(135deg, rgba(124,58,237,.12) 0%, rgba(147,51,234,.06) 100%)`, border: "1px solid rgba(124,58,237,.2)", borderRadius: 16, padding: "22px 20px", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ fontSize: "0.78rem", color: PREMIUM_LIGHT, margin: 0, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>Primer mes</p>
              <span style={{ background: PREMIUM_COLOR, color: "white", fontSize: "0.7rem", fontWeight: 900, padding: "3px 10px", borderRadius: 999 }}>90% OFF</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontFamily: F, fontSize: "2.6rem", fontWeight: 900, color: "white", letterSpacing: "-1px" }}>{formatCLP(promoPrice)}</span>
              <span style={{ fontSize: "0.88rem", color: "var(--adm-text3)", textDecoration: "line-through" }}>{formatCLP(premiumGross)}</span>
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--adm-text3)", margin: "8px 0 0" }}>Después {formatCLP(premiumGross)}/mes · Cancela cuando quieras</p>
          </div>
          <a href={`/activar/${slug}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "14px 20px", background: `linear-gradient(135deg, ${PREMIUM_COLOR}, #9333ea)`, color: "white", border: "none", borderRadius: 999, fontFamily: F, fontSize: "0.95rem", fontWeight: 800, textDecoration: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(124,58,237,.35)" }}>
            Activar mi carta por {formatCLP(promoPrice)} →
          </a>
        </Card>
        <Card style={{ background: "rgba(124,58,237,.04)", border: "1px solid rgba(124,58,237,.12)" }}>
          <h2 style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 800, color: "var(--adm-text3)", margin: "0 0 20px", textTransform: "uppercase", letterSpacing: ".6px" }}>Al activar</h2>
          <div style={{ display: "grid", gap: 14 }}>
            {[
              { icon: "📱", title: "Se publica tu carta", desc: "Tus clientes la ven al escanear el QR" },
              { icon: "📩", title: "Recibes tu QR por correo", desc: "En alta calidad para imprimir y poner en mesas" },
              { icon: "📊", title: "Empiezas a medir resultados", desc: "Visitas, platos más vistos y sesiones en vivo" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: "1.1rem", width: 34, height: 34, borderRadius: 10, background: "rgba(124,58,237,.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <p style={{ fontSize: "0.95rem", color: "var(--adm-text)", margin: 0, fontWeight: 700 }}>{item.title}</p>
                  <p style={{ fontSize: "0.84rem", color: "rgba(255,255,255,.38)", margin: "3px 0 0" }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  /* ═══ NORMAL MODE ═══ */
  if (!status) return <div style={{ padding: 32, fontFamily: FB, color: "var(--adm-text3)" }}>No se pudo cargar la información.</div>;

  const statusInfo = STATUS_LABEL[status.subscriptionStatus] || STATUS_LABEL.NONE;
  const isExempt = status.billingExempt;
  const plan = (status.plan || "FREE") as PlanKey;
  const isFree = plan === "FREE";
  const hasActiveSub = status.hasSubscription && ["TRIALING", "ACTIVE", "PAST_DUE"].includes(status.subscriptionStatus);
  const isCanceled = status.subscriptionStatus === "CANCELED";
  const inTrial = status.subscriptionStatus === "TRIALING";
  const monthlyNet = status.customPlanPriceNet ?? planNetAmount(plan);
  const monthlyIva = ivaOf(monthlyNet);
  const monthlyGross = monthlyNet + monthlyIva;
  const billingComplete = status.billingInfo?.isComplete !== false;
  const planRank = PLAN_RANK[plan] ?? 0;
  const upsell = UPSELL[plan];
  const sessions30d = status.sessions30d ?? 0;

  // Use the new card design for FREE and plans without active subscription (not trial/active/exempt)
  const useNewDesign = !isExempt && !hasActiveSub && !inTrial && !isCanceled;

  if (useNewDesign) {
    return (
      <div style={{ padding: "24px 16px", maxWidth: 720, margin: "0 auto", fontFamily: FB }}>
        <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 8 }}>
          <CreditCard size={20} color="var(--adm-text3)" /> Mi suscripción
        </h1>
        <p style={{ fontSize: "0.92rem", color: "var(--adm-text2)", margin: "0 0 24px" }}>Estado de tu plan, pagos y opciones</p>

        <Card>
          {/* Plan header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: "0.7rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700 }}>PLAN ACTUAL</p>
              <p style={{ fontFamily: F, fontSize: "1.8rem", fontWeight: 800, color: "var(--adm-text)", margin: "6px 0 4px" }}>
                {PLAN_LABELS[plan] || "Gratis"}
              </p>
              <p style={{ fontSize: "0.85rem", color: "var(--adm-text2)", margin: 0 }}>Tu carta QR ya está funcionando.</p>
            </div>
            <span style={{ fontSize: "0.72rem", fontWeight: 800, padding: "6px 14px", borderRadius: 999, background: statusInfo.bg, color: statusInfo.color }}>
              {isFree ? "Gratis" : statusInfo.label}
            </span>
          </div>

          {/* Stats box */}
          {sessions30d > 0 && upsell && (
            <div style={{ background: `${GOLD}0C`, border: `1px solid ${GOLD}25`, borderRadius: 14, padding: "16px 18px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div>
                <span style={{ fontFamily: F, fontSize: "2rem", fontWeight: 900, color: GOLD }}>{sessions30d}</span>
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
                <div key={f.text} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: has ? "rgba(255,255,255,.03)" : `${GOLD}06`, border: `1px solid ${has ? "var(--adm-card-border)" : `${GOLD}15`}`, borderRadius: 12 }}>
                  {has ? <Check size={14} color="#4ade80" strokeWidth={3} style={{ flexShrink: 0 }} /> : <Lock size={13} color={GOLD} style={{ flexShrink: 0, opacity: 0.6 }} />}
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: has ? "var(--adm-text)" : "var(--adm-text3)" }}>{f.text}</span>
                </div>
              );
            })}
          </div>

          {/* Upgrade box */}
          {upsell && (
            <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ fontFamily: F, fontSize: "1rem", fontWeight: 800, color: "var(--adm-text)", margin: "0 0 4px" }}>Haz que tu carta trabaje por ti</p>
                <p style={{ fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>{upsell.hint}</p>
              </div>
              <button onClick={() => handleUpgrade(upsell.nextPlan)} style={{ padding: "13px 24px", borderRadius: 999, border: "none", cursor: "pointer", background: `linear-gradient(135deg, #ffc44f, ${GOLD})`, color: "#100b03", fontFamily: F, fontSize: "0.88rem", fontWeight: 800, whiteSpace: "nowrap", boxShadow: "0 4px 14px rgba(244,166,35,.2)" }}>
                {upsell.cta} desde {upsell.price}
              </button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  /* ═══ EXISTING DESIGN — trial, active, exempt, canceled ═══ */
  return (
    <div style={{ padding: "24px 16px", maxWidth: 720, margin: "0 auto", fontFamily: FB }}>
      <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 8 }}>
        <CreditCard size={20} color="var(--adm-text3)" /> Mi suscripción
      </h1>
      <p style={{ fontSize: "0.92rem", color: "var(--adm-text2)", margin: "0 0 24px" }}>Estado de tu plan, pagos y opciones</p>

      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: "0.72rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em" }}>Plan actual</p>
            <p style={{ fontFamily: F, fontSize: "2rem", fontWeight: 700, color: "var(--adm-text)", margin: "2px 0 0" }}>
              {PLAN_LABELS[plan] || "Gratis"}
            </p>
          </div>
          <span style={{ fontSize: "0.72rem", fontWeight: 800, padding: "6px 14px", borderRadius: 999, background: statusInfo.bg, color: statusInfo.color }}>
            {isExempt ? "Bonificado" : statusInfo.label}
          </span>
        </div>

        {isExempt && (
          <div style={{ background: "rgba(74,222,128,.06)", border: "1px solid rgba(74,222,128,.15)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
            <p style={{ fontSize: "0.85rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
              Tu plan está <strong style={{ color: "var(--adm-text)" }}>bonificado por QuieroComer</strong>. No se te cobrará. Disfrutas de las funciones del plan {PLAN_LABELS[plan] || plan} sin costo.
            </p>
          </div>
        )}

        {!isExempt && inTrial && status.trialEndsAt && (
          <div style={{ background: "rgba(168,85,247,.06)", border: "1px solid rgba(168,85,247,.2)", borderRadius: 12, padding: "14px", marginBottom: 16 }}>
            <p style={{ fontSize: "0.9rem", color: "#a855f7", margin: "0 0 4px", fontWeight: 700 }}>
              🎁 Tienes Premium gratis hasta el {formatDate(status.trialEndsAt)}
            </p>
            <p style={{ fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
              Tu plan base es <strong style={{ color: "var(--adm-text)" }}>Gratis</strong>. Estás disfrutando todas las funciones Premium como regalo. Al terminar, tu carta sigue activa en el plan Gratis sin cobros.
            </p>
          </div>
        )}

        {!isExempt && status.subscriptionStatus === "ACTIVE" && status.currentPeriodEnd && (
          <div style={{ background: "rgba(56,189,248,.06)", border: "1px solid rgba(56,189,248,.15)", borderRadius: 12, padding: "14px", marginBottom: 16 }}>
            <p style={{ fontSize: "0.85rem", color: "var(--adm-text2)", margin: 0 }}>
              Plan activo hasta el <strong style={{ color: "var(--adm-text)" }}>{formatDate(status.currentPeriodEnd)}</strong>
            </p>
          </div>
        )}

        {!isExempt && !billingComplete && status.hasSubscription && (
          <div style={{ background: "rgba(251,191,36,.06)", border: "1px solid rgba(251,191,36,.2)", borderRadius: 12, padding: "14px", marginBottom: 16 }}>
            <p style={{ fontSize: "0.9rem", color: "#fbbf24", margin: "0 0 4px", fontWeight: 700 }}>Completa tus datos de facturación</p>
            <p style={{ fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>Necesitamos tu razón social, RUT y giro para emitir la factura electrónica con IVA cada mes.</p>
          </div>
        )}

        {!isExempt && status.subscriptionStatus === "PAST_DUE" && (
          <div style={{ background: "rgba(248,113,113,.06)", border: "1px solid rgba(248,113,113,.2)", borderRadius: 12, padding: "14px", marginBottom: 16 }}>
            <p style={{ fontSize: "0.9rem", color: "#f87171", margin: "0 0 4px", fontWeight: 700 }}>Hay un problema con tu tarjeta</p>
            <p style={{ fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0 }}>No pudimos cobrar el último mes. Estamos reintentando.</p>
          </div>
        )}

        {!isExempt && isCanceled && status.currentPeriodEnd && (
          <div style={{ background: "rgba(251,191,36,.06)", border: "1px solid rgba(251,191,36,.2)", borderRadius: 12, padding: "14px", marginBottom: 16 }}>
            <p style={{ fontSize: "0.9rem", color: "#fbbf24", margin: "0 0 4px", fontWeight: 700 }}>Plan cancelado</p>
            <p style={{ fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0 }}>Mantienes acceso hasta el {formatDate(status.currentPeriodEnd)}.</p>
          </div>
        )}

        {/* Detalles grid */}
        <div style={{ borderTop: "1px solid var(--adm-card-border)", paddingTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
          {status.hasSubscription && (
            <>
              <div>
                <p style={{ fontSize: "0.7rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em" }}>Cobro mensual</p>
                <p style={{ fontSize: "0.92rem", color: "var(--adm-text)", margin: "2px 0 0", fontWeight: 600 }}>{monthlyNet > 0 ? formatCLP(monthlyGross) : isExempt ? "Sin costo" : "—"}</p>
                {monthlyNet > 0 && <p style={{ fontSize: "0.68rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>{formatCLP(monthlyNet)} neto + {formatCLP(monthlyIva)} IVA</p>}
              </div>
              <div>
                <p style={{ fontSize: "0.7rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em" }}>Pasarela</p>
                <p style={{ fontSize: "0.92rem", color: "var(--adm-text)", margin: "2px 0 0", fontWeight: 600 }}>MercadoPago</p>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div style={{ borderTop: "1px solid var(--adm-card-border)", paddingTop: 16, marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {!isExempt && (
            <button onClick={() => handleUpgrade()} style={{
              flex: 1, minWidth: 200, padding: "13px 18px",
              background: `linear-gradient(135deg, #ffc44f, ${GOLD})`, color: "#100b03",
              border: "none", borderRadius: 999, fontFamily: F, fontSize: "0.88rem", fontWeight: 800, cursor: "pointer",
            }}>
              {inTrial || isFree ? "Ver planes" : hasActiveSub ? "Cambiar plan" : isCanceled ? "Reactivar suscripción" : "Ver planes"}
            </button>
          )}
        </div>
      </Card>

      {/* Método de pago */}
      {hasActiveSub && (
        <Card>
          <SectionTitle icon={<Shield size={14} />}>Método de pago</SectionTitle>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 30, borderRadius: 6, background: "rgba(255,255,255,.06)", border: "1px solid var(--adm-card-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CreditCard size={18} color="var(--adm-text3)" />
              </div>
              <div>
                <p style={{ fontSize: "0.88rem", color: "var(--adm-text)", margin: 0, fontWeight: 600 }}>Tarjeta vía Webpay</p>
                <p style={{ fontSize: "0.76rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>Registrada en Flow.cl</p>
              </div>
            </div>
            <a href="https://www.flow.cl/app/web/misDatos.php" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.78rem", color: GOLD, textDecoration: "none", fontWeight: 600 }}>
              Gestionar <ExternalLink size={12} />
            </a>
          </div>
        </Card>
      )}

      {/* Historial de pagos */}
      {status.lastPaymentAt && (
        <Card>
          <SectionTitle icon={<Receipt size={14} />}>Historial de pagos</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "8px 16px", fontSize: "0.82rem" }}>
            <span style={{ color: "var(--adm-text3)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: ".04em" }}>Fecha</span>
            <span style={{ color: "var(--adm-text3)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: ".04em" }}>Monto</span>
            <span style={{ color: "var(--adm-text3)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: ".04em" }}>Estado</span>
            <span style={{ color: "var(--adm-text)" }}>{formatDate(status.lastPaymentAt)}</span>
            <span style={{ color: "var(--adm-text)", fontWeight: 600 }}>{formatCLP(monthlyGross)}</span>
            <span style={{ color: "#4ade80", fontWeight: 600 }}>Pagado</span>
          </div>
          <p style={{ fontSize: "0.74rem", color: "var(--adm-text3)", margin: "12px 0 0", opacity: .7 }}>Se muestra el último pago registrado.</p>
        </Card>
      )}

      {/* Cancelar */}
      {!isExempt && hasActiveSub && (
        <Card style={{ border: "1px solid rgba(248,113,113,.15)" }}>
          <SectionTitle icon={<XCircle size={14} />}>Cancelar suscripción</SectionTitle>
          <p style={{ fontSize: "0.84rem", color: "var(--adm-text2)", margin: "0 0 14px", lineHeight: 1.6 }}>
            Si cancelas, mantienes acceso hasta el final del periodo pagado. Tu carta QR sigue funcionando en plan Gratis.
          </p>
          <button onClick={handleCancel} disabled={actioning} style={{ padding: "10px 18px", background: "transparent", color: "#f87171", border: "1px solid rgba(248,113,113,.3)", borderRadius: 999, fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: actioning ? "wait" : "pointer" }}>
            {actioning ? "Cancelando…" : "Cancelar mi plan"}
          </button>
        </Card>
      )}
    </div>
  );
}
