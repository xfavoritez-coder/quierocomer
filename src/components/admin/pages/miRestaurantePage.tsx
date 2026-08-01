"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import PlanGate from "@/components/admin/PlanGate";
import { toast } from "sonner";
import { Camera, QrCode, ExternalLink, Store, CreditCard, XCircle, CheckCircle2, Clock, AlertTriangle, RefreshCw, Sparkles, X } from "lucide-react";
import { usePanelLang } from "@/lib/i18n/panel";
import { planNetAmount, ivaOf, grossOf, type PlanKey, PLAN_FEATURES_DISPLAY, PLAN_INHERITS_FROM } from "@/lib/billing/plans-config";
import FacturacionPage from "./facturacionPage";
import SubirFoto from "@/components/SubirFoto";
import QRGeneratorModal from "@/components/admin/QRGeneratorModal";
import SkeletonLoading from "@/components/admin/SkeletonLoading";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

const DAYS = [
  { key: "lun", label: "Lunes" },
  { key: "mar", label: "Martes" },
  { key: "mie", label: "Miércoles" },
  { key: "jue", label: "Jueves" },
  { key: "vie", label: "Viernes" },
  { key: "sab", label: "Sábado" },
  { key: "dom", label: "Domingo" },
];

type BillingStatus = {
  restaurantId: string;
  plan: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  lastPaymentAt: string | null;
  hasSubscription: boolean;
  hasAutoRenewal: boolean;
  flowCustomerId: string | null;
  activeFlowPlan: string | null;
  billingExempt: boolean;
  trialUsed?: boolean;
  ivaRate?: number;
  billingInfo?: { isComplete: boolean; missingFields: string[] };
};

function formatCLP(amount: number) {
  return `$${amount.toLocaleString("es-CL")}`;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}


interface RestaurantData {
  id: string; slug: string; name: string; description: string | null;
  logoUrl: string | null; bannerUrl: string | null;
  phone: string | null; whatsapp: string | null; address: string | null;
  instagram: string | null; website: string | null;
  scheduleJson: Record<string, string> | null;
  dietType: string | null;
  plan: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
}

function Card({ children, title, icon: Icon }: { children: React.ReactNode; title: string; icon?: any }) {
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)" }}>
      <h3 style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
        {Icon && <Icon size={18} color={GOLD} />}
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5, fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-input-border)",
  borderRadius: 8, fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--adm-text)",
  outline: "none", boxSizing: "border-box",
};

