"use client";
import { useEffect, useState } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { grossOf } from "@/lib/billing/plans-config";
import { LOYALTY_PLAN_NET, LOYALTY_TRIAL_DAYS } from "@/lib/billing/plans-central";
import { toast } from "sonner";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const PURPLE = "#6d28d9";

interface LoyaltyStatus {
  loyaltyStatus: string;
  loyaltyTrialEndsAt: string | null;
  loyaltyPeriodEnd: string | null;
  billingExempt?: boolean;
}

export default function LoyaltyGate({ children }: { children: React.ReactNode }) {
  const { selectedRestaurantId } = useAdminSession();
  const [status, setStatus] = useState<LoyaltyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

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
  const gross = grossOf(net);

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

  const handleSubscribe = async () => {
    if (!selectedRestaurantId || subscribing) return;
    setSubscribing(true);
    try {
      const res = await fetch("/api/billing/loyalty/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: selectedRestaurantId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) { toast.error(data.error || "No se pudo iniciar el pago"); setSubscribing(false); return; }
      window.location.href = data.url;
    } catch { toast.error("Error de conexión"); setSubscribing(false); }
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "32px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🎁</div>
      <h2 style={{ fontFamily: F, fontSize: "1.4rem", fontWeight: 800, color: "var(--adm-text)", margin: "0 0 8px" }}>
        Módulo Loyalty
      </h2>
      <p style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text2)", margin: "0 0 28px", lineHeight: 1.6 }}>
        Sistema de tarjeta de fidelización digital con Apple Wallet y Google Wallet.
        Haz que tus clientes vuelvan con sellos, recompensas y notificaciones.
      </p>

      {/* Trial CTA */}
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
        Luego de los {LOYALTY_TRIAL_DAYS} días, ${net.toLocaleString("es-CL")} neto mensual · Sin contratos · Cancelas cuando quieras
      </p>
    </div>
  );
}
