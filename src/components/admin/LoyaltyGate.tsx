"use client";
import { useEffect, useState } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { grossOf, ivaOf } from "@/lib/billing/plans-config";
import { LOYALTY_PLAN_NET, LOYALTY_TRIAL_DAYS } from "@/lib/billing/plans-central";
import { toast } from "sonner";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const PURPLE = "#6d28d9";

const fmt = (n: number) => `$${n.toLocaleString("es-CL")}`;

const FEATURES = [
  { icon: "🎁", text: "Tarjeta de sellos digital para tus clientes" },
  { icon: "🍎", text: "Compatible con Apple Wallet y Google Wallet" },
  { icon: "🔔", text: "Notificaciones push cuando acumulan sellos" },
  { icon: "⭐", text: "Recompensas y premios configurables" },
  { icon: "📊", text: "Panel con clientes, canjes y estadísticas" },
  { icon: "🔗", text: "Link propio de tu programa de fidelización" },
];

interface LoyaltyStatus {
  loyaltyStatus: string;
  loyaltyTrialEndsAt: string | null;
  loyaltyTrialUsed: boolean;
  loyaltyPeriodEnd: string | null;
  billingExempt?: boolean;
}

// ── Modal de activación ───────────────────────────────────────────────────────
function LoyaltyModal({
  restaurantId,
  onClose,
}: {
  restaurantId: string;
  onClose: () => void;
}) {
  const net = LOYALTY_PLAN_NET;
  const iva = ivaOf(net);
  const gross = grossOf(net);
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handlePay = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/billing/loyalty/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        toast.error(data.error || "No se pudo iniciar el pago");
        setSubmitting(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error("Error de conexión");
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--adm-bg, #fff)", borderRadius: 24,
          maxWidth: 400, width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          border: "1px solid var(--adm-card-border, #eee)",
          position: "relative", overflow: "hidden",
        }}
      >
        {/* ── Pantalla 1: features + precio ── */}
        {!confirm && (
          <>
            {/* Header con gradiente */}
            <div style={{
              padding: "28px 24px 22px", textAlign: "center", position: "relative",
              background: `linear-gradient(160deg, rgba(109,40,217,0.12) 0%, rgba(109,40,217,0.04) 60%, transparent 100%)`,
              borderBottom: "1px solid rgba(109,40,217,0.1)",
            }}>
              <button
                onClick={onClose}
                style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", color: "var(--adm-text3, #888)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}
              >×</button>
              <div style={{ fontSize: "2.4rem", marginBottom: 10, lineHeight: 1 }}>🎁</div>
              <p style={{ margin: "0 0 6px", fontFamily: F, fontSize: "0.65rem", fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: PURPLE, opacity: 0.85 }}>
                Módulo Loyalty
              </p>
              <h3 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: "1.55rem", fontWeight: 700, color: "var(--adm-text, #1a1a1a)", lineHeight: 1.2, letterSpacing: "-0.3px" }}>
                Convierte a tus clientes<br />
                <span style={{ color: PURPLE }}>en fans de tu negocio</span>
              </h3>
            </div>

            <div style={{ padding: "20px 24px 24px" }}>
              {/* Features */}
              <div style={{
                background: "rgba(109,40,217,0.05)",
                border: "1px solid rgba(109,40,217,0.14)",
                borderRadius: 14, padding: "14px 16px", marginBottom: 18,
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {FEATURES.map(f => (
                    <div key={f.text} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0, width: 22, textAlign: "center" }}>{f.icon}</span>
                      <span style={{ fontFamily: FB, fontSize: "0.84rem", color: "var(--adm-text, #333)", lineHeight: 1.4 }}>{f.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={() => setConfirm(true)}
                style={{
                  display: "block", width: "100%", padding: "15px 20px",
                  border: "none", borderRadius: 999, textAlign: "center",
                  background: PURPLE, color: "#fff",
                  fontFamily: F, fontSize: "0.94rem", fontWeight: 700,
                  cursor: "pointer", marginBottom: 10,
                  boxShadow: "0 6px 24px rgba(109,40,217,0.35)",
                  boxSizing: "border-box",
                }}
              >
                Activar Loyalty — {fmt(net)} neto →
              </button>

              <button onClick={onClose} style={{ display: "block", width: "100%", background: "none", border: "none", color: "var(--adm-text3, #999)", fontFamily: F, fontSize: "0.82rem", cursor: "pointer", padding: "8px 0" }}>
                Cerrar
              </button>
            </div>
          </>
        )}

        {/* ── Pantalla 2: resumen de pago ── */}
        {confirm && (
          <div style={{ padding: "28px 24px", display: "flex", flexDirection: "column" }}>
            <button
              onClick={() => setConfirm(false)}
              style={{ position: "absolute", top: 14, left: 16, background: "none", border: "none", color: "var(--adm-text3, #888)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}
            >←</button>

            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: "0.68rem", letterSpacing: ".15em", textTransform: "uppercase", color: PURPLE, fontWeight: 700, marginBottom: 8, fontFamily: F }}>Resumen</div>
              <h3 style={{ fontFamily: "Georgia,serif", fontSize: "1.3rem", fontWeight: 400, color: "var(--adm-text, #1a1a1a)", margin: 0 }}>Módulo Loyalty</h3>
            </div>

            {/* Price breakdown */}
            <div style={{
              background: "var(--adm-input, #f5f5f5)",
              border: "1px solid var(--adm-card-border, #eee)",
              borderRadius: 14, padding: "16px 18px", marginBottom: 16,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14, color: "var(--adm-text, #333)" }}>
                <span>Mensual</span>
                <span style={{ fontWeight: 700 }}>{fmt(net)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14, color: "var(--adm-text2, #555)" }}>
                <span>IVA (19%)</span>
                <span>{fmt(iva)}</span>
              </div>
              <div style={{
                borderTop: "1px solid var(--adm-card-border, #ddd)",
                paddingTop: 10,
                display: "flex", justifyContent: "space-between",
                fontSize: 16, fontWeight: 800, color: "var(--adm-text, #1a1a1a)",
              }}>
                <span>Total mensual</span>
                <span>{fmt(gross)}</span>
              </div>
            </div>

            <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2, #555)", textAlign: "center", marginBottom: 20, lineHeight: 1.5 }}>
              Serás redirigido a Flow para pagar de forma segura. Sin contratos, cancelas cuando quieras.
            </p>

            <button
              onClick={handlePay}
              disabled={submitting}
              style={{
                width: "100%", padding: 15, border: "none", borderRadius: 999,
                background: submitting ? "#ccc" : PURPLE,
                color: "#fff", fontFamily: F, fontSize: "0.92rem", fontWeight: 700,
                cursor: submitting ? "wait" : "pointer",
                boxShadow: submitting ? "none" : "0 4px 16px rgba(109,40,217,0.3)",
                marginBottom: 12,
              }}
            >
              {submitting ? "Redirigiendo…" : `Pagar ${fmt(gross)}`}
            </button>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11, color: "var(--adm-text3, #888)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              Pago seguro vía Flow
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Gate principal ────────────────────────────────────────────────────────────
export default function LoyaltyGate({ children }: { children: React.ReactNode }) {
  const { selectedRestaurantId } = useAdminSession();
  const [status, setStatus] = useState<LoyaltyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!selectedRestaurantId) { setLoading(false); return; }
    fetch(`/api/billing/status?restaurantId=${selectedRestaurantId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setStatus(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedRestaurantId]);

  if (loading) return null;
  if (!status) return <>{children}</>;
  if (status.billingExempt) return <>{children}</>;

  const isActive = status.loyaltyStatus === "ACTIVE" || status.loyaltyStatus === "TRIALING";
  if (isActive) return <>{children}</>;

  const net = LOYALTY_PLAN_NET;
  const trialUsed = status.loyaltyTrialUsed;

  const handleTrial = async () => {
    if (!selectedRestaurantId || activating) return;
    setActivating(true);
    try {
      const res = await fetch("/api/billing/loyalty/start-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: selectedRestaurantId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "No se pudo activar la prueba"); setActivating(false); return; }
      toast.success(`¡Loyalty activado! ${LOYALTY_TRIAL_DAYS} días gratis.`);
      setTimeout(() => window.location.reload(), 1000);
    } catch { toast.error("Error de conexión"); setActivating(false); }
  };

  return (
    <>
      {modalOpen && selectedRestaurantId && (
        <LoyaltyModal restaurantId={selectedRestaurantId} onClose={() => setModalOpen(false)} />
      )}

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "32px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎁</div>
        <h2 style={{ fontFamily: F, fontSize: "1.4rem", fontWeight: 800, color: "var(--adm-text)", margin: "0 0 8px" }}>
          Módulo Loyalty
        </h2>
        <p style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text2)", margin: "0 0 8px", lineHeight: 1.6 }}>
          Sistema de tarjeta de fidelización digital con Apple Wallet y Google Wallet.
          Haz que tus clientes vuelvan con sellos, recompensas y notificaciones.
        </p>
        <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", margin: "0 0 24px" }}>
          ${net.toLocaleString("es-CL")} neto/mes · Sin contratos
        </p>

        {trialUsed ? (
          /* Trial ya usado → abrir modal con features + pago */
          <>
            <button
              onClick={() => setModalOpen(true)}
              style={{
                display: "block", width: "100%", padding: "15px 0", border: "none",
                borderRadius: 14, background: PURPLE, color: "#fff",
                fontFamily: F, fontSize: "0.95rem", fontWeight: 800,
                cursor: "pointer", marginBottom: 8,
                boxShadow: "0 6px 20px rgba(109,40,217,0.3)",
              }}
            >
              Activar Loyalty →
            </button>
            <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: "0 0 20px" }}>
              Sin contratos · Cancelas cuando quieras
            </p>
          </>
        ) : (
          /* Sin trial previo → ofrecer prueba gratis */
          <>
            <button
              onClick={handleTrial}
              disabled={activating}
              style={{
                display: "block", width: "100%", padding: "15px 0", border: "none",
                borderRadius: 14, background: PURPLE, color: "#fff",
                fontFamily: F, fontSize: "0.95rem", fontWeight: 800,
                cursor: activating ? "wait" : "pointer", marginBottom: 8,
                boxShadow: "0 6px 20px rgba(109,40,217,0.3)",
                opacity: activating ? 0.7 : 1,
              }}
            >
              {activating ? "Activando…" : `✨ Probar ${LOYALTY_TRIAL_DAYS} días gratis`}
            </button>
            <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", margin: "0 0 20px", lineHeight: 1.5 }}>
              Prueba sin compromiso
            </p>
          </>
        )}
      </div>
    </>
  );
}