export default function MiRestaurantePage() {
  const { t } = usePanelLang();
  const { selectedRestaurantId, restaurants } = useAdminSession();
  const { activePlan } = usePanelSession();
  const [data, setData] = useState<RestaurantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [actioning, setActioning] = useState(false);
  const plan = (activePlan || "FREE").toUpperCase();
  const [subscribing, setSubscribing] = useState(false);
  const [activatingAutoRenew, setActivatingAutoRenew] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showPlansModal, setShowPlansModal] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [instagram, setInstagram] = useState("");
  const [website, setWebsite] = useState("");
  const [schedule, setSchedule] = useState<Record<string, string>>({});
  const [dietType, setDietType] = useState("OMNIVORE");
  const [genioFabEnabled, setGenioFabEnabled] = useState(true);
  const [highlightDiet, setHighlightDiet] = useState(false);
  const [highlightIg, setHighlightIg] = useState(false);
  const dietRef = useRef<HTMLDivElement>(null);
  const igRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const section = searchParams.get("section");
  const autorenew = searchParams.get("autorenew");
  const autorenewReason = searchParams.get("reason");

  const rid = selectedRestaurantId;

  const fetchData = useCallback(async () => {
    if (!rid) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/locales/${rid}`);
      if (!res.ok) { setLoading(false); return; }
      const d = await res.json();
      setData(d);
      setName(d.name || "");
      setDescription(d.description || "");
      setLogoUrl(d.logoUrl || "");
      setBannerUrl(d.bannerUrl || "");
      setPhone(d.phone || "");
      setWhatsapp(d.whatsapp || "");
      setAddress(d.address || "");
      setInstagram(d.instagram || "");
      setWebsite(d.website || "");
      setSchedule(d.scheduleJson || {});
      setGenioFabEnabled(d.genioFabEnabled !== false);
      const fromChecklist = section === "cocina" && !localStorage.getItem(`qc_diet_confirmed_${rid}`);
      setDietType(fromChecklist ? "" : (d.dietType || "OMNIVORE"));
    } catch {}
    setLoading(false);
  }, [rid]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!rid) return;
    fetch(`/api/billing/status?restaurantId=${rid}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setBillingStatus(d))
      .catch(() => {});
  }, [rid]);

  // Handle ?section= query param for scroll + highlight (runs after data loads)
  useEffect(() => {
    if (loading || !section) return;

    setTimeout(() => {
      if (section === "cocina" && dietRef.current) {
        dietRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightDiet(true);
        setTimeout(() => setHighlightDiet(false), 2500);
      }
      if (section === "redes" && igRef.current) {
        igRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightIg(true);
        setTimeout(() => setHighlightIg(false), 2500);
      }
    }, 300);
  }, [loading, section, rid]);

  const save = async (fields: Record<string, any>) => {
    if (!rid) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/locales/${rid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        toast.success(t("mr_saved"));
        const updated = await res.json();
        setData(updated);
      } else {
        const err = await res.json();
        toast.error(err.error || "Error al guardar");
      }
    } catch { toast.error("Error de conexión"); }
    setSaving(false);
  };

  const saveInfo = () => {
    save({ name, description, logoUrl: logoUrl || null, dietType });
    if (rid) localStorage.setItem(`qc_diet_confirmed_${rid}`, "1");
  };
  const saveContact = () => save({ phone: phone || null, whatsapp: whatsapp || null, address: address || null });
  const saveSocial = () => {
    save({ phone: phone || null, whatsapp: whatsapp || null, address: address || null });
    let w = website?.trim() || null;
    if (w && !w.startsWith("http")) w = `https://${w}`;
    save({ instagram: instagram || null, website: w });
  };
  const saveSchedule = () => save({ scheduleJson: Object.keys(schedule).length > 0 ? schedule : null });
  const updateDay = (key: string, value: string) => {
    setSchedule(prev => ({ ...prev, [key]: value }));
  };
  const toggleDay = (key: string) => {
    setSchedule(prev => {
      const copy = { ...prev };
      if (copy[key] === "closed") { delete copy[key]; }
      else { copy[key] = "closed"; }
      return copy;
    });
  };
  const copyScheduleToAll = () => {
    const first = DAYS.find(d => schedule[d.key] && schedule[d.key] !== "closed");
    if (!first) return;
    const val = schedule[first.key];
    const newSched: Record<string, string> = {};
    DAYS.forEach(d => { newSched[d.key] = val; });
    setSchedule(newSched);
  };

  const garzonLink = data ? `https://quierocomer.com/qr/admin/garzon/${data.slug}` : "";

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedRestaurant = restaurants.find(r => r.id === rid);

  const handleCancel = async () => {
    if (!billingStatus?.restaurantId || actioning) return;
    if (!window.confirm("¿Seguro que quieres cancelar tu suscripción? Mantendrás acceso hasta el final del periodo pagado.")) return;
    setActioning(true);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: billingStatus.restaurantId, atPeriodEnd: true }),
      });
      const resData = await res.json();
      if (!res.ok) { toast.error(resData.error || "No se pudo cancelar"); setActioning(false); return; }
      toast.success("Suscripción cancelada. Mantienes acceso hasta el final del periodo.");
      setTimeout(() => window.location.reload(), 1200);
    } catch { toast.error("Error de conexión"); setActioning(false); }
  };

  const handleRenew = async () => {
    if (!rid || subscribing) return;
    setSubscribing(true);
    try {
      const res = await fetch("/api/billing/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: rid, plan }),
      });
      const d = await res.json();
      if (!res.ok || !d.url) { toast.error(d.error || "No se pudo iniciar el pago"); setSubscribing(false); return; }
      window.location.href = d.url;
    } catch { toast.error("Error de conexión"); setSubscribing(false); }
  };

  const handleSubscribePlan = async (targetPlan: "GOLD" | "PREMIUM") => {
    if (!rid || subscribing) return;
    setSubscribing(true);
    try {
      const trialUsed = !!billingStatus?.trialUsed;
      const inTrial = billingStatus?.subscriptionStatus === "TRIALING";
      if (targetPlan === "PREMIUM" && !trialUsed && !inTrial && plan !== "PREMIUM") {
        const res = await fetch("/api/billing/start-trial", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId: rid }),
        });
        const d = await res.json();
        if (!res.ok) { toast.error(d.error || "No se pudo activar la prueba"); setSubscribing(false); return; }
        toast.success("¡Plan Pro activado! 7 días gratis.");
        setTimeout(() => window.location.reload(), 1200);
        return;
      }
      const res = await fetch("/api/billing/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: rid, plan: targetPlan }),
      });
      const d = await res.json();
      if (!res.ok || !d.url) { toast.error(d.error || "No se pudo iniciar la suscripción"); setSubscribing(false); return; }
      window.location.href = d.url;
    } catch { toast.error("Error de conexión"); setSubscribing(false); }
  };

  const handleActivateAutoRenew = async () => {
    if (!rid || activatingAutoRenew) return;
    const planKey = plan as "GOLD" | "PREMIUM" | "SILVER";
    if (plan === "FREE" || billingStatus?.subscriptionStatus !== "ACTIVE") {
      toast.error("Primero necesitas tener un plan activo");
      return;
    }
    setActivatingAutoRenew(true);
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: rid, plan: planKey }),
      });
      const d = await res.json();
      if (!res.ok || !d.url) {
        toast.error(d.error || "No se pudo iniciar el registro de tarjeta");
        setActivatingAutoRenew(false);
        return;
      }
      window.location.href = d.url;
    } catch {
      toast.error("Error de conexión");
      setActivatingAutoRenew(false);
    }
  };

  if (loading) return <SkeletonLoading type="form" />;
  if (!data || !rid) return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "var(--adm-text2)", fontFamily: F }}>{t("home_select_restaurant")}</p></div>;

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}><CreditCard size={20} color="var(--adm-text3)" /> {t("nav_restaurant")}</h1>
      <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 20px" }}>{t("mr_billing")}</p>

      {/* ── Bloque plan activo ── */}
      {(() => {
        if (!billingStatus) return null;
        const now = new Date();
        const subStatus = billingStatus.subscriptionStatus;
        const inTrial = subStatus === "TRIALING";
        const isActive = subStatus === "ACTIVE";
        const isCanceled = subStatus === "CANCELED";
        const isPastDue = subStatus === "PAST_DUE";
        const periodEnd = billingStatus.currentPeriodEnd ? new Date(billingStatus.currentPeriodEnd) : null;
        const isExempt = billingStatus.billingExempt;
        const trialUsed = !!billingStatus.trialUsed;

        const inGrace = isPastDue || (!inTrial && !isCanceled && periodEnd && periodEnd < now && isActive);
        const cycleEndsToday = !inGrace && periodEnd && periodEnd.toDateString() === now.toDateString();
        const toChileDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(d);
        const todayChile = toChileDate(now);
        const periodEndChile = periodEnd ? toChileDate(periodEnd) : null;
        const isTomorrow = periodEndChile === toChileDate(new Date(now.getTime() + 86400000));
        const in2Days = periodEndChile === toChileDate(new Date(now.getTime() + 2 * 86400000));
        const isExpiringSoon = !inGrace && !cycleEndsToday && isActive && plan !== "FREE" && (isTomorrow || in2Days);

        const planAccent = (plan as string) === "FREE" ? "#64748b" : "#7c3aed";
        const accent = inGrace ? "#dc2626" : cycleEndsToday ? "#d97706" : planAccent;

        const isFree = (plan as string) === "FREE";
        const planEmoji = "📋";
        const planName = isFree ? "Sin plan" : "Pro";

        const net = (billingStatus as any).customPlanPriceNet ?? planNetAmount(plan as PlanKey);
        const gross = grossOf(net);

        const periodoText = inGrace
          ? `⚠️ Vencido el ${formatDate(billingStatus.currentPeriodEnd)}`
          : cycleEndsToday
            ? `Renueva hoy · ${formatCLP(gross)} con IVA`
            : inTrial
              ? `Prueba gratis hasta el ${formatDate(billingStatus.trialEndsAt)}`
              : isActive && periodEnd
                ? `Vigente hasta el ${formatDate(billingStatus.currentPeriodEnd)}`
                : isCanceled && periodEnd
                  ? `Acceso hasta el ${formatDate(billingStatus.currentPeriodEnd)}`
                  : null;

        // Modal de planes — solo Plan Pro
        const proAccent = "#7c3aed";
        const proNet = planNetAmount("PREMIUM");
        const proGross = grossOf(proNet);
        const proFeatures = PLAN_FEATURES_DISPLAY["PREMIUM"] || [];
        const isPremiumTrial = !trialUsed && !inTrial && plan !== "PREMIUM";
        const isCurrentPlan = (plan as string) === "PREMIUM";

        return (
          <div style={{ marginBottom: 16 }}>
            {/* ─── Bloque plan ─── */}
            <div style={{
              borderRadius: 16, overflow: "hidden",
              border: `1.5px solid ${accent}55`,
              background: `linear-gradient(145deg, ${accent}22 0%, ${accent}0a 60%, var(--adm-card) 100%)`,
              boxShadow: `0 4px 24px ${accent}22`,
              marginBottom: 0,
            }}>
              <div style={{ padding: "22px 20px 18px" }}>
                {/* Top row */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: "2rem", lineHeight: 1 }}>{planEmoji}</span>
                    <div>
                      <p style={{ fontFamily: F, fontSize: "0.65rem", color: accent, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, margin: 0, opacity: 0.8 }}>{isFree ? "Plan actual" : "Plan activo"}</p>
                      <p style={{ fontFamily: F, fontSize: "1.6rem", fontWeight: 900, color: accent, margin: "0", lineHeight: 1, letterSpacing: "-0.5px" }}>{planName}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 99, background: inGrace ? "rgba(220,38,38,0.12)" : cycleEndsToday ? "rgba(217,119,6,0.12)" : isActive || inTrial ? "rgba(22,163,74,0.12)" : "rgba(100,116,139,0.12)", border: `1px solid ${inGrace ? "rgba(220,38,38,0.3)" : cycleEndsToday ? "rgba(217,119,6,0.3)" : isActive || inTrial ? "rgba(22,163,74,0.3)" : "rgba(100,116,139,0.3)"}` }}>
                      {inGrace ? <AlertTriangle size={12} color="#dc2626" /> : cycleEndsToday ? <Clock size={12} color="#d97706" /> : isActive || inTrial ? <CheckCircle2 size={12} color="#16a34a" /> : isFree ? <CreditCard size={12} color="var(--adm-text3)" /> : isCanceled ? <XCircle size={12} color="#dc2626" /> : <CreditCard size={12} color="var(--adm-text3)" />}
                      <span style={{ fontFamily: F, fontSize: "0.7rem", fontWeight: 700, color: inGrace ? "#dc2626" : cycleEndsToday ? "#d97706" : isActive || inTrial ? "#16a34a" : isFree ? "var(--adm-text3)" : isCanceled ? "#dc2626" : "var(--adm-text3)" }}>
                        {inGrace ? "Vencido" : cycleEndsToday ? "Renueva hoy" : inTrial ? "En prueba" : isActive ? "Activo" : isFree ? "Sin suscripción" : isCanceled ? "Cancelado" : "Sin suscripción"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Periodo */}
                {periodoText && (
                  <p style={{ fontFamily: FB, fontSize: "0.8rem", color: inGrace ? "#dc2626" : cycleEndsToday ? "#d97706" : `${accent}cc`, margin: "0 0 16px", fontWeight: inGrace || cycleEndsToday ? 600 : 400 }}>
                    {periodoText}
                  </p>
                )}

                {/* Botones */}
                {!isExempt && (
                  <div style={{ display: "flex", gap: 8 }}>
                    {(inGrace || cycleEndsToday) ? (
                      <button onClick={() => setShowRenewModal(true)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", border: "none", borderRadius: 999, background: inGrace ? "#dc2626" : "#d97706", color: "#fff", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>
                        <RefreshCw size={14} /> Renovar plan
                      </button>
                    ) : isExpiringSoon ? (
                      <button
                        onClick={() => window.dispatchEvent(new CustomEvent("show-plan-modal", { detail: { renew: true, initialTab: plan, source: "mi_restaurante_plan_box" } }))}
                        style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", border: "none", borderRadius: 999, background: planAccent, color: "#fff", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}
                      >
                        <RefreshCw size={14} /> Renovar
                      </button>
                    ) : isFree ? (
                      <button
                        onClick={() => window.dispatchEvent(new CustomEvent("show-plan-modal", { detail: { initialTab: "PREMIUM", source: "mi_restaurante_free_cta" } }))}
                        style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", border: "none", borderRadius: 999, background: "#7c3aed", color: "#fff", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}
                      >
                        {trialUsed ? "⚡ Activar Pro →" : "⚡ Probar Pro 7 días gratis"}
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            {/* ─── Modal renovar ─── */}
            {showRenewModal && (
              <div style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                <div onClick={() => setShowRenewModal(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)" }} />
                <div style={{ position: "relative", background: "var(--adm-card)", borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
                  <h3 style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 800, color: "var(--adm-text)", margin: "0 0 4px" }}>Renovar plan {planName}</h3>
                  <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", margin: "0 0 20px" }}>Se generará un nuevo cobro mensual</p>
                  <div style={{ background: "var(--adm-hover)", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text2)" }}>Plan {planName} (neto)</span>
                      <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)" }}>{formatCLP(net)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text2)" }}>IVA (19%)</span>
                      <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)" }}>{formatCLP(ivaOf(net))}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid var(--adm-card-border)" }}>
                      <span style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 800, color: "var(--adm-text)" }}>Total</span>
                      <span style={{ fontFamily: F, fontSize: "1rem", fontWeight: 800, color: accent }}>{formatCLP(gross)}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setShowRenewModal(false)} style={{ flex: 1, padding: "12px 0", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 999, color: "var(--adm-text2)", fontFamily: F, fontSize: "0.85rem", cursor: "pointer" }}>Volver</button>
                    <button onClick={handleRenew} disabled={subscribing} style={{ flex: 2, padding: "12px 0", border: "none", borderRadius: 999, background: accent, color: "#fff", fontFamily: F, fontSize: "0.88rem", fontWeight: 700, cursor: "pointer", opacity: subscribing ? 0.7 : 1 }}>
                      {subscribing ? "Redirigiendo…" : "Ir a pagar →"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Modal planes ─── */}
            {showPlansModal && (
              <div style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
                <div onClick={() => setShowPlansModal(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)" }} />
                <div style={{ position: "relative", background: "var(--adm-card)", borderRadius: 16, padding: "24px 20px 32px", width: "100%", maxWidth: 480, boxShadow: "0 8px 40px rgba(0,0,0,0.25)", maxHeight: "90vh", overflowY: "auto" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                    <h3 style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Planes disponibles</h3>
                    <button onClick={() => setShowPlansModal(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={20} color="var(--adm-text3)" /></button>
                  </div>

                  {/* Plan Pro card */}
                  <div style={{ border: `1.5px solid ${proAccent}40`, borderRadius: 14, overflow: "hidden", marginBottom: 14 }}>
                    <div style={{ padding: "16px 18px 14px", background: `${proAccent}0e`, borderBottom: "1px solid var(--adm-card-border)" }}>
                      {isCurrentPlan && <div style={{ display: "inline-block", padding: "2px 8px", background: `${proAccent}20`, border: `1px solid ${proAccent}40`, borderRadius: 99, marginBottom: 8 }}><span style={{ fontFamily: F, fontSize: "0.68rem", fontWeight: 700, color: proAccent }}>✓ Tu plan actual</span></div>}
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontFamily: F, fontSize: "2rem", fontWeight: 900, color: "var(--adm-text)", lineHeight: 1 }}>Plan Pro</span>
                      </div>
                      <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", margin: "4px 0 0" }}>Incluye carta QR, pedidos online y valoraciones</p>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
                        <span style={{ fontFamily: F, fontSize: "1.5rem", fontWeight: 900, color: proAccent, lineHeight: 1 }}>{formatCLP(proNet)}</span>
                        <span style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text3)" }}>+ IVA /mes</span>
                      </div>
                      <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "4px 0 0" }}>{formatCLP(proGross)} con IVA · Sin contratos</p>
                      {isPremiumTrial && <p style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: proAccent, margin: "8px 0 0" }}>✨ 7 días gratis para probar</p>}
                    </div>
                    <div style={{ padding: "12px 18px" }}>
                      {proFeatures.map(f => (
                        <div key={f.text} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                          <span style={{ color: proAccent, fontSize: "0.85rem", flexShrink: 0 }}>✓</span>
                          <span style={{ fontFamily: FB, fontSize: "0.84rem", color: "var(--adm-text)" }}>{f.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Acción */}
                  {!isCurrentPlan && (
                    <button onClick={() => handleSubscribePlan("PREMIUM")} disabled={subscribing} style={{ width: "100%", padding: "13px 0", border: "none", borderRadius: 999, background: proAccent, color: "#fff", fontFamily: F, fontSize: "0.92rem", fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 14px ${proAccent}44`, opacity: subscribing ? 0.7 : 1 }}>
                      {subscribing ? "Redirigiendo…" : isPremiumTrial ? "Empezar 7 días gratis" : "Contratar Plan Pro"}
                    </button>
                  )}
                  {isCurrentPlan && (
                    <div style={{ padding: "12px 16px", background: "var(--adm-hover)", borderRadius: 10, textAlign: "center" }}>
                      <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0 }}>Estás disfrutando de este plan</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}





      {/* ── Módulo Loyalty ── */}
      {billingStatus && !billingStatus.billingExempt && (() => {
        const ls = (billingStatus as any).loyaltyStatus as string ?? "NONE";
        const lEnd = (billingStatus as any).loyaltyPeriodEnd as string | null;
        const lTrial = (billingStatus as any).loyaltyTrialEndsAt as string | null;
        const loyaltyTrialUsed = !!(billingStatus as any).loyaltyTrialUsed;
        const isLoyaltyActive = ls === "ACTIVE";
        const isLoyaltyTrial = ls === "TRIALING";
        const isLoyaltyNone = ls === "NONE" || ls === "CANCELED";
        const loyaltyNet = 29900;
        const loyaltyGross = loyaltyNet + ivaOf(loyaltyNet);
        const PURPLE = "#6d28d9";

        return (
          <div style={{ background: "var(--adm-card)", border: `1.5px solid ${isLoyaltyActive || isLoyaltyTrial ? PURPLE + "55" : "var(--adm-card-border)"}`, borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: isLoyaltyActive || isLoyaltyTrial ? `0 4px 20px ${PURPLE}15` : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: "1.6rem" }}>🎁</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: F, fontSize: "0.75rem", color: PURPLE, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700, margin: 0, opacity: 0.8 }}>Módulo adicional</p>
                <p style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 800, color: "var(--adm-text)", margin: 0, lineHeight: 1 }}>Loyalty Fidelización</p>
              </div>
              {(isLoyaltyActive || isLoyaltyTrial) && (
                <span style={{ padding: "3px 10px", borderRadius: 99, background: isLoyaltyTrial ? "rgba(109,40,217,0.1)" : "rgba(22,163,74,0.1)", border: `1px solid ${isLoyaltyTrial ? "rgba(109,40,217,0.3)" : "rgba(22,163,74,0.3)"}`, fontFamily: F, fontSize: "0.65rem", fontWeight: 700, color: isLoyaltyTrial ? PURPLE : "#16a34a" }}>
                  {isLoyaltyTrial ? "En prueba" : "Activo"}
                </span>
              )}
            </div>

            {isLoyaltyActive && lEnd && (
              <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: "0 0 14px" }}>
                Vigente hasta el {formatDate(lEnd)} · ${loyaltyGross.toLocaleString("es-CL")} con IVA/mes
              </p>
            )}
            {isLoyaltyTrial && lTrial && (
              <p style={{ fontFamily: FB, fontSize: "0.8rem", color: PURPLE, margin: "0 0 14px", fontWeight: 600 }}>
                Prueba hasta el {formatDate(lTrial)}
              </p>
            )}
            {isLoyaltyNone && (
              <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 14px", lineHeight: 1.5 }}>
                Tarjeta de fidelización digital con Apple Wallet y Google Wallet.
              </p>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              {isLoyaltyNone && !loyaltyTrialUsed && (
                <button
                  onClick={async () => {
                    if (!rid) return;
                    try {
                      const res = await fetch("/api/billing/loyalty/start-trial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId: rid }) });
                      const d = await res.json();
                      if (!res.ok) { toast.error(d.error || "Error"); return; }
                      toast.success("¡Loyalty activado! 7 días gratis.");
                      setTimeout(() => window.location.reload(), 1000);
                    } catch { toast.error("Error de conexión"); }
                  }}
                  style={{ flex: 1, padding: "10px 0", border: "none", borderRadius: 999, background: PURPLE, color: "#fff", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}
                >
                  ✨ Probar 7 días gratis
                </button>
              )}
              {isLoyaltyNone && loyaltyTrialUsed && (
                <button
                  onClick={async () => {
                    if (!rid) return;
                    const res = await fetch("/api/billing/loyalty/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId: rid }) });
                    const d = await res.json();
                    if (!res.ok || !d.url) { toast.error(d.error || "Error"); return; }
                    window.location.href = d.url;
                  }}
                  style={{ flex: 1, padding: "10px 0", border: "none", borderRadius: 999, background: PURPLE, color: "#fff", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}
                >
                  Activar Loyalty →
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Facturación ── */}
      <div style={{ marginBottom: 16 }}>
        <FacturacionPage />
      </div>

      {/* ── Historial de pagos ── */}
      {billingStatus && (billingStatus.lastPaymentAt || billingStatus.currentPeriodEnd || billingStatus.hasSubscription) && (() => {
        const net = (billingStatus as any).customPlanPriceNet ?? planNetAmount(billingStatus.plan as PlanKey ?? "FREE");
        const gross = net + ivaOf(net);
        return (
          <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
            <h3 style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 6 }}>
              <CreditCard size={14} color="var(--adm-text3)" /> Historial de pagos
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {billingStatus.lastPaymentAt && (
                <div>
                  <p style={{ fontSize: "0.64rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em", fontFamily: F }}>Último pago</p>
                  <p style={{ fontSize: "0.88rem", color: "var(--adm-text)", margin: "4px 0 0", fontWeight: 600, fontFamily: FB }}>{formatDate(billingStatus.lastPaymentAt)}</p>
                </div>
              )}
              {billingStatus.currentPeriodEnd && (
                <div>
                  <p style={{ fontSize: "0.64rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em", fontFamily: F }}>
                    {billingStatus.subscriptionStatus === "CANCELED" ? "Acceso hasta" : "Próximo cobro"}
                  </p>
                  <p style={{ fontSize: "0.88rem", color: "var(--adm-text)", margin: "4px 0 0", fontWeight: 600, fontFamily: FB }}>{formatDate(billingStatus.currentPeriodEnd)}</p>
                </div>
              )}
              {billingStatus.hasSubscription && net > 0 && (
                <div>
                  <p style={{ fontSize: "0.64rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em", fontFamily: F }}>Cobro mensual</p>
                  <p style={{ fontSize: "0.88rem", color: "var(--adm-text)", margin: "4px 0 0", fontWeight: 600, fontFamily: FB }}>{formatCLP(gross)}</p>
                  <p style={{ fontSize: "0.64rem", color: "var(--adm-text3)", margin: "2px 0 0", fontFamily: FB }}>{formatCLP(net)} neto + {formatCLP(ivaOf(net))} IVA</p>
                </div>
              )}
              {billingStatus.hasSubscription && (
                <div>
                  <p style={{ fontSize: "0.64rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em", fontFamily: F }}>Pasarela</p>
                  <p style={{ fontSize: "0.88rem", color: "var(--adm-text)", margin: "4px 0 0", fontWeight: 600, fontFamily: FB }}>Flow.cl</p>
                  <a href="https://www.flow.cl/app/web/misDatos.php" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.72rem", color: GOLD, textDecoration: "none", fontFamily: F, marginTop: 2 }}>
                    Gestionar <ExternalLink size={10} />
                  </a>
                </div>
              )}
            </div>
          </div>
        );
      })()}




      {/* ── Resultado registro tarjeta Flow ── */}
      {autorenew && (
        <div style={{ background: autorenew === "error" ? "rgba(220,38,38,0.08)" : "rgba(22,163,74,0.08)", border: `1px solid ${autorenew === "error" ? "rgba(220,38,38,0.25)" : "rgba(22,163,74,0.25)"}`, borderRadius: 14, padding: "14px 18px", marginBottom: 16 }}>
          <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: autorenew === "error" ? "#dc2626" : "#16a34a", margin: "0 0 4px" }}>
            {autorenew === "ok" ? "✅ Cobro automático activado" : autorenew === "charge_pending" ? "✅ Tarjeta registrada" : "❌ Error al activar cobro automático"}
          </p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--adm-text2)", margin: 0 }}>
            {autorenew === "ok" ? "Tu plan se renovará automáticamente cuando venza el período actual." : autorenew === "charge_pending" ? "Tu suscripción quedó creada. Flow procesará el primer cobro en los próximos minutos." : autorenewReason || "Intenta nuevamente o contacta soporte@quierocomer.com"}
          </p>
        </div>
      )}

      {/* ── Cobro automático ── */}
      {billingStatus && !billingStatus.billingExempt && plan !== "FREE" && billingStatus.subscriptionStatus === "ACTIVE" && (() => {
        const hasAutoRenew = billingStatus.hasAutoRenewal;
        const planName = plan === "FREE" ? "Gratis" : "Pro";
        return (
          <div style={{ background: "var(--adm-card)", border: `1px solid ${hasAutoRenew ? "rgba(22,163,74,0.25)" : "var(--adm-card-border)"}`, borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: hasAutoRenew ? "rgba(22,163,74,0.1)" : "var(--adm-hover)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <RefreshCw size={18} color={hasAutoRenew ? "#16a34a" : "var(--adm-text3)"} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <p style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>
                    Cobro automático mensual
                  </p>
                  {hasAutoRenew && (
                    <span style={{ padding: "2px 8px", background: "rgba(22,163,74,0.12)", border: "1px solid rgba(22,163,74,0.25)", borderRadius: 99, fontFamily: F, fontSize: "0.65rem", fontWeight: 700, color: "#16a34a" }}>
                      Activo
                    </span>
                  )}
                </div>
                {hasAutoRenew ? (
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--adm-text2)", margin: "0 0 12px", lineHeight: 1.5 }}>
                    Tu plan {planName} se renueva automáticamente cada mes con la tarjeta registrada en Flow. No necesitas hacer nada.
                  </p>
                ) : (
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--adm-text2)", margin: "0 0 12px", lineHeight: 1.5 }}>
                    Activa el cobro automático para que tu plan {planName} se renueve cada mes sin que tengas que acordarte. Se cobra automáticamente con tu tarjeta.
                  </p>
                )}
                {!hasAutoRenew && (
                  <button
                    onClick={handleActivateAutoRenew}
                    disabled={activatingAutoRenew}
                    style={{ padding: "9px 18px", border: "none", borderRadius: 999, background: GOLD, color: "#fff", fontFamily: F, fontSize: "0.8rem", fontWeight: 700, cursor: activatingAutoRenew ? "wait" : "pointer", opacity: activatingAutoRenew ? 0.7 : 1 }}
                  >
                    {activatingAutoRenew ? "Iniciando…" : "Activar cobro automático"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* QR Modal */}
      {qrModalOpen && selectedRestaurant && (
        <QRGeneratorModal restaurant={selectedRestaurant} onClose={() => setQrModalOpen(false)} />
      )}
    </div>
  );
}
