"use client";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import { SessionContext } from "@/lib/admin/SessionContext";
import AdminLayoutOwner from "@/components/admin/layouts/AdminLayoutOwner";
import { toast } from "sonner";
import { trackFunnelEventBySlug, beaconFunnelEvent } from "@/lib/funnelTracker";
import {
  PLAN_FEATURES_DISPLAY,
  PLAN_INHERITS_FROM,
  PLAN_TAGLINES,
  planNetAmount,
  ivaOf,
  grossOf,
} from "@/lib/billing/plans-config";
import { PanelLangProvider, usePanelLang } from "@/lib/i18n/panel";

const PUBLIC_PATHS = ["/panel/login", "/panel/forgot-password", "/panel/reset-password", "/panel/invite", "/panel/suscripcion/exito"];

function ForceChangePasswordModal({ onDone }: { onDone: () => void }) {
  const F = "var(--font-display)";
  const GOLD = "#F4A623";
  const { t } = usePanelLang();
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
    if (!currentPassword || !newPassword || !confirmPassword) { setError(t("pw_all_required")); return; }
    if (newPassword.length < 8) { setError(t("pw_min_length")); return; }
    if (!/\d/.test(newPassword)) { setError(t("pw_need_number")); return; }
    if (newPassword !== confirmPassword) { setError(t("passwords_mismatch")); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/panel/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t("pw_change_error")); setSaving(false); return; }
      toast.success(t("pw_updated"));
      onDone();
    } catch { setError(t("connection_error")); }
    setSaving(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, padding: 28, width: "100%", maxWidth: 380, boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 40 }}>🔐</span>
          <h2 style={{ fontFamily: F, fontSize: "1.1rem", color: "#1a1a1a", margin: "8px 0 4px" }}>{t("pw_required_title")}</h2>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#8a7550", margin: 0 }}>{t("pw_required_desc")}</p>
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
            <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#dc2626", margin: 0 }}>{error}</p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "#8a7550", marginBottom: 4, textTransform: "uppercase", letterSpacing: "1px" }}>{t("current_password")}</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder={t("pw_temp_placeholder")} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "#8a7550", marginBottom: 4, textTransform: "uppercase", letterSpacing: "1px" }}>{t("new_password")}</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={t("pw_new_placeholder")} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "#8a7550", marginBottom: 4, textTransform: "uppercase", letterSpacing: "1px" }}>{t("confirm_password")}</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder={t("pw_confirm_placeholder")} style={inputStyle} />
          </div>
          <button onClick={handleSubmit} disabled={saving} style={{
            width: "100%", height: 44, marginTop: 4,
            background: saving ? "#E8A942" : GOLD,
            color: "white", fontFamily: F, fontSize: "0.88rem", fontWeight: 700,
            border: "none", borderRadius: 8, cursor: saving ? "wait" : "pointer",
          }}>
            {saving ? t("saving") : t("change_password")}
          </button>
        </div>
      </div>
    </div>
  );
}


