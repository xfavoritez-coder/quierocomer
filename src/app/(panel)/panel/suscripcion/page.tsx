"use client";
import { useEffect, useState, useContext } from "react";
import { CreditCard, Sparkles, Shield, Receipt, XCircle, ExternalLink } from "lucide-react";
import { SessionContext } from "@/lib/admin/SessionContext";
import { toast } from "sonner";
import { planNetAmount, ivaOf, grossOf, type PlanKey, PLAN_LABELS } from "@/lib/billing/plans-config";

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
  ivaRate?: number;
  billingInfo?: { isComplete: boolean; missingFields: string[] };
};

const GOLD = "#F4A623";
const PREMIUM_COLOR = "#7c3aed";
const PREMIUM_LIGHT = "#c4b5fd";
const PREMIUM_BG = "rgba(124,58,237,.08)";

function formatCLP(amount: number) {
  return `$${amount.toLocaleString("es-CL")}`;
}
function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  NONE:      { label: "Sin plan activo",       color: "var(--adm-text3)",     bg: "rgba(128,128,128,.1)" },
  TRIALING:  { label: "En prueba",             color: "#4ade80", bg: "rgba(74,222,128,.12)" },
  ACTIVE:    { label: "Activa",                color: "#4ade80", bg: "rgba(74,222,128,.12)" },
  PAST_DUE:  { label: "Pago atrasado",         color: "#f87171", bg: "rgba(248,113,113,.12)" },
  CANCELED:  { label: "Cancelada",             color: "#fbbf24", bg: "rgba(251,191,36,.12)" },
  UNPAID:    { label: "Sin pago",              color: "#f87171", bg: "rgba(248,113,113,.12)" },
};

