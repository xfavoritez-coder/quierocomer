"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import { SessionContext } from "@/lib/admin/SessionContext";
import AdminLayoutOwner from "@/components/admin/layouts/AdminLayoutOwner";
import { toast } from "sonner";
import {
  PLAN_FEATURES_DISPLAY,
  PLAN_INHERITS_FROM,
  PLAN_TAGLINES,
  planNetAmount,
  ivaOf,
  grossOf,
} from "@/lib/billing/plans-config";

const PUBLIC_PATHS = ["/panel/login", "/panel/forgot-password", "/panel/reset-password"];

function ForceChangePasswordModal({ onDone }: { onDone: () => void }) {
  const F = "var(--font-display)";
  const GOLD = "#F4A623";
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", height: 40, boxSizing: "border-box",
    background: "#FFF9ED", border: "1px solid #E8C78A", borderRadius: 6,
    color: "#1a1a1a", fontFamily: F, fontSize: "0.88rem", outline: "none",
  };

  const handleSubmit = async () => {
    setError("");
    if (!currentPassword || !newPassword || !confirmPassword) { setError("Todos los campos son requeridos"); return; }
    if (newPassword.length < 8) { setError("La nueva contraseña debe tener al menos 8 caracteres"); return; }
    if (!/\d/.test(newPassword)) { setError("La nueva contraseña debe contener al menos 1 número"); return; }
    if (newPassword !== confirmPassword) { setError("Las contraseñas no coinciden"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/panel/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error al cambiar contraseña"); setSaving(false); return; }
      toast.success("Contraseña actualizada");
      onDone();
    } catch { setError("Error de conexión"); }
    setSaving(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, padding: 28, width: "100%", maxWidth: 380, boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 40 }}>🔐</span>
          <h2 style={{ fontFamily: F, fontSize: "1.1rem", color: "#1a1a1a", margin: "8px 0 4px" }}>Cambio de contraseña requerido</h2>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#8a7550", margin: 0 }}>Por seguridad, debes cambiar tu contraseña temporal antes de continuar.</p>
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
            <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#dc2626", margin: 0 }}>{error}</p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "#8a7550", marginBottom: 4, textTransform: "uppercase", letterSpacing: "1px" }}>Contraseña actual</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Tu contraseña temporal" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "#8a7550", marginBottom: 4, textTransform: "uppercase", letterSpacing: "1px" }}>Nueva contraseña</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mín. 8 caracteres, 1 número" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "#8a7550", marginBottom: 4, textTransform: "uppercase", letterSpacing: "1px" }}>Confirmar contraseña</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repite la nueva contraseña" style={inputStyle} />
          </div>
          <button onClick={handleSubmit} disabled={saving} style={{
            width: "100%", height: 44, marginTop: 4,
            background: saving ? "#E8A942" : GOLD,
            color: "white", fontFamily: F, fontSize: "0.88rem", fontWeight: 700,
            border: "none", borderRadius: 8, cursor: saving ? "wait" : "pointer",
          }}>
            {saving ? "Guardando..." : "Cambiar contraseña"}
          </button>
        </div>
      </div>
    </div>
  );
}


function PlanFeatureRow({ text, tip, color }: { text: string; tip: string; color: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        <span style={{ color, fontSize: "0.82rem", flexShrink: 0 }}>✓</span>
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "#444", flex: 1 }}>{text}</span>
        <span style={{ width: 15, height: 15, borderRadius: "50%", background: open ? "#1a1a1a" : "#e8e3d8", color: open ? "#fff" : "#888", fontSize: "8px", fontWeight: 700, fontStyle: "italic", fontFamily: "Georgia,serif", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>i</span>
      </div>
      {open && <p style={{ margin: "4px 0 2px 20px", fontSize: "0.78rem", color: "#888", lineHeight: 1.45 }}>{tip}</p>}
    </div>
  );
}

type BillingStatus = {
  plan: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  hasSubscription: boolean;
  activeFlowPlan: string | null;
  billingExempt?: boolean;
};