function PlanFeatureRow({ text, tip, color }: { text: string; tip: string; color: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        <span style={{ color, fontSize: "0.9rem", flexShrink: 0 }}>✓</span>
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.88rem", color: "var(--adm-text, #333)", flex: 1 }}>{text}</span>
        <span style={{ width: 20, height: 20, borderRadius: "50%", background: open ? `${color}` : `${color}20`, color: open ? "#fff" : color, fontSize: "11px", fontWeight: 800, fontStyle: "italic", fontFamily: "Georgia,serif", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s", border: `1px solid ${color}30` }}>i</span>
      </div>
      {open && <p style={{ margin: "6px 0 2px 24px", fontSize: "0.82rem", color: "var(--adm-text2, #888)", lineHeight: 1.5 }}>{tip}</p>}
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
  trialUsed?: boolean;
  lastPaymentAt?: string | null;
  sessions30d?: number;
};

export function TrialBanner({ restaurantId, plan: propPlan, trialEndsAt: propTrialEnds, subscriptionStatus: propStatus }: { restaurantId: string | null; plan?: string; trialEndsAt?: string | null; subscriptionStatus?: string }) {
  const [status, setStatus] = useState<BillingStatus | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/billing/status?restaurantId=${restaurantId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setStatus(d))
      .catch(() => {});
  }, [restaurantId]);

  // Use props if available (instant), fall back to fetched status
  const effectivePlan = status?.plan || propPlan;
  const effectiveStatus = status?.subscriptionStatus || propStatus;
  const effectiveTrialEnds = status?.trialEndsAt || propTrialEnds;

  if (!effectivePlan || !effectiveStatus) return null;
  if (effectiveStatus !== "TRIALING") return null;
  if (status?.hasSubscription) return null;
  if (status?.billingExempt) return null;

  // Calcular dias restantes
  let daysLeft: number | null = null;
  if (effectiveTrialEnds) {
    const end = new Date(effectiveTrialEnds).getTime();
    const now = Date.now();
    daysLeft = Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));
  }

  // El banner de trial siempre manda directo a /panel/suscripcion para
  // inscribir tarjeta. Los datos de facturación se piden DESPUÉS, cuando
  // ya pagó el primer mes (banner separado en /panel/suscripcion).
  const ctaHref = "/panel/suscripcion";
  const ctaLabel = "Inscribir tarjeta";

  const isUrgent = (daysLeft ?? 999) <= 2;

  const isPremium = effectivePlan === "PREMIUM";
  const planLabel = isPremium ? "Premium" : "Gold";

  return (
    <>
    <style dangerouslySetInnerHTML={{ __html: `
      .trial-banner { display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:10px; margin:6px 0 26px; font-size:0.84rem; }
      .trial-banner.premium { background:rgba(168,85,247,.08); border:1px solid rgba(168,85,247,.2); color:#a855f7; }
      .trial-banner.gold { background:rgba(232,163,61,.08); border:1px solid rgba(232,163,61,.2); color:#E8A33D; }
      .trial-banner.urgent { background:rgba(220,38,38,.1); border:1px solid rgba(220,38,38,.25); color:#f87171; }
      .trial-banner .trial-sub { color:#C9BBA0; }
      .trial-banner.urgent .trial-sub { color:#fca5a5; }
      @media (prefers-color-scheme: light) {
        .trial-banner.premium { background:rgba(168,85,247,.06); border-color:rgba(168,85,247,.25); color:#7c3aed; }
        .trial-banner.gold { background:rgba(232,163,61,.06); border-color:rgba(232,163,61,.25); color:#b8801a; }
        .trial-banner.urgent { background:rgba(220,38,38,.06); border-color:rgba(220,38,38,.25); color:#dc2626; }
        .trial-banner .trial-sub { color:#888; }
        .trial-banner.urgent .trial-sub { color:#ef4444; }
      }
      [data-theme="light"] .trial-banner.premium { background:rgba(168,85,247,.06); border-color:rgba(168,85,247,.25); color:#7c3aed; }
      [data-theme="light"] .trial-banner.gold { background:rgba(232,163,61,.06); border-color:rgba(232,163,61,.25); color:#b8801a; }
      [data-theme="light"] .trial-banner.urgent { background:rgba(220,38,38,.06); border-color:rgba(220,38,38,.25); color:#dc2626; }
      [data-theme="light"] .trial-banner .trial-sub { color:#888; }
      [data-theme="light"] .trial-banner.urgent .trial-sub { color:#ef4444; }
    `}} />
    <div className={`trial-banner ${isUrgent ? "urgent" : isPremium ? "premium" : "gold"}`} style={{ fontFamily: "var(--font-body)" }}>
      <span style={{ fontSize: 20 }}>{isUrgent ? "⏰" : "🎁"}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, margin: 0, fontSize: "0.88rem" }}>
          {daysLeft === null
            ? `Plan ${planLabel}`
            : daysLeft === 0
              ? "Tu prueba termina hoy"
              : daysLeft === 1
                ? "Te queda 1 día de prueba"
                : `Plan ${planLabel} · ${daysLeft} días gratis`}
        </p>
        <p className="trial-sub" style={{ margin: "2px 0 0", fontSize: "0.78rem", opacity: 0.7 }}>
          {isUrgent ? "Activa tu suscripción para no perder las funciones." : "Luego de los días gratis tu plan pasa a Gratis. No pierdes nada, puedes seguir usando nuestro servicio."}
        </p>
      </div>
    </div>
    </>
  );
}

