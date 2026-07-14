"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import PlanGate from "@/components/admin/PlanGate";
import { toast } from "sonner";
import { Camera, QrCode, ExternalLink, Store, CreditCard, XCircle, CheckCircle2, Clock, AlertTriangle, RefreshCw, Sparkles, X } from "lucide-react";
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
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [plansTab, setPlansTab] = useState<"FREE" | "GOLD" | "PREMIUM">("GOLD");

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

  const rid = selectedRestaurantId;

  const fetchData = useCallback(async () => {
    if (!rid) return;
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
        toast.success("Guardado");
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
        toast.success("¡Premium activado! 7 días gratis.");
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

  if (loading) return <SkeletonLoading type="form" />;
  if (!data || !rid) return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "var(--adm-text2)", fontFamily: F }}>Selecciona un restaurant</p></div>;

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}><Store size={20} color="var(--adm-text3)" /> Mi Restaurante</h1>
      <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 20px" }}>Configura la información y apariencia de tu local</p>

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

        const planAccent = (plan as string) === "PREMIUM" ? "#7c3aed"
          : (plan as string) === "GOLD" || (plan as string) === "SILVER" ? GOLD
          : "#64748b";
        const accent = inGrace ? "#dc2626" : cycleEndsToday ? "#d97706" : planAccent;

        const planEmoji = (plan as string) === "PREMIUM" ? "💎" : (plan as string) === "GOLD" ? "⭐" : (plan as string) === "SILVER" ? "🥈" : "🆓";
        const planName = (plan as string) === "FREE" ? "Gratis" : (plan as string) === "GOLD" ? "Gold" : (plan as string) === "PREMIUM" ? "Premium" : (plan as string) === "SILVER" ? "Silver" : (plan as string);

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

        // Modal de planes — datos por tab
        const PLAN_DATA = {
          FREE:    { accent: "#64748b", emoji: "🆓", name: "Gratis",  net: 0 },
          GOLD:    { accent: GOLD,      emoji: "⭐", name: "Gold",    net: planNetAmount("GOLD") },
          PREMIUM: { accent: "#7c3aed", emoji: "💎", name: "Premium", net: planNetAmount("PREMIUM") },
        } as const;
        const tabData = PLAN_DATA[plansTab];
        const tabNet = tabData.net;
        const tabGross = grossOf(tabNet);
        const tabFeatures = PLAN_FEATURES_DISPLAY[plansTab] || [];
        const tabInherits = PLAN_INHERITS_FROM[plansTab];
        const isPremiumTrial = plansTab === "PREMIUM" && !trialUsed && !inTrial && plan !== "PREMIUM";
        const isCurrentPlan = plansTab === (plan as string);

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
                      <p style={{ fontFamily: F, fontSize: "0.65rem", color: accent, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, margin: 0, opacity: 0.8 }}>Plan activo</p>
                      <p style={{ fontFamily: F, fontSize: "1.6rem", fontWeight: 900, color: accent, margin: "0", lineHeight: 1, letterSpacing: "-0.5px" }}>{planName}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 99, background: inGrace ? "rgba(220,38,38,0.12)" : cycleEndsToday ? "rgba(217,119,6,0.12)" : isActive || inTrial ? "rgba(22,163,74,0.12)" : "rgba(100,116,139,0.12)", border: `1px solid ${inGrace ? "rgba(220,38,38,0.3)" : cycleEndsToday ? "rgba(217,119,6,0.3)" : isActive || inTrial ? "rgba(22,163,74,0.3)" : "rgba(100,116,139,0.3)"}` }}>
                      {inGrace ? <AlertTriangle size={12} color="#dc2626" /> : cycleEndsToday ? <Clock size={12} color="#d97706" /> : isActive || inTrial ? <CheckCircle2 size={12} color="#16a34a" /> : isCanceled ? <XCircle size={12} color="#dc2626" /> : <CreditCard size={12} color="var(--adm-text3)" />}
                      <span style={{ fontFamily: F, fontSize: "0.7rem", fontWeight: 700, color: inGrace ? "#dc2626" : cycleEndsToday ? "#d97706" : isActive || inTrial ? "#16a34a" : isCanceled ? "#dc2626" : "var(--adm-text3)" }}>
                        {inGrace ? "Vencido" : cycleEndsToday ? "Renueva hoy" : inTrial ? "En prueba" : isActive ? "Activo" : isCanceled ? "Cancelado" : "Sin suscripción"}
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
                {!isExempt && (plan as string) !== "PREMIUM" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    {(inGrace || cycleEndsToday) ? (
                      <button onClick={() => setShowRenewModal(true)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", border: "none", borderRadius: 999, background: inGrace ? "#dc2626" : "#d97706", color: "#fff", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>
                        <RefreshCw size={14} /> Renovar plan
                      </button>
                    ) : (
                      <button onClick={() => setShowPlansModal(true)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", border: "none", borderRadius: 999, background: accent, color: "#fff", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>
                        <Sparkles size={14} /> Mejorar plan
                      </button>
                    )}
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

                  {/* Tabs */}
                  <div style={{ display: "flex", background: "var(--adm-hover)", borderRadius: 10, padding: 4, marginBottom: 16 }}>
                    {(["FREE", "GOLD", "PREMIUM"] as const).map(t => {
                      const active = plansTab === t;
                      const c = PLAN_DATA[t].accent;
                      return (
                        <button key={t} onClick={() => setPlansTab(t)} style={{ flex: 1, padding: "9px 0", border: "none", cursor: "pointer", borderRadius: 7, background: active ? "var(--adm-card)" : "transparent", color: active ? c : "var(--adm-text3)", fontFamily: F, fontSize: "0.8rem", fontWeight: 700, boxShadow: active ? "0 1px 6px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>
                          {PLAN_DATA[t].emoji} {PLAN_DATA[t].name}
                          {t === (plan as string) && <span style={{ marginLeft: 3, fontSize: "0.6rem", opacity: 0.7 }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* Plan card */}
                  <div style={{ border: `1.5px solid ${tabData.accent}40`, borderRadius: 14, overflow: "hidden", marginBottom: 14 }}>
                    <div style={{ padding: "16px 18px 14px", background: `${tabData.accent}0e`, borderBottom: "1px solid var(--adm-card-border)" }}>
                      {isCurrentPlan && <div style={{ display: "inline-block", padding: "2px 8px", background: `${tabData.accent}20`, border: `1px solid ${tabData.accent}40`, borderRadius: 99, marginBottom: 8 }}><span style={{ fontFamily: F, fontSize: "0.68rem", fontWeight: 700, color: tabData.accent }}>✓ Tu plan actual</span></div>}
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontFamily: F, fontSize: "2rem", fontWeight: 900, color: "var(--adm-text)", lineHeight: 1 }}>{tabNet === 0 ? "$0" : formatCLP(tabNet)}</span>
                        <span style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text3)" }}>{tabNet === 0 ? "gratis" : "+ IVA /mes"}</span>
                      </div>
                      {tabNet > 0 && <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "4px 0 0" }}>{formatCLP(tabGross)} con IVA · Sin contratos</p>}
                      {isPremiumTrial && <p style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 700, color: "#7c3aed", margin: "8px 0 0" }}>✨ 7 días gratis para probar</p>}
                    </div>
                    <div style={{ padding: "12px 18px" }}>
                      {tabInherits && <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", fontStyle: "italic", margin: "0 0 8px" }}>{tabInherits}</p>}
                      {tabFeatures.length > 0
                        ? tabFeatures.map(f => (
                            <div key={f.text} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                              <span style={{ color: tabData.accent, fontSize: "0.85rem", flexShrink: 0 }}>✓</span>
                              <span style={{ fontFamily: FB, fontSize: "0.84rem", color: "var(--adm-text)" }}>{f.text}</span>
                            </div>
                          ))
                        : <p style={{ fontFamily: FB, fontSize: "0.84rem", color: "var(--adm-text3)", margin: 0 }}>Carta QR digital · Panel autoadministrable</p>
                      }
                    </div>
                  </div>

                  {/* Acción */}
                  {!isCurrentPlan && plansTab !== "FREE" && (
                    <button onClick={() => handleSubscribePlan(plansTab as "GOLD" | "PREMIUM")} disabled={subscribing} style={{ width: "100%", padding: "13px 0", border: "none", borderRadius: 999, background: tabData.accent, color: "#fff", fontFamily: F, fontSize: "0.92rem", fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 14px ${tabData.accent}44`, opacity: subscribing ? 0.7 : 1 }}>
                      {subscribing ? "Redirigiendo…" : isPremiumTrial ? "Empezar 7 días gratis" : `Contratar ${tabData.name}`}
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

      {/* ── Código QR ── */}
      {selectedRestaurant?.slug && (
        <div style={{
          background: "linear-gradient(135deg, rgba(244,166,35,.08), rgba(244,166,35,.03))",
          border: "1px solid rgba(244,166,35,.2)",
          borderRadius: 16, padding: "18px 20px", marginBottom: 16,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: "rgba(244,166,35,.12)", display: "grid", placeItems: "center",
          }}>
            <QrCode size={22} color={GOLD} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "0 0 4px", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>Código QR</p>
            <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0 }}>
              Genera e imprime tu QR para que tus clientes escaneen y vean tu carta
            </p>
          </div>
          <button
            onClick={() => setQrModalOpen(true)}
            style={{
              padding: "8px 14px", borderRadius: 10, border: "none", cursor: "pointer",
              background: GOLD, color: "#fff", fontFamily: F, fontSize: "0.75rem", fontWeight: 700,
              flexShrink: 0, whiteSpace: "nowrap",
            }}
          >
            Generar QR
          </button>
        </div>
      )}

      {/* ── Info básica ── */}
      <Card title="Información básica" icon={Camera}>
        {/* Logo */}
        <Field label="Logo">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: `2px solid ${GOLD}` }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--adm-input)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed var(--adm-card-border)" }}>
                <Camera size={20} color="var(--adm-text3)" />
              </div>
            )}
            <SubirFoto folder="logos" label="Cambiar logo" circular height="64px" onUpload={(url: string) => setLogoUrl(url)} />
          </div>
        </Field>

        <Field label="Nombre del local">
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Nombre del restaurant" />
        </Field>

        <Field label="Tipo de cocina">
          <div ref={dietRef} style={{ display: "flex", gap: 8 }}>
            {([
              { value: "OMNIVORE", label: "Omnívoro", icon: "🍽️" },
              { value: "VEGETARIAN", label: "Vegetariano", icon: "🥗" },
              { value: "VEGAN", label: "Vegano", icon: "🌿" },
            ] as const).map(opt => {
              const active = dietType === opt.value;
              return (
                <button key={opt.value} onClick={() => setDietType(opt.value)} style={{
                  flex: 1, padding: "10px 8px", borderRadius: 10, cursor: "pointer",
                  background: active ? "rgba(244,166,35,0.12)" : "var(--adm-input)",
                  border: active ? "1px solid rgba(244,166,35,0.3)" : "1px solid transparent",
                  color: active ? GOLD : "var(--adm-text3)",
                  fontFamily: F, fontSize: "0.78rem", fontWeight: active ? 700 : 500,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  transition: "all 0.2s",
                }}>
                  <span style={{ fontSize: "0.9rem" }}>{opt.icon}</span> {opt.label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Instagram">
          <div ref={igRef} style={{ display: "flex", alignItems: "center", animation: highlightIg ? "dietPulse 0.8s ease-in-out infinite" : "none", borderRadius: 8 }}>
            {highlightIg && <style>{`@keyframes dietPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); box-shadow: 0 0 12px rgba(244,166,35,0.3); } }`}</style>}
            <span style={{ padding: "10px 10px 10px 14px", background: "var(--adm-input)", border: highlightIg ? "1px solid rgba(244,166,35,0.3)" : "1px solid var(--adm-input-border)", borderRight: "none", borderRadius: "8px 0 0 8px", fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text3)" }}>@</span>
            <input value={instagram} onChange={e => setInstagram(e.target.value.replace(/^@/, ""))} style={{ ...inputStyle, borderRadius: "0 8px 8px 0", ...(highlightIg ? { borderColor: "rgba(244,166,35,0.3)" } : {}) }} placeholder="tu_usuario" />
          </div>
        </Field>
        <Field label="Sitio web">
          <input value={website} onChange={e => setWebsite(e.target.value)} style={inputStyle} placeholder="https://tu-sitio.cl" type="url" />
        </Field>

        <button onClick={() => { saveInfo(); saveSocial(); }} disabled={saving} style={{ width: "100%", padding: 10, background: GOLD, color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
          {saving ? "Guardando..." : "Guardar información"}
        </button>
      </Card>



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




      {/* QR Modal */}
      {qrModalOpen && selectedRestaurant && (
        <QRGeneratorModal restaurant={selectedRestaurant} onClose={() => setQrModalOpen(false)} />
      )}
    </div>
  );
}