function TrialBanner({ restaurantId }: { restaurantId: string | null }) {
  const [status, setStatus] = useState<BillingStatus | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/billing/status?restaurantId=${restaurantId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setStatus(d))
      .catch(() => {});
  }, [restaurantId]);

  if (!status) return null;
  if (status.subscriptionStatus !== "TRIALING") return null;
  if (status.hasSubscription) return null; // ya inscribio tarjeta
  if (status.billingExempt) return null;

  // Calcular dias restantes
  let daysLeft: number | null = null;
  if (status.trialEndsAt) {
    const end = new Date(status.trialEndsAt).getTime();
    const now = Date.now();
    daysLeft = Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));
  }

  // El banner de trial siempre manda directo a /panel/suscripcion para
  // inscribir tarjeta. Los datos de facturación se piden DESPUÉS, cuando
  // ya pagó el primer mes (banner separado en /panel/suscripcion).
  const ctaHref = "/panel/suscripcion";
  const ctaLabel = "Inscribir tarjeta";

  const isUrgent = (daysLeft ?? 999) <= 2;
  const bg = isUrgent
    ? "linear-gradient(90deg, #FEE2E2 0%, #FEF3C7 100%)"
    : "linear-gradient(90deg, #FEF3C7 0%, #FFF8E7 100%)";
  const border = isUrgent ? "#fca5a5" : "#fcd34d";
  const fg = isUrgent ? "#991b1b" : "#92400e";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
      background: bg, border: `1px solid ${border}`, borderRadius: 10, margin: "12px 16px 0",
      fontFamily: "var(--font-body)", fontSize: "0.84rem", color: fg,
    }}>
      <span style={{ fontSize: 20 }}>{isUrgent ? "⏰" : "🎁"}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, margin: 0, fontSize: "0.88rem" }}>
          {daysLeft === null
            ? "Estás en prueba gratis"
            : daysLeft === 0
              ? "¡Tu prueba vence hoy!"
              : daysLeft === 1
                ? "Te queda 1 día de prueba"
                : `Te quedan ${daysLeft} días de prueba`}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: "0.78rem", opacity: 0.85 }}>
          Inscribe tu tarjeta para no perder tu plan {status.plan === "PREMIUM" ? "Premium" : "Gold"}.
        </p>
      </div>
      <a href={ctaHref} style={{
        padding: "8px 14px", border: "none", borderRadius: 999,
        background: isUrgent ? "#dc2626" : "#F4A623", color: "#fff",
        fontFamily: "var(--font-display)", fontSize: "0.78rem", fontWeight: 700,
        textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0,
      }}>{ctaLabel} →</a>
    </div>
  );
}