function ExpiryBanner({ restaurantId }: { restaurantId: string | null }) {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const { t } = usePanelLang();

  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/billing/status?restaurantId=${restaurantId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setStatus(d))
      .catch(() => {});
  }, [restaurantId]);

  if (!status || status.billingExempt) return null;

  const now = new Date();
  const periodEnd = status.currentPeriodEnd ? new Date(status.currentPeriodEnd) : null;

  // Comparar por fecha calendario Chile para que coincida con lo que ve el usuario
  const toChileDate = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(d);
  const todayChile = toChileDate(now);
  const periodEndChile = periodEnd ? toChileDate(periodEnd) : null;
  const isToday = periodEndChile === todayChile;
  const isTomorrow = periodEndChile === toChileDate(new Date(now.getTime() + 86400000));
  const in2Days = periodEndChile === toChileDate(new Date(now.getTime() + 2 * 86400000));

  // Activo y a punto de vencer (hoy, mañana o pasado mañana)
  const isExpiringSoon = status.subscriptionStatus === "ACTIVE" && (isToday || isTomorrow || in2Days);
  // Activo pero el período ya pasó en un día anterior (pendiente de corte, cron aún no corrió)
  // Comparamos por fecha calendario, no por hora — hoy aún está vigente hasta las 23:59
  const isExpiredActive = status.subscriptionStatus === "ACTIVE" && periodEndChile !== null && periodEndChile < todayChile;
  // Ya cortado (bajó a FREE después de no pagar) o siempre fue gratis
  const wasDowngraded = status.plan === "FREE" && status.subscriptionStatus === "NONE" && !!status.lastPaymentAt;
  const isFreePlan = status.plan === "FREE" && status.subscriptionStatus === "NONE" && !status.lastPaymentAt;

  if (!isExpiringSoon && !isExpiredActive && !wasDowngraded && !isFreePlan) return null;

  const isExpired = isExpiredActive || wasDowngraded;

  // FREE sin plan pago previo → invitar al trial Premium
  if (isFreePlan) {
    const handleTrial = () => window.dispatchEvent(new CustomEvent("show-plan-modal", {
      detail: { initialTab: "PREMIUM", source: "expiry_banner_trial" },
    }));
    return (
      <div className="qc-expiry-sticky">
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 16px",
          background: "linear-gradient(90deg, #6d28d9, #7c3aed)",
          fontFamily: "var(--font-body)",
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>✨</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, margin: 0, fontSize: "0.84rem", color: "#fff" }}>Prueba Premium 7 días gratis</p>
            <p style={{ margin: "1px 0 0", fontSize: "0.76rem", color: "rgba(255,255,255,0.8)" }}>Pedidos online, estadísticas avanzadas y más. Sin tarjeta.</p>
          </div>
          <button
            onClick={handleTrial}
            style={{
              padding: "7px 14px", border: "2px solid rgba(255,255,255,0.7)", borderRadius: 999,
              background: "transparent", color: "#fff",
              fontFamily: "var(--font-display)", fontSize: "0.78rem", fontWeight: 700,
              cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            Empezar gratis
          </button>
        </div>
      </div>
    );
  }

  let title: string;
  let sub: string;
  let bannerColor: string;
  let btnLabel: string;
  if (isExpired) {
    title = t("menu_offline");
    sub = t("menu_offline_sub");
    bannerColor = "#dc2626";
    btnLabel = t("renew_now");
  } else if (isToday) {
    title = t("plan_expires_today");
    sub = t("plan_expires_today_sub");
    bannerColor = "#dc2626";
    btnLabel = t("renew_now");
  } else if (isTomorrow) {
    title = t("plan_expires_tomorrow");
    sub = t("plan_expires_tomorrow_sub");
    bannerColor = "#dc2626";
    btnLabel = t("renew_now");
  } else {
    // in2Days
    title = "Tu plan vence en 2 días";
    sub = "Renueva ahora para no perder el acceso a tus funciones.";
    bannerColor = "#d97706";
    btnLabel = t("renew_now");
  }

  const currentPlan = status.plan as "FREE" | "GOLD" | "PREMIUM" | undefined;
  const handleRenew = () => window.dispatchEvent(new CustomEvent("show-plan-modal", {
    detail: { renew: !isFreePlan, initialTab: isFreePlan ? "GOLD" : currentPlan },
  }));

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .qc-expiry-sticky {
          position: sticky;
          top: 0;
          z-index: 99;
          margin: -24px -32px 24px;
        }
        @media (max-width: 767px) {
          .qc-expiry-sticky {
            top: 64px;
            margin: -20px -16px 20px;
          }
        }
      `}} />
      <div className="qc-expiry-sticky">
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 16px",
          background: bannerColor,
          fontFamily: "var(--font-body)",
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, margin: 0, fontSize: "0.84rem", color: "#fff" }}>{title}</p>
            <p style={{ margin: "1px 0 0", fontSize: "0.76rem", color: "rgba(255,255,255,0.85)" }}>{sub}</p>
          </div>
          <button
            onClick={handleRenew}
            style={{
              padding: "7px 14px", border: "2px solid rgba(255,255,255,0.7)", borderRadius: 999,
              background: "transparent", color: "#fff",
              fontFamily: "var(--font-display)", fontSize: "0.78rem", fontWeight: 700,
              cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            {btnLabel}
          </button>
        </div>
      </div>
    </>
  );
}

function UpgradeBanner({ restaurantId }: { restaurantId: string | null }) {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const { t } = usePanelLang();

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
        {t("upgrade_mejora")} <strong>Gold desde $29.900/mes</strong> {t("upgrade_banner").replace("Gold desde $29.900/mes y ", "")}
      </span>
      <button onClick={handleClick} style={{
        padding: "6px 14px", border: "none", borderRadius: 999,
        background: "#F4A623", color: "#fff", fontFamily: "var(--font-display)",
        fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
      }}>{t("try_now")}</button>
      <button onClick={handleDismiss} aria-label={t("close")} style={{
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

function PlanModal({ plan, restaurantId, initialTab, renewMode, context, onClose }: { plan: string; restaurantId: string | null; initialTab?: "FREE" | "GOLD" | "PREMIUM"; renewMode?: boolean; context?: string; onClose: () => void }) {
  const { t } = usePanelLang();
  const ALL_TABS = ["GOLD", "PREMIUM"] as const;
  type TabKey = typeof ALL_TABS[number];
  // renewMode: abrir directo en el plan actual (sin swap a otro plan)
  const defaultTab: TabKey = renewMode && initialTab && initialTab !== "FREE"
    ? initialTab as TabKey
    : initialTab && initialTab !== "FREE"
    ? (initialTab === plan ? "PREMIUM" : initialTab) as TabKey
    : "GOLD";
  const [tab, setTab] = useState<TabKey>(defaultTab);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  // renewMode + initialTab → ir directo al overlay de pago, sin pasar por selección de plan
  const [confirmTab, setConfirmTab] = useState<TabKey | null>(
    renewMode && initialTab && initialTab !== "FREE" ? initialTab as TabKey : null
  );
  const [payerEmail, setPayerEmail] = useState("");
  const [status, setStatus] = useState<BillingStatus & { customPlanPriceNet?: number | null; mpPayerEmail?: string | null } | null>(null);
  const FD = "var(--font-display)";
  const FB2 = "var(--font-body)";
  const features = PLAN_FEATURES_DISPLAY[tab] || [];
  const isCurrentPlan = plan === tab;

  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/billing/status?restaurantId=${restaurantId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setStatus(d); if (d.mpPayerEmail) setPayerEmail(d.mpPayerEmail); } })
      .catch(() => {});
  }, [restaurantId]);

  const handleSubscribe = async () => {
    if (!restaurantId || submitting) return;
    setSubmitting(true);
    fetch("/api/panel/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, action: "plan_subscribe_clicked", details: { plan: tab, currentPlan: plan } }) }).catch(() => {});
    try {
      // Premium: activate 7-day trial directly — available to all FREE plan users
      if (tab === "PREMIUM" && plan !== "PREMIUM") {
        const res = await fetch("/api/billing/start-trial", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "No se pudo activar la prueba");
          setSubmitting(false);
          return;
        }
        toast.success("¡Premium activado! 7 días gratis.");
        setTimeout(() => window.location.reload(), 1200);
        return;
      }
      // Gold/Premium (paid): go through MercadoPago
      const res = await fetch("/api/billing/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, plan: tab }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        if (res.status === 401 || res.status === 403) {
          toast.error("Tu sesión expiró. Recarga la página e inicia sesión de nuevo.");
        } else {
          toast.error(data.error || "No se pudo iniciar la suscripción");
        }
        setSubmitting(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error("Error de conexión");
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!restaurantId || cancelling) return;
    if (!window.confirm("¿Seguro que quieres cancelar tu plan? Mantendrás acceso hasta el final del periodo pagado.")) return;
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
      toast.success("Plan cancelado. Mantienes acceso hasta el final del periodo.");
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      toast.error("Error de conexión");
      setCancelling(false);
    }
  };

  // Custom price override (per-restaurant, applies to their current plan key)
  const customNet = status?.customPlanPriceNet;
  const resolveNet = (t: TabKey) => (customNet && t === plan) ? customNet : planNetAmount(t);

  const inTrial = status?.subscriptionStatus === "TRIALING";
  const trialUsed = !!status?.trialUsed;
  const isActive = status?.subscriptionStatus === "ACTIVE";
  const isCanceled = status?.subscriptionStatus === "CANCELED";
  const showCancelButton = isCurrentPlan && (inTrial || isActive) && status?.hasSubscription;
  // Comparar por fecha calendario — hoy aún permite renovar aunque la hora exacta ya pasó
  const todayUTCStr = new Date().toISOString().slice(0, 10);
  const isEarlyRenewal = isCurrentPlan && isActive && !!status?.currentPeriodEnd &&
    new Date(status.currentPeriodEnd).toISOString().slice(0, 10) >= todayUTCStr;
  // Fecha en que comenzaría el nuevo período si renueva anticipadamente
  const nextPeriodStart = status?.currentPeriodEnd
    ? new Date(status.currentPeriodEnd).toLocaleDateString("es-CL", { day: "numeric", month: "long" })
    : null;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--adm-bg, #fff)", borderRadius: 24, maxWidth: 400, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", border: "1px solid var(--adm-card-border, #eee)", position: "relative", overflow: "hidden" }}>
        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--adm-card-border, #f0f0f0)", position: "sticky", top: 0, background: "var(--adm-bg, #fff)", borderRadius: "24px 24px 0 0", zIndex: 1 }}>
          {ALL_TABS.map(t => {
            const tabColor = t === "PREMIUM" ? "#7c3aed" : t === "GOLD" ? "#92400e" : "#22c55e";
            const tabBorder = t === "PREMIUM" ? "#7c3aed" : t === "GOLD" ? "#F4A623" : "#22c55e";
            const tabBg = t === "PREMIUM" ? "#F3E8FF" : t === "GOLD" ? "#FFF8E7" : "#F0FDF4";
            const tabIcon = t === "PREMIUM" ? "💎" : t === "GOLD" ? "⭐" : "🆓";
            const tabLabel = t.charAt(0) + t.slice(1).toLowerCase();
            return (
              <button key={t} onClick={() => {
                setTab(t); setConfirmTab(null);
                if (restaurantId) fetch("/api/panel/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, action: "plan_tab_viewed", details: { plan: t } }) }).catch(() => {});
              }} style={{
                flex: 1, padding: "14px 0", border: "none", cursor: "pointer",
                fontFamily: FD, fontSize: "0.75rem", fontWeight: 700, background: "transparent",
                color: tab === t ? tabColor : "#ccc",
                borderBottom: tab === t ? `3px solid ${tabBorder}` : "3px solid transparent",
              }}>
                {tabIcon} {tabLabel}
              </button>
            );
          })}
        </div>

        <div style={{ padding: "20px 24px 24px" }}>
          {/* Current plan indicator + billing status */}
          {isCurrentPlan && (
            <div style={{ textAlign: "center", marginBottom: 14, padding: "10px 16px", background: tab === "PREMIUM" ? "#F3E8FF" : tab === "GOLD" ? "#FFF8E7" : "#F1F5F9", borderRadius: 10 }}>
              <p style={{ fontFamily: FD, fontSize: "0.82rem", fontWeight: 600, color: tab === "PREMIUM" ? "#7c3aed" : tab === "GOLD" ? "#92400e" : "#475569", margin: 0 }}>
                ✓ Este es tu plan actual
              </p>
              {inTrial && status?.trialEndsAt && (
                <p style={{ fontFamily: FB2, fontSize: "0.72rem", color: "#666", margin: "4px 0 0" }}>
                  Prueba gratis hasta el {formatDateCL(status.trialEndsAt)}
                </p>
              )}
              {isActive && status?.currentPeriodEnd && (
                <p style={{ fontFamily: FB2, fontSize: "0.72rem", color: "#666", margin: "4px 0 0" }}>
                  Activo hasta el {formatDateCL(status.currentPeriodEnd)}
                </p>
              )}
              {isCanceled && status?.currentPeriodEnd && (
                <p style={{ fontFamily: FB2, fontSize: "0.72rem", color: "#dc2626", margin: "4px 0 0" }}>
                  Cancelada · Termina el {formatDateCL(status.currentPeriodEnd)}
                </p>
              )}
            </div>
          )}

          {/* Quick plan switch CTAs (solo cuando viendo el plan actual) */}
          {isCurrentPlan && tab === "GOLD" && (
            <button onClick={() => setTab("PREMIUM")} style={{
              display: "block", width: "100%", padding: "11px 0", marginBottom: 14,
              background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)",
              borderRadius: 999, fontFamily: FD, fontSize: "0.82rem", fontWeight: 700,
              color: "#7c3aed", cursor: "pointer",
            }}>
              💎 Mejorar a Premium →
            </button>
          )}
          {isCurrentPlan && tab === "PREMIUM" && (
            <button onClick={() => setTab("GOLD")} style={{
              display: "block", width: "100%", padding: "11px 0", marginBottom: 14,
              background: "rgba(244,166,35,0.08)", border: "1px solid rgba(244,166,35,0.25)",
              borderRadius: 999, fontFamily: FD, fontSize: "0.82rem", fontWeight: 700,
              color: "#92400e", cursor: "pointer",
            }}>
              ⭐ Bajar a Gold →
            </button>
          )}

          {/* Description + Price */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            {PLAN_TAGLINES[tab] && <p style={{ fontFamily: FB2, fontSize: "0.85rem", color: "#555", lineHeight: 1.5, margin: "0 0 6px" }}>
              {PLAN_TAGLINES[tab]}
            </p>}
            {(() => {
              const net = resolveNet(tab);
              const fmt = (n: number) => `$${n.toLocaleString("es-CL")}`;
              return (
                <>
                  <span style={{ fontFamily: FD, fontSize: "2rem", fontWeight: 700, color: "var(--adm-text, #1a1a1a)" }}>{net === 0 ? "$0" : fmt(net)}</span>
                  <span style={{ fontFamily: FB2, fontSize: "0.85rem", color: "var(--adm-text3, #999)", marginLeft: 4 }}>{net === 0 ? "para siempre" : "+ IVA /mes"}</span>
                  {net > 0 && <p style={{ fontFamily: FB2, fontSize: "0.7rem", color: "var(--adm-text3, #bbb)", margin: "6px 0 0" }}>Sin contratos · Cancelas cuando quieras</p>}
                  {tab === "PREMIUM" && !inTrial && plan !== "PREMIUM" && (
                    <div style={{ marginTop: 10, padding: "8px 14px", background: "#7c3aed", borderRadius: 8 }}>
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fff" }}>7 días gratis para probar</span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Features */}
          {(() => {
            const accentColor = tab === "PREMIUM" ? "#7c3aed" : tab === "GOLD" ? "#F4A623" : "#64748b";
            const bgColor = tab === "PREMIUM" ? "rgba(124,58,237,0.06)" : tab === "GOLD" ? "rgba(244,166,35,0.06)" : "rgba(100,116,139,0.06)";
            const borderColor = tab === "PREMIUM" ? "rgba(124,58,237,0.15)" : tab === "GOLD" ? "rgba(244,166,35,0.15)" : "rgba(100,116,139,0.15)";
            return (
          <div style={{
            background: bgColor,
            borderRadius: 12, padding: "14px 16px", marginBottom: 18,
            border: `1px solid ${borderColor}`,
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {context === "featured_dishes" && (tab === "GOLD" || tab === "PREMIUM") && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 12px", borderRadius: 10, marginBottom: 4,
                  background: tab === "PREMIUM" ? "rgba(124,58,237,0.12)" : "rgba(244,166,35,0.12)",
                  border: `1.5px solid ${tab === "PREMIUM" ? "rgba(124,58,237,0.3)" : "rgba(244,166,35,0.3)"}`,
                }}>
                  <span style={{ fontSize: 15, flexShrink: 0 }}>⭐</span>
                  <span style={{ fontFamily: FD, fontSize: "0.8rem", fontWeight: 700, color: accentColor, lineHeight: 1.3 }}>
                    {tab === "PREMIUM" ? "Platos destacados ilimitados" : "Hasta 3 platos destacados"}
                  </span>
                </div>
              )}
              {PLAN_INHERITS_FROM[tab] && (
              <PlanFeatureRow
                text={PLAN_INHERITS_FROM[tab] || ""}
                tip={`Incluye todas las funciones del plan anterior`}
                color={accentColor}
              />
              )}
              {features.map(f => (
                <PlanFeatureRow key={f.text} text={f.text} tip={f.tip} color={accentColor} />
              ))}
            </div>
          </div>
            );
          })()}

          {/* CTA */}
          {!isCurrentPlan ? (
            <button
              onClick={() => setConfirmTab(tab)}
              disabled={!restaurantId}
              style={{
                display: "block", width: "100%", padding: "14px 20px", borderRadius: 999, textAlign: "center",
                background: tab === "PREMIUM" ? "#7c3aed" : tab === "GOLD" ? "#F4A623" : "#475569",
                color: "#fff", fontFamily: FD, fontSize: "0.92rem", fontWeight: 700,
                textDecoration: "none", marginBottom: 8, border: "none",
                cursor: "pointer",
                boxShadow: tab === "PREMIUM" ? "0 4px 16px rgba(124,58,237,0.3)" : tab === "GOLD" ? "0 4px 16px rgba(244,166,35,0.3)" : "0 4px 16px rgba(100,116,139,0.3)",
              }}
            >
              {tab === "PREMIUM" && !inTrial ? "Empezar prueba gratis 7 días" : `Activar ${tab.charAt(0) + tab.slice(1).toLowerCase()}`}
            </button>
          ) : isEarlyRenewal ? (
            <div style={{ marginBottom: 8 }}>
              <button
                onClick={() => setConfirmTab(tab)}
                disabled={!restaurantId}
                style={{
                  display: "block", width: "100%", padding: "14px 20px", borderRadius: 999, textAlign: "center",
                  background: tab === "PREMIUM" ? "#7c3aed" : tab === "GOLD" ? "#F4A623" : "#475569",
                  color: "#fff", fontFamily: FD, fontSize: "0.92rem", fontWeight: 700,
                  border: "none", cursor: "pointer", marginBottom: 8,
                  boxShadow: tab === "PREMIUM" ? "0 4px 16px rgba(124,58,237,0.3)" : tab === "GOLD" ? "0 4px 16px rgba(244,166,35,0.3)" : "0 4px 16px rgba(100,116,139,0.3)",
                }}
              >
                {t("renew_month")}
              </button>
              {nextPeriodStart && (
                <p style={{ fontFamily: FB2, fontSize: "0.72rem", color: "#888", textAlign: "center", margin: 0, lineHeight: 1.4 }}>
                  {t("new_period_starts")} <strong>{nextPeriodStart}</strong> · {t("pay_today")}
                </p>
              )}
            </div>
          ) : (
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <p style={{ fontFamily: FB2, fontSize: "0.78rem", color: "#999", margin: 0 }}>{t("enjoying_plan")}</p>
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
              {cancelling ? t("cancelling") : t("cancel_plan")}
            </button>
          )}
          <button onClick={onClose} style={{ display: "block", width: "100%", background: "none", border: "none", color: "#999", fontFamily: FD, fontSize: "0.82rem", cursor: "pointer", padding: "8px 0" }}>
            {t("close")}
          </button>
        </div>

        {/* Confirmation overlay */}
        {confirmTab && (() => {
          const net = resolveNet(confirmTab);
          const iva = ivaOf(net);
          const gross = grossOf(net);
          const fmt = (n: number) => `$${n.toLocaleString("es-CL")}`;
          const isPremiumTrial = confirmTab === "PREMIUM" && !inTrial && plan !== "PREMIUM";
          const planLabel = confirmTab.charAt(0) + confirmTab.slice(1).toLowerCase();
          return (
            <div style={{ position: "absolute", inset: 0, zIndex: 10, background: "var(--adm-bg, #fff)", borderRadius: 24, display: "flex", flexDirection: "column", justifyContent: "center", padding: "28px 24px" }}>
              <button onClick={() => setConfirmTab(null)} style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", color: "var(--adm-text3, #888)", fontSize: 20, cursor: "pointer" }}>←</button>

              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: confirmTab === "PREMIUM" ? "#7c3aed" : confirmTab === "GOLD" ? "#F4A623" : "#64748b", fontWeight: 700, marginBottom: 8, fontFamily: FD }}>Resumen</div>
                <h3 style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 400, color: "var(--adm-text, #1a1a1a)", margin: 0 }}>Plan {planLabel}</h3>
              </div>

              <div style={{ background: "var(--adm-input, #f5f5f5)", border: "1px solid var(--adm-card-border, #eee)", borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
                {isPremiumTrial ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 16, color: "#7c3aed", fontWeight: 800 }}>
                      <span>{t("trial_days")}</span>
                      <span>$0</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14, color: "var(--adm-text, #333)" }}>
                      <span>{t("monthly")}</span>
                      <span style={{ fontWeight: 700 }}>{fmt(net)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14, color: "var(--adm-text2, #555)" }}>
                      <span>{t("vat")}</span>
                      <span>{fmt(iva)}</span>
                    </div>
                    <div style={{ borderTop: "1px solid var(--adm-card-border, #ddd)", paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, color: "var(--adm-text, #1a1a1a)" }}>
                      <span>{t("total_monthly")}</span>
                      <span>{fmt(gross)}</span>
                    </div>
                  </>
                )}
              </div>

              <div style={{ fontSize: 13, color: "var(--adm-text2, #555)", textAlign: "center", marginBottom: 16, lineHeight: 1.5, fontFamily: FB2 }}>
                {isPremiumTrial
                  ? t("trial_info")
                  : isEarlyRenewal && nextPeriodStart
                  ? <>{t("payment_redirect")} <strong>{nextPeriodStart}</strong> — {t("no_days_lost")}</>
                  : t("payment_info")
                }
              </div>

              <button
                onClick={handleSubscribe}
                disabled={submitting}
                style={{
                  width: "100%", padding: 15, border: "none", borderRadius: 999,
                  background: submitting ? "#ccc" : confirmTab === "PREMIUM" ? "#7c3aed" : confirmTab === "GOLD" ? "#F4A623" : "#475569",
                  color: "#fff", fontFamily: FD, fontSize: "0.92rem", fontWeight: 700,
                  cursor: submitting ? "wait" : "pointer",
                }}
              >
                {submitting ? (isPremiumTrial ? t("activating") : t("redirecting")) : isPremiumTrial ? t("start_trial") : `${t("pay")} ${fmt(gross)}`}
              </button>

              {!isPremiumTrial && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, fontSize: 11, color: "var(--adm-text3, #888)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                {t("secure_payment")}
              </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function PanelLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = usePanelLang();
  const { name, loading, error, logout, restaurants, selectedRestaurantId, setSelectedRestaurant, role, mustChangePassword, clearMustChangePassword, activePlan } = usePanelSession();
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [demoScrolled, setDemoScrolled] = useState(false);
  const [demoTip, setDemoTip] = useState(false);
  const [hasLoyalty, setHasLoyalty] = useState(false);

  // Auto-tag gold buttons for dark mode softening
  useEffect(() => {
    const tag = () => {
      document.querySelectorAll("button").forEach(btn => {
        const bg = getComputedStyle(btn).backgroundColor;
        if (bg === "rgb(244, 166, 35)") {
          if (!btn.classList.contains("qc-gold-btn")) btn.classList.add("qc-gold-btn");
        } else {
          if (btn.classList.contains("qc-gold-btn")) btn.classList.remove("qc-gold-btn");
        }
      });
    };
    tag();
    const observer = new MutationObserver(tag);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // Fetch loyalty status for sidebar visibility
  useEffect(() => {
    if (!selectedRestaurantId) return;
    fetch(`/api/billing/status?restaurantId=${selectedRestaurantId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setHasLoyalty(!!d.hasLoyalty); })
      .catch(() => {});
  }, [selectedRestaurantId]);

  // Demo banner scroll effect — must be before any early returns
  const selectedRestEarly = restaurants.find((r: any) => r.id === selectedRestaurantId);
  const isDemoEarly = !!selectedRestEarly?.isDemo;
  useEffect(() => {
    if (!isDemoEarly) { setDemoScrolled(false); return; }
    const onScroll = () => setDemoScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isDemoEarly]);

  // ═══ Panel navigation tracking — must be before early returns ═══
  const prevPathRef = useRef<string | null>(null);
  useEffect(() => {
    const section = pathname.replace("/panel", "").replace(/^\//, "") || "inicio";
    if (prevPathRef.current === pathname) return;
    prevPathRef.current = pathname;

    // Demo leads: funnel tracking
    if (isDemoEarly && selectedRestEarly?.slug) {
      trackFunnelEventBySlug(selectedRestEarly.slug, "panel_visit", { section });
    }

    // All restaurants: activity log
    if (selectedRestaurantId) {
      fetch("/api/panel/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: selectedRestaurantId, action: "panel_visit", details: { section } }),
      }).catch(() => {});
    }
  }, [pathname, isDemoEarly, selectedRestEarly?.slug, selectedRestaurantId]);

  useEffect(() => {
    if (!isDemoEarly || !selectedRestEarly?.slug) return;
    const slug = selectedRestEarly.slug;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        const section = pathname.replace("/panel", "").replace(/^\//, "") || "inicio";
        beaconFunnelEvent(slug, "panel_leave", { section });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [pathname, isDemoEarly, selectedRestEarly?.slug]);

  const [planModalInitialTab, setPlanModalInitialTab] = useState<"FREE" | "GOLD" | "PREMIUM" | undefined>(undefined);
  const [planModalRenewMode, setPlanModalRenewMode] = useState(false);
  const [planModalContext, setPlanModalContext] = useState<string | undefined>(undefined);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const tab = detail?.initialTab;
      if (tab === "FREE" || tab === "GOLD" || tab === "PREMIUM") {
        setPlanModalInitialTab(tab);
      } else {
        setPlanModalInitialTab(undefined);
      }
      setPlanModalRenewMode(!!detail?.renew);
      setPlanModalContext(detail?.context || undefined);
      setPlanModalOpen(true);
      // Track plan modal opened
      if (selectedRestEarly?.id) {
        fetch("/api/panel/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId: selectedRestEarly.id, action: "plan_modal_opened", details: { source: detail?.source || "unknown", initialTab: detail?.initialTab || null } }) }).catch(() => {});
      }
    };
    window.addEventListener("show-plan-modal", handler);
    return () => window.removeEventListener("show-plan-modal", handler);
  }, [selectedRestEarly?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);

    // ?renew=1&plan=PREMIUM → abrir modal de pago en modo renovación directo al plan actual
    if (params.get("renew") === "1") {
      const planParam = params.get("plan");
      params.delete("renew");
      params.delete("plan");
      const newSearch = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}`);
      const initialTab = (planParam === "GOLD" || planParam === "SILVER" || planParam === "PREMIUM") ? planParam as "GOLD" | "PREMIUM" : undefined;
      setTimeout(() => window.dispatchEvent(new CustomEvent("show-plan-modal", { detail: { renew: true, initialTab } })), 400);
      return;
    }

    const billing = params.get("billing");
    if (!billing) return;
    if (billing === "success") {
      const plan = params.get("plan");
      toast.success(`${t("subscription_activated")}${plan ? ` (${plan})` : ""}`);
    } else if (billing === "error") {
      const reason = params.get("reason");
      toast.error(`${t("subscription_error")}${reason ? ` (${reason})` : ""}. ${t("try_again")}`);
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
          <p style={{ fontFamily: "var(--font-display)", fontSize: "0.88rem", color: "var(--adm-text3, #555)", fontWeight: 500 }}>{t("loading_panel")}</p>
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
        <div style={{ position: "sticky", top: 0, zIndex: 150, padding: "18px 14px 18px", background: "var(--adm-bg, rgba(3,3,3,.95))", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", boxShadow: "0 4px 12px rgba(0,0,0,.08)", overflow: "visible", fontFamily: "var(--font-body)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span onClick={() => setDemoTip(t => !t)} style={{ height: 38, padding: "0 14px", borderRadius: 999, background: "rgba(255,178,45,.12)", border: "1px solid rgba(255,178,45,.2)", color: "#ffb22d", fontSize: 11, fontWeight: 950, letterSpacing: ".8px", fontFamily: "var(--font-body)", display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", position: "relative" }}>
              {(selectedRest as any).logoUrl ? (
                <img src={(selectedRest as any).logoUrl} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(255,178,45,.25)", display: "inline-grid", placeItems: "center", fontSize: 10 }}>🍽</span>
              )}
              {t("demo_badge")}
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
                      {t("demo_tooltip")}
                    </p>
                  </div>
                </>
              )}
            </span>
            <div style={{ display: "flex", gap: 7 }}>
              <a href={`/qr/${selectedRest.slug}`} style={{ border: "1px solid rgba(255,255,255,.2)", borderRadius: 999, height: 38, padding: "0 13px", fontSize: 14, fontWeight: 900, background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.75)", display: "flex", alignItems: "center", gap: 5, textDecoration: "none", whiteSpace: "nowrap" }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>{t("view_menu")}</a>
              <a href={`/activar/${selectedRest.slug}`} className="demo-activar-btn" style={{ border: 0, borderRadius: 999, height: 38, padding: "0 13px", fontSize: 14, fontWeight: 900, background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", display: "flex", alignItems: "center", textDecoration: "none", whiteSpace: "nowrap", transition: "transform 0.1s ease" }}>{t("activate")}</a>
            </div>
          </div>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, transform: "translateY(100%)", padding: "7px 14px", background: "linear-gradient(135deg, #f59e0b, #d97706)", textAlign: "center", lineHeight: 1.4 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", display: "block" }}>{t("demo_title")}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)", display: "block" }}>{t("demo_subtitle")}</span>
            <style>{`.demo-activar-btn:active { transform: scale(0.93) !important; }`}</style>
            <span style={{ position: "absolute", right: 44, top: -5, width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderBottom: "6px solid #d97706" }} />
          </div>
        </div>
      )}
      <div style={{ paddingTop: isDemo ? 56 : 0, background: isDemo ? "var(--adm-card)" : undefined }}>
      <AdminLayoutOwner
        name={name}
        restaurants={restaurants}
        selectedRestaurantId={selectedRestaurantId}
        setSelectedRestaurant={setSelectedRestaurant}
        logout={logout}
        basePath="/panel"
        activePlan={activePlan}
        isDemo={isDemo}
        hasLoyalty={hasLoyalty}
      >
        {!isDemo && (
          <ExpiryBanner restaurantId={selectedRestaurantId || null} />
        )}
        {children}
      </AdminLayoutOwner>
      </div>

      {/* Plan modal — triggered from "Mi Plan" menu */}
      {planModalOpen && (
        <PlanModal plan={activePlan} restaurantId={selectedRestaurantId || null} initialTab={planModalInitialTab} renewMode={planModalRenewMode} context={planModalContext} onClose={() => { setPlanModalOpen(false); setPlanModalRenewMode(false); setPlanModalContext(undefined); }} />
      )}
    </SessionContext.Provider>
  );
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <PanelLangProvider>
      <PanelLayoutInner>{children}</PanelLayoutInner>
    </PanelLangProvider>
  );
}
