"use client";
import { useEffect, useState } from "react";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import PlanesModal from "@/components/PlanesModal";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const PURPLE = "#6d28d9";

const FEATURES = [
  { icon: "🎁", text: "Tarjeta de sellos digital para tus clientes" },
  { icon: "🍎", text: "Compatible con Apple Wallet y Google Wallet" },
  { icon: "🔔", text: "Notificaciones push cuando acumulan sellos" },
  { icon: "⭐", text: "Recompensas y premios configurables" },
  { icon: "📊", text: "Panel con clientes, canjes y estadísticas" },
  { icon: "🔗", text: "Link propio de tu programa de fidelización" },
];

export default function LoyaltyGate({ children }: { children: React.ReactNode }) {
  const { selectedRestaurantId, loading: sessionLoading } = usePanelSession();
  const [hasLoyalty, setHasLoyalty] = useState<boolean | null>(null);
  const [billingExempt, setBillingExempt] = useState(false);
  const [showPlans, setShowPlans] = useState(false);

  useEffect(() => {
    if (sessionLoading) return;
    if (!selectedRestaurantId) { setHasLoyalty(false); return; }
    fetch(`/api/billing/status?restaurantId=${selectedRestaurantId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) { setHasLoyalty(false); return; }
        setBillingExempt(!!d.billingExempt);
        setHasLoyalty(!!d.hasLoyalty);
      })
      .catch(() => setHasLoyalty(false));
  }, [selectedRestaurantId, sessionLoading]);

  if (hasLoyalty === null || sessionLoading) return (
    <p style={{ fontFamily: "var(--font-body)", color: "var(--adm-text3)", fontSize: "0.85rem", padding: 20 }}>
      Cargando…
    </p>
  );

  if (billingExempt || hasLoyalty) return <>{children}</>;

  // Sin Plan Pro → invitar a activar
  return (
    <>
      {showPlans && <PlanesModal onClose={() => setShowPlans(false)} highlightPlan="PREMIUM" />}

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "32px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎁</div>
        <p style={{ fontFamily: F, fontSize: "0.65rem", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: PURPLE, margin: "0 0 8px", opacity: 0.85 }}>
          Incluido en Plan Pro
        </p>
        <h2 style={{ fontFamily: F, fontSize: "1.4rem", fontWeight: 800, color: "var(--adm-text)", margin: "0 0 10px" }}>
          Loyalty Fidelización
        </h2>
        <p style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text2)", margin: "0 0 20px", lineHeight: 1.6 }}>
          Tarjeta de sellos digital con Apple Wallet y Google Wallet.<br />
          Haz que tus clientes vuelvan con recompensas y notificaciones push.
        </p>

        <div style={{
          background: "rgba(109,40,217,0.05)",
          border: "1px solid rgba(109,40,217,0.14)",
          borderRadius: 14, padding: "14px 16px", marginBottom: 22, textAlign: "left",
        }}>
          {FEATURES.map(f => (
            <div key={f.text} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
              <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0, width: 20, textAlign: "center" }}>{f.icon}</span>
              <span style={{ fontFamily: FB, fontSize: "0.83rem", color: "var(--adm-text)", lineHeight: 1.4 }}>{f.text}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => setShowPlans(true)}
          style={{
            display: "block", width: "100%", padding: "15px 0", border: "none",
            borderRadius: 14, background: PURPLE, color: "#fff",
            fontFamily: F, fontSize: "0.95rem", fontWeight: 800,
            cursor: "pointer", marginBottom: 10,
            boxShadow: "0 6px 20px rgba(109,40,217,0.3)",
          }}
        >
          Activar Plan Pro →
        </button>
        <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: 0 }}>
          7 días de prueba gratis · Sin contratos · Cancelas cuando quieras
        </p>
      </div>
    </>
  );
}