function UpgradeBanner({ restaurantId }: { restaurantId: string | null }) {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    const stored = sessionStorage.getItem("upgrade-banner-dismissed");
    if (stored === restaurantId) { setDismissed(true); return; }
    fetch(`/api/billing/status?restaurantId=${restaurantId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setStatus(d))
      .catch(() => {});
  }, [restaurantId]);

  if (dismissed || !status) return null;
  if (status.plan !== "FREE" || status.billingExempt || status.subscriptionStatus !== "NONE") return null;

  const handleClick = () => window.dispatchEvent(new CustomEvent("show-plan-modal"));
  const handleDismiss = () => {
    if (restaurantId) sessionStorage.setItem("upgrade-banner-dismissed", restaurantId);
    setDismissed(true);
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
      background: "linear-gradient(90deg, #FFF8E7 0%, #FFFCF5 100%)",
      border: "1px solid #fde68a", borderRadius: 10, margin: "12px 16px 0",
      fontFamily: "var(--font-body)", fontSize: "0.82rem", color: "#92400e",
    }}>
      <span style={{ fontSize: 18 }}>🎁</span>
      <span style={{ flex: 1 }}>
        Prueba <strong>Gold gratis por 7 días</strong> y desbloquea estadísticas, ofertas, multilenguaje y más.
      </span>
      <button onClick={handleClick} style={{
        padding: "6px 14px", border: "none", borderRadius: 999,
        background: "#F4A623", color: "#fff", fontFamily: "var(--font-display)",
        fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
      }}>Probar ahora</button>
      <button onClick={handleDismiss} aria-label="Cerrar" style={{
        background: "none", border: "none", color: "#92400e", fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1,
      }}>×</button>
    </div>
  );
}

function formatDateCL(d: string | null) {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString("es-CL", { day: "numeric", month: "long" });
}

function PlanModal({ plan, restaurantId, initialTab, onClose }: { plan: string; restaurantId: string | null; initialTab?: "GOLD" | "PREMIUM"; onClose: () => void }) {
  // initialTab gana — viene del PlanGate cuando el usuario clickea una feature bloqueada.
  // Si el plan actual del usuario coincide con el initialTab, abrimos el OTRO tab para
  // mostrarle el upgrade real (ej: usuario Gold ve feature Premium → abre Premium).
  // Fallback: si no hay initialTab, abrimos el plan actual (o Gold si es FREE).
  const defaultTab: "GOLD" | "PREMIUM" = initialTab
    ? (initialTab === plan ? (plan === "GOLD" ? "PREMIUM" : "GOLD") : initialTab)
    : (plan === "FREE" ? "GOLD" : plan as any);
  const [tab, setTab] = useState<"GOLD" | "PREMIUM">(defaultTab);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const FD = "var(--font-display)";
  const FB2 = "var(--font-body)";
  const features = PLAN_FEATURES_DISPLAY[tab] || [];
  const isCurrentPlan = plan === tab;

  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/billing/status?restaurantId=${restaurantId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setStatus(d))
      .catch(() => {});
  }, [restaurantId]);

  const handleSubscribe = async () => {
    if (!restaurantId || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/billing/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, plan: tab }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        toast.error(data.error || "No se pudo iniciar la suscripción");
        setSubmitting(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error("Error de conexion");
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!restaurantId || cancelling) return;
    if (!window.confirm("¿Seguro que quieres cancelar tu suscripción? Mantendrás acceso hasta el final del periodo pagado.")) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, atPeriodEnd: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "No se pudo cancelar");
        setCancelling(false);
        return;
      }
      toast.success("Suscripción cancelada. Mantienes acceso hasta el final del periodo.");
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      toast.error("Error de conexión");
      setCancelling(false);
    }
  };

  const inTrial = status?.subscriptionStatus === "TRIALING";
  const isActive = status?.subscriptionStatus === "ACTIVE";
  const isCanceled = status?.subscriptionStatus === "CANCELED";
  const showCancelButton = isCurrentPlan && (inTrial || isActive) && status?.hasSubscription;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 24, maxWidth: 400, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #f0f0f0", position: "sticky", top: 0, background: "#fff", borderRadius: "24px 24px 0 0", zIndex: 1 }}>
          {(["GOLD", "PREMIUM"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "16px 0", border: "none", cursor: "pointer",
              fontFamily: FD, fontSize: "0.88rem", fontWeight: 700, background: "transparent",
              color: tab === t ? (t === "PREMIUM" ? "#7c3aed" : "#92400e") : "#ccc",
              borderBottom: tab === t ? `3px solid ${t === "PREMIUM" ? "#7c3aed" : "#F4A623"}` : "3px solid transparent",
            }}>
              {t === "GOLD" ? "⭐ Gold" : "💎 Premium"}
              {plan === t && <span style={{ marginLeft: 6, fontSize: "0.6rem", fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: t === "PREMIUM" ? "#F3E8FF" : "#FFF8E7", color: t === "PREMIUM" ? "#7c3aed" : "#92400e" }}>Tu plan</span>}
            </button>
          ))}
        </div>

        <div style={{ padding: "20px 24px 24px" }}>
          {/* Current plan indicator + billing status */}
          {isCurrentPlan && (
            <div style={{ textAlign: "center", marginBottom: 14, padding: "10px 16px", background: tab === "PREMIUM" ? "#F3E8FF" : "#FFF8E7", borderRadius: 10 }}>
              <p style={{ fontFamily: FD, fontSize: "0.82rem", fontWeight: 600, color: tab === "PREMIUM" ? "#7c3aed" : "#92400e", margin: 0 }}>
                ✓ Este es tu plan actual
              </p>
              {inTrial && status?.trialEndsAt && (
                <p style={{ fontFamily: FB2, fontSize: "0.72rem", color: "#666", margin: "4px 0 0" }}>
                  Estás en prueba gratis · Primer cobro: {formatDateCL(status.trialEndsAt)}
                </p>
              )}
              {isActive && status?.currentPeriodEnd && (
                <p style={{ fontFamily: FB2, fontSize: "0.72rem", color: "#666", margin: "4px 0 0" }}>
                  Próximo cobro: {formatDateCL(status.currentPeriodEnd)}
                </p>
              )}
              {isCanceled && status?.currentPeriodEnd && (
                <p style={{ fontFamily: FB2, fontSize: "0.72rem", color: "#dc2626", margin: "4px 0 0" }}>
                  Cancelada · Termina el {formatDateCL(status.currentPeriodEnd)}
                </p>
              )}
            </div>
          )}

          {/* Description + Price */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <p style={{ fontFamily: FB2, fontSize: "0.85rem", color: "#555", lineHeight: 1.5, margin: "0 0 6px" }}>
              {PLAN_TAGLINES[tab]}
            </p>
            {(() => {
              const net = planNetAmount(tab);
              const iva = ivaOf(net);
              const gross = grossOf(net);
              const fmt = (n: number) => `$${n.toLocaleString("es-CL")}`;
              return (
                <>
                  <span style={{ fontFamily: FD, fontSize: "2rem", fontWeight: 700, color: "#1a1a1a" }}>{fmt(net)}</span>
                  <span style={{ fontFamily: FB2, fontSize: "0.85rem", color: "#999", marginLeft: 4 }}>/mes neto</span>
                  <p style={{ fontFamily: FB2, fontSize: "0.78rem", color: "#666", margin: "4px 0 0" }}>
                    + IVA 19% ({fmt(iva)}) = <strong style={{ color: "#1a1a1a" }}>{fmt(gross)}</strong> total mensual
                  </p>
                  <p style={{ fontFamily: FB2, fontSize: "0.7rem", color: "#bbb", margin: "2px 0 0" }}>Sin contratos · Cancelas cuando quieras</p>
                </>
              );
            })()}
          </div>

          {/* Features */}
          <div style={{
            background: tab === "PREMIUM" ? "#FAFAFE" : "#FFFCF5",
            borderRadius: 12, padding: "14px 16px", marginBottom: 18,
            border: `1px solid ${tab === "PREMIUM" ? "#e9d5ff" : "#fde68a"}`,
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <PlanFeatureRow
                text={PLAN_INHERITS_FROM[tab]}
                tip={`Incluye todas las funciones del plan ${tab === "PREMIUM" ? "Gold" : "Gratis"}`}
                color={tab === "PREMIUM" ? "#7c3aed" : "#F4A623"}
              />
              {features.map(f => (
                <PlanFeatureRow key={f.text} text={f.text} tip={f.tip} color={tab === "PREMIUM" ? "#7c3aed" : "#F4A623"} />
              ))}
            </div>
          </div>

          {/* CTA */}
          {!isCurrentPlan ? (
            <button
              onClick={handleSubscribe}
              disabled={submitting || !restaurantId}
              style={{
                display: "block", width: "100%", padding: "14px 20px", borderRadius: 999, textAlign: "center",
                background: submitting ? "#ccc" : tab === "PREMIUM" ? "#7c3aed" : "#F4A623",
                color: "#fff", fontFamily: FD, fontSize: "0.92rem", fontWeight: 700,
                textDecoration: "none", marginBottom: 8, border: "none",
                cursor: submitting ? "wait" : "pointer",
                boxShadow: tab === "PREMIUM" ? "0 4px 16px rgba(124,58,237,0.3)" : "0 4px 16px rgba(244,166,35,0.3)",
              }}
            >
              {submitting ? "Redirigiendo a Webpay…" : "Empezar prueba gratis 7 días"}
            </button>
          ) : (
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <p style={{ fontFamily: FB2, fontSize: "0.78rem", color: "#999", margin: 0 }}>Estás disfrutando de este plan</p>
            </div>
          )}
          {showCancelButton && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              style={{
                display: "block", width: "100%", background: "transparent", color: "#dc2626",
                fontFamily: FD, fontSize: "0.82rem", fontWeight: 600, cursor: cancelling ? "wait" : "pointer",
                padding: "10px 0", border: "1px solid #fca5a5", borderRadius: 999, marginBottom: 8,
              }}
            >
              {cancelling ? "Cancelando…" : "Cancelar suscripción"}
            </button>
          )}
          <button onClick={onClose} style={{ display: "block", width: "100%", background: "none", border: "none", color: "#999", fontFamily: FD, fontSize: "0.82rem", cursor: "pointer", padding: "8px 0" }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { name, loading, error, logout, restaurants, selectedRestaurantId, setSelectedRestaurant, role, mustChangePassword, clearMustChangePassword, activePlan } = usePanelSession();
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [demoScrolled, setDemoScrolled] = useState(false);
  const [demoTip, setDemoTip] = useState(false);

  // Auto-tag gold buttons for dark mode softening
  useEffect(() => {
    const tag = () => {
      document.querySelectorAll("button").forEach(btn => {
        const bg = getComputedStyle(btn).backgroundColor;
        if (bg === "rgb(244, 166, 35)" && !btn.classList.contains("qc-gold-btn")) {
          btn.classList.add("qc-gold-btn");
        }
      });
    };
    tag();
    const observer = new MutationObserver(tag);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // Demo banner scroll effect — must be before any early returns
  const selectedRestEarly = restaurants.find((r: any) => r.id === selectedRestaurantId);
  const isDemoEarly = !!selectedRestEarly?.isDemo;
  useEffect(() => {
    if (!isDemoEarly) { setDemoScrolled(false); return; }
    const onScroll = () => setDemoScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isDemoEarly]);
  const [planModalInitialTab, setPlanModalInitialTab] = useState<"GOLD" | "PREMIUM" | undefined>(undefined);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.initialTab === "GOLD" || detail?.initialTab === "PREMIUM") {
        setPlanModalInitialTab(detail.initialTab);
      } else {
        setPlanModalInitialTab(undefined);
      }
      setPlanModalOpen(true);
    };
    window.addEventListener("show-plan-modal", handler);
    return () => window.removeEventListener("show-plan-modal", handler);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const billing = params.get("billing");
    if (!billing) return;
    if (billing === "success") {
      const plan = params.get("plan");
      toast.success(`Suscripción activada${plan ? ` (${plan})` : ""} · 7 días gratis`);
    } else if (billing === "error") {
      const reason = params.get("reason");
      toast.error(`No se pudo completar la inscripción${reason ? ` (${reason})` : ""}. Intenta de nuevo.`);
    }
    params.delete("billing");
    params.delete("plan");
    params.delete("reason");
    const newSearch = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}`);
  }, []);

  if (PUBLIC_PATHS.includes(pathname)) return <>{children}</>;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--adm-bg, #0e0e0e)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative", fontSize: "2.2rem", animation: "panelLoadFloat 1.5s ease-in-out infinite" }}>
            🧞
            <span style={{ position: "absolute", top: -6, right: -14, fontSize: "0.9rem", opacity: 0.5, animation: "panelStarPulse 2s ease-in-out infinite" }}>✨</span>
          </div>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "0.88rem", color: "var(--adm-text3, #555)", fontWeight: 500 }}>Cargando tu panel...</p>
        </div>
        <style>{`
          @keyframes panelLoadFloat { 0%,100% { transform: translateY(0) scale(1); opacity: 0.7; } 50% { transform: translateY(-8px) scale(1.1); opacity: 1; } }
          @keyframes panelStarPulse { 0%,100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 0.7; transform: scale(1.1); } }
        `}</style>
      </div>
    );
  }

  if (error) {
    if (typeof window !== "undefined") window.location.href = "/panel/login";
    return null;
  }

  const ctxValue = {
    role,
    name,
    restaurants,
    selectedRestaurantId,
    isSuper: false,
    loading: false,
    error: false,
    setSelectedRestaurant,
    logout,
  };

  const selectedRest = selectedRestEarly;
  const isDemo = isDemoEarly;

  return (
    <SessionContext.Provider value={ctxValue}>
      {isDemo && selectedRest && (
        <div style={{ position: "sticky", top: 0, zIndex: 150, padding: "18px 14px 18px", background: "rgba(3,3,3,.95)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", boxShadow: "0 12px 30px rgba(0,0,0,.5)", overflow: "visible", fontFamily: "var(--font-body)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span onClick={() => setDemoTip(t => !t)} style={{ height: 38, padding: "0 14px", borderRadius: 999, background: "rgba(255,178,45,.12)", border: "1px solid rgba(255,178,45,.2)", color: "#ffb22d", fontSize: 11, fontWeight: 950, letterSpacing: ".8px", fontFamily: "var(--font-body)", display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", position: "relative" }}>
              <span style={{ width: 14, height: 14, borderRadius: "50%", background: "rgba(255,178,45,.25)", display: "inline-grid", placeItems: "center", fontFamily: "Georgia, serif", fontSize: 9, fontWeight: 700, color: "#ffb22d" }}>i</span>
              PANEL DEMO
              {demoTip && (
                <>
                  <div onClick={(e) => { e.stopPropagation(); setDemoTip(false); }} style={{ position: "fixed", inset: 0, zIndex: 69 }} />
                  <div style={{
                    position: "absolute", top: "calc(100% + 8px)", left: 0,
                    background: "#1a1a1a", border: "1px solid rgba(255,178,45,0.3)", borderRadius: 10,
                    padding: "10px 14px", width: 240, zIndex: 70,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  }}>
                    <div style={{
                      position: "absolute", top: -5, left: 16,
                      width: 10, height: 10, background: "#1a1a1a", borderTop: "1px solid rgba(255,178,45,0.3)", borderLeft: "1px solid rgba(255,178,45,0.3)",
                      transform: "rotate(45deg)",
                    }} />
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: 0, lineHeight: 1.5, fontWeight: 400, letterSpacing: 0 }}>
                      Este es un panel de ejemplo con datos ficticios. Al activar tu carta verás tus estadísticas reales.
                    </p>
                  </div>
                </>
              )}
            </span>
            <div style={{ display: "flex", gap: 7 }}>
              <a href={`/qr/${selectedRest.slug}`} style={{ border: "1px solid rgba(255,255,255,.11)", borderRadius: 999, height: 38, padding: "0 13px", fontSize: 13, fontWeight: 900, background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.55)", display: "flex", alignItems: "center", gap: 5, textDecoration: "none", whiteSpace: "nowrap" }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>Ver carta</a>
              <a href={`/activar/${selectedRest.slug}`} style={{ border: 0, borderRadius: 999, height: 38, padding: "0 13px", fontSize: 13, fontWeight: 900, background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", display: "flex", alignItems: "center", textDecoration: "none", whiteSpace: "nowrap" }}>Activar →</a>
            </div>
          </div>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, transform: "translateY(100%)", padding: "9px 14px", background: "linear-gradient(135deg, #f59e0b, #d97706)", textAlign: "center" }}>
            <span className="demo-ribbon-full" style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Datos de ejemplo · Al activar verás tus estadísticas reales</span>
            <span className="demo-ribbon-short" style={{ fontSize: 13, fontWeight: 700, color: "#fff", display: "none" }}>Al activar verás tus datos reales</span>
            <style>{`@media (max-width: 420px) { .demo-ribbon-full { display: none !important; } .demo-ribbon-short { display: inline !important; } }`}</style>
            <span style={{ position: "absolute", right: 44, top: -5, width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderBottom: "6px solid #d97706" }} />
          </div>
        </div>
      )}
      <div style={{ paddingTop: isDemo ? 44 : 0, background: isDemo ? "var(--adm-card)" : undefined }}>
      <AdminLayoutOwner
        name={name}
        restaurants={restaurants}
        selectedRestaurantId={selectedRestaurantId}
        setSelectedRestaurant={setSelectedRestaurant}
        logout={logout}
        basePath="/panel"
        activePlan={activePlan}
        isDemo={isDemo}
      >
        {!isDemo && (
          <>
            <TrialBanner restaurantId={selectedRestaurantId} />
            <UpgradeBanner restaurantId={selectedRestaurantId} />
          </>
        )}
        {children}
      </AdminLayoutOwner>
      </div>

      {/* Plan modal — triggered from "Mi Plan" menu */}
      {planModalOpen && (
        <PlanModal plan={activePlan} restaurantId={selectedRestaurantId || null} initialTab={planModalInitialTab} onClose={() => setPlanModalOpen(false)} />
      )}
    </SessionContext.Provider>
  );
}