/* ─── Card wrapper ─────────────────────────────────────────── */
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
      borderRadius: 22, padding: "24px 20px", marginBottom: 16, ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 style={{
      fontFamily: "var(--font-display)", fontSize: "0.82rem", fontWeight: 800,
      color: "var(--adm-text3)", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8,
      textTransform: "uppercase", letterSpacing: ".6px",
    }}>
      {icon} {children}
    </h2>
  );
}

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

  const handleUpgrade = () => {
    window.dispatchEvent(new CustomEvent("show-plan-modal"));
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
      if (!res.ok) {
        toast.error(data.error || "No se pudo cancelar");
        setActioning(false);
        return;
      }
      toast.success("Suscripción cancelada. Mantienes acceso hasta el final del periodo.");
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      toast.error("Error de conexión");
      setActioning(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 32, fontFamily: "var(--font-body)", color: "var(--adm-text3)" }}>
        Cargando…
      </div>
    );
  }

  /* ─── DEMO MODE ──────────────────────────────────────────── */
  if (isDemo) {
    const premiumNet = planNetAmount("PREMIUM");
    const premiumGross = premiumNet + ivaOf(premiumNet);
    const promoPrice = 4900;

    return (
      <div style={{ padding: "24px 16px", maxWidth: 720, margin: "0 auto", fontFamily: "var(--font-body)" }}>
        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 700,
          color: "var(--adm-text)", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 8,
        }}>
          <CreditCard size={20} color="var(--adm-text3)" /> Mi suscripción
        </h1>
        <p style={{ fontSize: "0.92rem", color: "var(--adm-text2)", margin: "0 0 24px" }}>
          Estado de tu plan y activación
        </p>

        {/* Demo Premium Card */}
        <Card style={{ background: `linear-gradient(145deg, rgba(124,58,237,.08) 0%, rgba(124,58,237,.02) 100%)`, border: `1px solid rgba(124,58,237,.25)` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: "0.72rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em" }}>Tu plan actual</p>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 700, color: PREMIUM_LIGHT, margin: "2px 0 0" }}>
                Premium
              </p>
            </div>
            <span style={{
              fontSize: "0.72rem", fontWeight: 800, padding: "6px 14px", borderRadius: 999,
              background: "rgba(124,58,237,.15)", color: PREMIUM_LIGHT, letterSpacing: ".5px",
              border: "1px solid rgba(124,58,237,.3)",
            }}>
              DEMO
            </span>
          </div>

          <div style={{
            background: "rgba(124,58,237,.06)", border: "1px solid rgba(124,58,237,.15)",
            borderRadius: 14, padding: "16px 14px", marginBottom: 20,
          }}>
            <p style={{ fontSize: "0.88rem", color: "var(--adm-text)", margin: 0, lineHeight: 1.5 }}>
              Estás en <strong style={{ color: PREMIUM_LIGHT }}>Premium demo</strong> — activa para publicar tu carta.
            </p>
          </div>

          {/* Precio */}
          <div style={{
            background: `linear-gradient(135deg, rgba(124,58,237,.12) 0%, rgba(147,51,234,.06) 100%)`,
            border: "1px solid rgba(124,58,237,.2)",
            borderRadius: 16, padding: "22px 20px", marginBottom: 20,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ fontSize: "0.78rem", color: PREMIUM_LIGHT, margin: 0, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>
                Primer mes
              </p>
              <span style={{
                background: PREMIUM_COLOR, color: "white", fontSize: "0.7rem", fontWeight: 900,
                padding: "3px 10px", borderRadius: 999,
              }}>
                90% OFF
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "2.6rem", fontWeight: 900, color: "white", letterSpacing: "-1px" }}>
                {formatCLP(promoPrice)}
              </span>
              <span style={{ fontSize: "0.88rem", color: "var(--adm-text3)", textDecoration: "line-through" }}>
                {formatCLP(premiumGross)}
              </span>
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--adm-text3)", margin: "8px 0 0" }}>
              Después {formatCLP(premiumGross)}/mes · Cancela cuando quieras
            </p>
          </div>

          {/* CTA */}
          <a
            href={`/activar/${slug}`}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              width: "100%", padding: "14px 20px",
              background: `linear-gradient(135deg, ${PREMIUM_COLOR}, #9333ea)`,
              color: "white", border: "none", borderRadius: 999,
              fontFamily: "var(--font-display)", fontSize: "0.95rem", fontWeight: 800,
              textDecoration: "none", cursor: "pointer",
              boxShadow: "0 4px 20px rgba(124,58,237,.35)",
            }}
          >
            Activar mi carta por {formatCLP(promoPrice)} →
          </a>
        </Card>

        {/* Al activar */}
        <Card style={{ background: "rgba(124,58,237,.04)", border: "1px solid rgba(124,58,237,.12)" }}>
          <h2 style={{
            fontFamily: "var(--font-display)", fontSize: "0.82rem", fontWeight: 800,
            color: "var(--adm-text3)", margin: "0 0 20px",
            textTransform: "uppercase", letterSpacing: ".6px",
          }}>Al activar</h2>
          <div style={{ display: "grid", gap: 14 }}>
            {[
              { icon: "📱", title: "Se publica tu carta", desc: "Tus clientes la ven al escanear el QR" },
              { icon: "📩", title: "Recibes tu QR por correo", desc: "En alta calidad para imprimir y poner en mesas" },
              { icon: "📊", title: "Empiezas a medir resultados", desc: "Visitas, platos más vistos y sesiones en vivo" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{
                  fontSize: "1.1rem", width: 34, height: 34, borderRadius: 10,
                  background: "rgba(124,58,237,.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  {item.icon}
                </span>
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

  /* ─── NORMAL MODE (non-demo) ─────────────────────────────── */
  if (!status) {
    return <div style={{ padding: 32, fontFamily: "var(--font-body)", color: "var(--adm-text3)" }}>No se pudo cargar la información.</div>;
  }

  const statusInfo = STATUS_LABEL[status.subscriptionStatus] || STATUS_LABEL.NONE;
  const isExempt = status.billingExempt;
  const isFree = status.plan === "FREE";
  const hasActiveSub = status.hasSubscription && (status.subscriptionStatus === "TRIALING" || status.subscriptionStatus === "ACTIVE" || status.subscriptionStatus === "PAST_DUE");
  const isCanceled = status.subscriptionStatus === "CANCELED";
  const inTrial = status.subscriptionStatus === "TRIALING";
  const monthlyNet = planNetAmount(status.plan as PlanKey);
  const monthlyIva = ivaOf(monthlyNet);
  const monthlyGross = monthlyNet + monthlyIva;
  const billingComplete = status.billingInfo?.isComplete !== false;

  return (
    <div style={{ padding: "24px 16px", maxWidth: 720, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <h1 style={{
        fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 700,
        color: "var(--adm-text)", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 8,
      }}>
        <CreditCard size={20} color="var(--adm-text3)" /> Mi suscripción
      </h1>
      <p style={{ fontSize: "0.92rem", color: "var(--adm-text2)", margin: "0 0 24px" }}>
        Estado de tu plan, pagos y opciones
      </p>

      {/* ─── Plan actual ─────────────────────── */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: "0.72rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em" }}>Plan actual</p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 700, color: "var(--adm-text)", margin: "2px 0 0" }}>
              {status.plan === "PREMIUM" ? "Premium" : status.plan === "GOLD" ? "Gold" : "Gratis"}
            </p>
          </div>
          <span style={{
            fontSize: "0.72rem", fontWeight: 800, padding: "6px 14px", borderRadius: 999,
            background: statusInfo.bg, color: statusInfo.color,
          }}>
            {isExempt ? "Bonificado" : statusInfo.label}
          </span>
        </div>

        {/* Status messages */}
        {isExempt && (
          <div style={{ background: "rgba(74,222,128,.06)", border: "1px solid rgba(74,222,128,.15)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
            <p style={{ fontSize: "0.85rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
              Tu plan está <strong style={{ color: "var(--adm-text)" }}>bonificado por QuieroComer</strong>. No se te cobrará. Disfrutas de las funciones del plan {PLAN_LABELS[status.plan as PlanKey] || status.plan} sin costo.
            </p>
          </div>
        )}

        {!isExempt && isFree && (
          <div style={{ background: "rgba(244,166,35,.06)", border: "1px solid rgba(244,166,35,.15)", borderRadius: 12, padding: "14px", marginBottom: 16 }}>
            <p style={{ fontSize: "0.9rem", color: "var(--adm-text)", margin: "0 0 6px", fontWeight: 700 }}>
              Desbloquea más con Gold o Premium
            </p>
            <p style={{ fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
              Estadísticas, ofertas, multilenguaje, llamar al garzón, automatizaciones y más.
            </p>
          </div>
        )}

        {!isExempt && inTrial && status.trialEndsAt && (
          <div style={{ background: "rgba(74,222,128,.06)", border: "1px solid rgba(74,222,128,.15)", borderRadius: 12, padding: "14px", marginBottom: 16 }}>
            <p style={{ fontSize: "0.9rem", color: "#4ade80", margin: "0 0 4px", fontWeight: 700 }}>
              Estás en periodo de prueba
            </p>
            <p style={{ fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0 }}>
              Primer cobro: <strong style={{ color: "var(--adm-text)" }}>{formatDate(status.trialEndsAt)}</strong> · {formatCLP(monthlyGross)} (IVA incluido)
            </p>
          </div>
        )}

        {!isExempt && status.subscriptionStatus === "ACTIVE" && status.currentPeriodEnd && (
          <div style={{ background: "rgba(56,189,248,.06)", border: "1px solid rgba(56,189,248,.15)", borderRadius: 12, padding: "14px", marginBottom: 16 }}>
            <p style={{ fontSize: "0.85rem", color: "var(--adm-text2)", margin: 0 }}>
              Próximo cobro: <strong style={{ color: "var(--adm-text)" }}>{formatDate(status.currentPeriodEnd)}</strong> · {formatCLP(monthlyGross)} (IVA incluido)
            </p>
          </div>
        )}

        {!isExempt && !billingComplete && status.hasSubscription && (
          <div style={{ background: "rgba(251,191,36,.06)", border: "1px solid rgba(251,191,36,.2)", borderRadius: 12, padding: "14px", marginBottom: 16 }}>
            <p style={{ fontSize: "0.9rem", color: "#fbbf24", margin: "0 0 4px", fontWeight: 700 }}>
              Completa tus datos de facturación
            </p>
            <p style={{ fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 10px", lineHeight: 1.5 }}>
              Necesitamos tu razón social, RUT y giro para emitir la factura electrónica con IVA cada mes.
            </p>
            <a href="/panel/facturacion" style={{
              display: "inline-block", padding: "8px 16px", background: GOLD, color: "#100b03",
              borderRadius: 999, fontFamily: "var(--font-display)", fontSize: "0.78rem", fontWeight: 700, textDecoration: "none",
            }}>
              Completar datos →
            </a>
          </div>
        )}

        {!isExempt && status.subscriptionStatus === "PAST_DUE" && (
          <div style={{ background: "rgba(248,113,113,.06)", border: "1px solid rgba(248,113,113,.2)", borderRadius: 12, padding: "14px", marginBottom: 16 }}>
            <p style={{ fontSize: "0.9rem", color: "#f87171", margin: "0 0 4px", fontWeight: 700 }}>
              Hay un problema con tu tarjeta
            </p>
            <p style={{ fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0 }}>
              No pudimos cobrar el último mes. Estamos reintentando. Si el problema persiste, perderás acceso a tu plan.
            </p>
          </div>
        )}

        {!isExempt && isCanceled && status.currentPeriodEnd && (
          <div style={{ background: "rgba(251,191,36,.06)", border: "1px solid rgba(251,191,36,.2)", borderRadius: 12, padding: "14px", marginBottom: 16 }}>
            <p style={{ fontSize: "0.9rem", color: "#fbbf24", margin: "0 0 4px", fontWeight: 700 }}>
              Suscripción cancelada
            </p>
            <p style={{ fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0 }}>
              Mantienes acceso hasta el {formatDate(status.currentPeriodEnd)}. Después tu plan vuelve a Gratis.
            </p>
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
          <div>
            <p style={{ fontSize: "0.7rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em" }}>Cobro mensual</p>
            <p style={{ fontSize: "0.92rem", color: "var(--adm-text)", margin: "2px 0 0", fontWeight: 600 }}>
              {monthlyNet > 0 ? formatCLP(monthlyGross) : isExempt ? "Sin costo" : "—"}
            </p>
            {monthlyNet > 0 && (
              <p style={{ fontSize: "0.68rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>
                {formatCLP(monthlyNet)} neto + {formatCLP(monthlyIva)} IVA
              </p>
            )}
          </div>
          <div>
            <p style={{ fontSize: "0.7rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em" }}>Pasarela</p>
            <p style={{ fontSize: "0.92rem", color: "var(--adm-text)", margin: "2px 0 0", fontWeight: 600 }}>{status.hasSubscription ? "Flow.cl (Webpay)" : "—"}</p>
          </div>
        </div>

        {/* Actions */}
        <div style={{ borderTop: "1px solid var(--adm-card-border)", paddingTop: 16, marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {!isExempt && isFree && (
            <button onClick={handleUpgrade} style={{
              flex: 1, minWidth: 200, padding: "13px 18px",
              background: `linear-gradient(135deg, #ffc44f, ${GOLD})`, color: "#100b03",
              border: "none", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: "0.88rem", fontWeight: 800, cursor: "pointer",
            }}>
              Mejorar plan
            </button>
          )}
          {!isExempt && hasActiveSub && (
            <button onClick={handleUpgrade} style={{
              flex: 1, minWidth: 160, padding: "13px 18px",
              background: "rgba(255,255,255,.05)", color: "var(--adm-text)",
              border: "1px solid var(--adm-card-border)", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
            }}>
              Cambiar plan
            </button>
          )}
          {!isExempt && isCanceled && (
            <button onClick={handleUpgrade} style={{
              flex: 1, minWidth: 200, padding: "13px 18px",
              background: `linear-gradient(135deg, #ffc44f, ${GOLD})`, color: "#100b03",
              border: "none", borderRadius: 999, fontFamily: "var(--font-display)", fontSize: "0.88rem", fontWeight: 800, cursor: "pointer",
            }}>
              Reactivar suscripción
            </button>
          )}
        </div>
      </Card>

      {/* ─── Método de pago ───────────────────── */}
      {hasActiveSub && (
        <Card>
          <SectionTitle icon={<Shield size={14} />}>Método de pago</SectionTitle>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 44, height: 30, borderRadius: 6,
                background: "rgba(255,255,255,.06)", border: "1px solid var(--adm-card-border)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <CreditCard size={18} color="var(--adm-text3)" />
              </div>
              <div>
                <p style={{ fontSize: "0.88rem", color: "var(--adm-text)", margin: 0, fontWeight: 600 }}>
                  Tarjeta vía Webpay
                </p>
                <p style={{ fontSize: "0.76rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>
                  Inscrita en Flow.cl · cobro automático mensual
                </p>
              </div>
            </div>
            <a
              href="https://www.flow.cl/app/web/misDatos.php"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 4,
                fontSize: "0.78rem", color: GOLD, textDecoration: "none", fontWeight: 600,
              }}
            >
              Gestionar <ExternalLink size={12} />
            </a>
          </div>
        </Card>
      )}

      {/* ─── Historial de pagos ──────────────── */}
      {status.lastPaymentAt && (
        <Card>
          <SectionTitle icon={<Receipt size={14} />}>Historial de pagos</SectionTitle>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr auto auto",
            gap: "8px 16px", fontSize: "0.82rem",
          }}>
            <span style={{ color: "var(--adm-text3)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: ".04em" }}>Fecha</span>
            <span style={{ color: "var(--adm-text3)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: ".04em" }}>Monto</span>
            <span style={{ color: "var(--adm-text3)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: ".04em" }}>Estado</span>

            <span style={{ color: "var(--adm-text)" }}>{formatDate(status.lastPaymentAt)}</span>
            <span style={{ color: "var(--adm-text)", fontWeight: 600 }}>{formatCLP(monthlyGross)}</span>
            <span style={{ color: "#4ade80", fontWeight: 600 }}>Pagado</span>
          </div>
          <p style={{ fontSize: "0.74rem", color: "var(--adm-text3)", margin: "12px 0 0", opacity: .7 }}>
            Se muestra el último pago registrado. El historial completo estará disponible próximamente.
          </p>
        </Card>
      )}

      {/* ─── Cancelar ────────────────────────── */}
      {!isExempt && hasActiveSub && (
        <Card style={{ border: "1px solid rgba(248,113,113,.15)" }}>
          <SectionTitle icon={<XCircle size={14} />}>Cancelar suscripción</SectionTitle>
          <p style={{ fontSize: "0.84rem", color: "var(--adm-text2)", margin: "0 0 14px", lineHeight: 1.6 }}>
            Si cancelas, mantienes acceso hasta el final del periodo pagado.
            Tu carta QR sigue funcionando en plan Gratis — solo pierdes las funciones avanzadas.
          </p>
          <button onClick={handleCancel} disabled={actioning} style={{
            padding: "10px 18px", background: "transparent", color: "#f87171",
            border: "1px solid rgba(248,113,113,.3)", borderRadius: 999,
            fontFamily: "var(--font-display)", fontSize: "0.82rem", fontWeight: 600,
            cursor: actioning ? "wait" : "pointer",
          }}>
            {actioning ? "Cancelando…" : "Cancelar mi suscripción"}
          </button>
        </Card>
      )}

      {/* ─── Info footer ─────────────────────── */}
      <Card style={{ background: "rgba(255,255,255,.02)" }}>
        <p style={{ fontSize: "0.78rem", color: "var(--adm-text3)", margin: 0, lineHeight: 1.7 }}>
          Los cobros se hacen automáticamente cada mes con la tarjeta inscrita en Webpay.
          El monto incluye IVA (19%). Puedes cancelar en cualquier momento.
          Si tu tarjeta falla, reintentamos durante 7 días antes de bajar el plan a Gratis.
        </p>
      </Card>
    </div>
  );
}
