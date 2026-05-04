"use client";
import { useEffect, useState, useContext } from "react";
import { SessionContext } from "@/lib/admin/SessionContext";
import { toast } from "sonner";

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
};

const PLAN_PRICES: Record<string, number> = { GOLD: 29900, PREMIUM: 49900 };

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

function formatCLP(amount: number) {
  return `$${amount.toLocaleString("es-CL")}`;
}
function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  NONE:      { label: "Plan gratis",          color: "#666",     bg: "#f4f4f4" },
  TRIALING:  { label: "En prueba gratis",     color: "#16a34a", bg: "#dcfce7" },
  ACTIVE:    { label: "Activa",               color: "#16a34a", bg: "#dcfce7" },
  PAST_DUE:  { label: "Pago atrasado",        color: "#dc2626", bg: "#fee2e2" },
  CANCELED:  { label: "Cancelada",            color: "#92400e", bg: "#fef3c7" },
  UNPAID:    { label: "Sin pago",             color: "#dc2626", bg: "#fee2e2" },
};

export default function SuscripcionPage() {
  const ctx = useContext(SessionContext);
  const selectedRestaurantId = ctx?.selectedRestaurantId || null;
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
    return <div style={{ padding: 32, fontFamily: FB, color: "#888" }}>Cargando…</div>;
  }
  if (!status) {
    return <div style={{ padding: 32, fontFamily: FB, color: "#888" }}>No se pudo cargar la información.</div>;
  }

  const statusInfo = STATUS_LABEL[status.subscriptionStatus] || STATUS_LABEL.NONE;
  const isExempt = status.billingExempt;
  const isFree = status.plan === "FREE";
  const hasActiveSub = status.hasSubscription && (status.subscriptionStatus === "TRIALING" || status.subscriptionStatus === "ACTIVE" || status.subscriptionStatus === "PAST_DUE");
  const isCanceled = status.subscriptionStatus === "CANCELED";
  const inTrial = status.subscriptionStatus === "TRIALING";
  const monthlyPrice = PLAN_PRICES[status.plan] || 0;

  return (
    <div style={{ padding: "24px 16px", maxWidth: 720, margin: "0 auto", fontFamily: FB }}>
      <h1 style={{ fontFamily: F, fontSize: "1.6rem", fontWeight: 700, color: "#1a1a1a", margin: "0 0 6px" }}>Mi suscripción</h1>
      <p style={{ fontSize: "0.92rem", color: "#666", margin: "0 0 24px" }}>Estado de tu plan, pagos y opciones</p>

      {/* Card estado */}
      <div style={{ background: "white", border: "1px solid #E8D0A0", borderRadius: 16, padding: 24, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: "0.78rem", color: "#888", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Plan actual</p>
            <p style={{ fontFamily: F, fontSize: "2rem", fontWeight: 700, color: "#1a1a1a", margin: "2px 0 0" }}>
              {status.plan === "PREMIUM" ? "Premium" : status.plan === "GOLD" ? "Gold" : "Gratis"}
            </p>
          </div>
          <span style={{
            fontFamily: F, fontSize: "0.75rem", fontWeight: 700, padding: "6px 12px", borderRadius: 999,
            background: statusInfo.bg, color: statusInfo.color,
          }}>
            {isExempt ? "Plan bonificado" : statusInfo.label}
          </span>
        </div>

        {/* Mensaje según estado */}
        {isExempt && (
          <div style={{ background: "#FFF8E7", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
            <p style={{ fontSize: "0.85rem", color: "#92400e", margin: 0, lineHeight: 1.5 }}>
              🎁 Tu plan está <strong>bonificado por QuieroComer</strong>. No se te cobrará. Disfrutas de las funciones del plan {status.plan === "PREMIUM" ? "Premium" : status.plan === "GOLD" ? "Gold" : "Gratis"} sin costo.
            </p>
          </div>
        )}

        {!isExempt && isFree && (
          <div style={{ background: "linear-gradient(90deg, #FFF8E7 0%, #F3E8FF 100%)", border: "1px solid #fde68a", borderRadius: 10, padding: "14px", marginBottom: 16 }}>
            <p style={{ fontSize: "0.9rem", color: "#92400e", margin: "0 0 8px", fontWeight: 600 }}>
              🚀 Desbloquea más con Gold o Premium
            </p>
            <p style={{ fontSize: "0.82rem", color: "#666", margin: 0, lineHeight: 1.5 }}>
              Estadísticas, ofertas, multilenguaje, llamar al garzón, automatizaciones y más. Prueba 7 días gratis. Sin compromiso.
            </p>
          </div>
        )}

        {!isExempt && inTrial && status.trialEndsAt && (
          <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 10, padding: "14px", marginBottom: 16 }}>
            <p style={{ fontSize: "0.9rem", color: "#15803d", margin: "0 0 4px", fontWeight: 600 }}>
              ✓ Estás en prueba gratis
            </p>
            <p style={{ fontSize: "0.82rem", color: "#166534", margin: 0 }}>
              Primer cobro: <strong>{formatDate(status.trialEndsAt)}</strong> · {formatCLP(monthlyPrice)} mensual
            </p>
          </div>
        )}

        {!isExempt && status.subscriptionStatus === "ACTIVE" && status.currentPeriodEnd && (
          <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: "14px", marginBottom: 16 }}>
            <p style={{ fontSize: "0.85rem", color: "#0369a1", margin: 0 }}>
              Próximo cobro: <strong>{formatDate(status.currentPeriodEnd)}</strong> · {formatCLP(monthlyPrice)}
            </p>
          </div>
        )}

        {!isExempt && status.subscriptionStatus === "PAST_DUE" && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10, padding: "14px", marginBottom: 16 }}>
            <p style={{ fontSize: "0.9rem", color: "#991b1b", margin: "0 0 4px", fontWeight: 600 }}>
              ⚠ Hay un problema con tu tarjeta
            </p>
            <p style={{ fontSize: "0.82rem", color: "#7f1d1d", margin: 0 }}>
              No pudimos cobrar el último mes. Estamos reintentando. Si el problema persiste, perderás acceso a tu plan.
            </p>
          </div>
        )}

        {!isExempt && isCanceled && status.currentPeriodEnd && (
          <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 10, padding: "14px", marginBottom: 16 }}>
            <p style={{ fontSize: "0.9rem", color: "#92400e", margin: "0 0 4px", fontWeight: 600 }}>
              Suscripción cancelada
            </p>
            <p style={{ fontSize: "0.82rem", color: "#78350f", margin: 0 }}>
              Mantienes acceso hasta el {formatDate(status.currentPeriodEnd)}. Después tu plan vuelve a Gratis.
            </p>
          </div>
        )}

        {/* Detalles */}
        <div style={{ borderTop: "1px solid #f0eada", paddingTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {status.lastPaymentAt && (
            <div>
              <p style={{ fontSize: "0.72rem", color: "#888", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Último pago</p>
              <p style={{ fontSize: "0.92rem", color: "#333", margin: "2px 0 0", fontWeight: 600 }}>{formatDate(status.lastPaymentAt)}</p>
            </div>
          )}
          {status.currentPeriodEnd && (
            <div>
              <p style={{ fontSize: "0.72rem", color: "#888", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Periodo actual termina</p>
              <p style={{ fontSize: "0.92rem", color: "#333", margin: "2px 0 0", fontWeight: 600 }}>{formatDate(status.currentPeriodEnd)}</p>
            </div>
          )}
          <div>
            <p style={{ fontSize: "0.72rem", color: "#888", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Cobro mensual</p>
            <p style={{ fontSize: "0.92rem", color: "#333", margin: "2px 0 0", fontWeight: 600 }}>
              {monthlyPrice > 0 ? `${formatCLP(monthlyPrice)} (neto)` : isExempt ? "Sin costo" : "—"}
            </p>
          </div>
          <div>
            <p style={{ fontSize: "0.72rem", color: "#888", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Pasarela</p>
            <p style={{ fontSize: "0.92rem", color: "#333", margin: "2px 0 0", fontWeight: 600 }}>{status.hasSubscription ? "Flow.cl (Webpay)" : "—"}</p>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ borderTop: "1px solid #f0eada", paddingTop: 16, marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {!isExempt && isFree && (
            <button onClick={handleUpgrade} style={{
              flex: 1, minWidth: 200, padding: "12px 18px", background: GOLD, color: "white",
              border: "none", borderRadius: 999, fontFamily: F, fontSize: "0.88rem", fontWeight: 700, cursor: "pointer",
            }}>
              Probar Gold gratis 7 días
            </button>
          )}
          {!isExempt && hasActiveSub && (
            <>
              <button onClick={handleUpgrade} style={{
                flex: 1, minWidth: 160, padding: "12px 18px", background: "white", color: "#1a1a1a",
                border: "1px solid #ddd", borderRadius: 999, fontFamily: F, fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
              }}>
                Cambiar plan
              </button>
              <button onClick={handleCancel} disabled={actioning} style={{
                flex: 1, minWidth: 160, padding: "12px 18px", background: "transparent", color: "#dc2626",
                border: "1px solid #fca5a5", borderRadius: 999, fontFamily: F, fontSize: "0.85rem", fontWeight: 600,
                cursor: actioning ? "wait" : "pointer",
              }}>
                {actioning ? "Cancelando…" : "Cancelar suscripción"}
              </button>
            </>
          )}
          {!isExempt && isCanceled && (
            <button onClick={handleUpgrade} style={{
              flex: 1, minWidth: 200, padding: "12px 18px", background: GOLD, color: "white",
              border: "none", borderRadius: 999, fontFamily: F, fontSize: "0.88rem", fontWeight: 700, cursor: "pointer",
            }}>
              Reactivar suscripción
            </button>
          )}
        </div>
      </div>

      {/* Información extra */}
      <div style={{ background: "#f9f5e9", border: "1px solid #f0eada", borderRadius: 12, padding: 18, fontSize: "0.82rem", color: "#666", lineHeight: 1.6 }}>
        <p style={{ margin: "0 0 8px", fontWeight: 600, color: "#444" }}>📋 Información sobre tu suscripción</p>
        <ul style={{ margin: "0", paddingLeft: 18 }}>
          <li>Los cobros se hacen automáticamente cada mes con la tarjeta inscrita en Webpay.</li>
          <li>Puedes cancelar en cualquier momento desde aquí. Mantienes acceso hasta el final del mes pagado.</li>
          <li>Si tu tarjeta falla, te avisamos y reintentamos durante 7 días. Si no se regulariza, tu plan vuelve a Gratis.</li>
          <li>Tu carta QR sigue funcionando aunque tu plan baje a Gratis. Solo pierdes funciones avanzadas.</li>
        </ul>
      </div>
    </div>
  );
}
