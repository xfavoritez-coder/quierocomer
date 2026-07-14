"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import PlanGate from "@/components/admin/PlanGate";
import { toast } from "sonner";
import { Camera, Phone, Globe, MapPin, Clock, QrCode, Bell, Copy, ExternalLink, Check, Store, Receipt, CreditCard, Shield, XCircle, Sparkles, CheckCircle2 } from "lucide-react";
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

const ALL_TABS = ["FREE", "GOLD", "PREMIUM"] as const;
type TabKey = typeof ALL_TABS[number];

const TAB_COLORS: Record<TabKey, { accent: string; bg: string; border: string; shadow: string }> = {
  FREE:    { accent: "#64748b", bg: "rgba(100,116,139,0.06)", border: "rgba(100,116,139,0.15)", shadow: "rgba(100,116,139,0.2)" },
  GOLD:    { accent: "#F4A623", bg: "rgba(244,166,35,0.06)",  border: "rgba(244,166,35,0.15)",  shadow: "rgba(244,166,35,0.3)" },
  PREMIUM: { accent: "#7c3aed", bg: "rgba(124,58,237,0.06)",  border: "rgba(124,58,237,0.15)",  shadow: "rgba(124,58,237,0.3)" },
};

function PlanFeatureRow({ text, tip, color }: { text: string; tip: string; color: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <span style={{ color, fontSize: "0.9rem", flexShrink: 0 }}>✓</span>
        <span style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text)", flex: 1 }}>{text}</span>
        <span style={{ width: 20, height: 20, borderRadius: "50%", background: open ? color : `${color}20`, color: open ? "#fff" : color, fontSize: "11px", fontWeight: 800, fontStyle: "italic", fontFamily: "Georgia,serif", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s", border: `1px solid ${color}30` }}>i</span>
      </div>
      {open && <p style={{ margin: "5px 0 2px 24px", fontSize: "0.82rem", color: "var(--adm-text2)", lineHeight: 1.5 }}>{tip}</p>}
    </div>
  );
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
  const plan = (activePlan || "FREE").toUpperCase() as TabKey;
  const [subscribeTab, setSubscribeTab] = useState<TabKey>(() => plan === "FREE" ? "GOLD" : plan as TabKey);
  const [subscribing, setSubscribing] = useState(false);
  const [confirmPlan, setConfirmPlan] = useState(false);

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

  const handleSubscribe = async () => {
    if (!rid || subscribing) return;
    setSubscribing(true);
    try {
      const inTrial = billingStatus?.subscriptionStatus === "TRIALING";
      const trialUsed = !!billingStatus?.trialUsed;
      if (subscribeTab === "PREMIUM" && !trialUsed && !inTrial && plan !== "PREMIUM") {
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
        body: JSON.stringify({ restaurantId: rid, plan: subscribeTab }),
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

      {/* ── Plan y Suscripción ── */}
      {(() => {
        const tc = TAB_COLORS[subscribeTab];
        const isCurrentTab = subscribeTab === plan;
        const inTrial = billingStatus?.subscriptionStatus === "TRIALING";
        const isActive = billingStatus?.subscriptionStatus === "ACTIVE";
        const isCanceled = billingStatus?.subscriptionStatus === "CANCELED";
        const trialUsed = !!billingStatus?.trialUsed;
        const hasPaidSub = billingStatus?.hasSubscription && (isActive || billingStatus?.subscriptionStatus === "PAST_DUE");
        const isExempt = billingStatus?.billingExempt;
        const isEarlyRenewal = isCurrentTab && isActive && !!billingStatus?.currentPeriodEnd && new Date(billingStatus.currentPeriodEnd) > new Date();
        const isPremiumTrial = subscribeTab === "PREMIUM" && !trialUsed && !inTrial && plan !== "PREMIUM";
        const showCancelButton = isCurrentTab && (inTrial || isActive) && billingStatus?.hasSubscription;
        const net = billingStatus?.subscriptionStatus && (billingStatus as any).customPlanPriceNet && subscribeTab === plan
          ? (billingStatus as any).customPlanPriceNet
          : planNetAmount(subscribeTab as any);
        const iva = ivaOf(net);
        const gross = grossOf(net);
        const tabLabel = subscribeTab === "FREE" ? "Gratis" : subscribeTab.charAt(0) + subscribeTab.slice(1).toLowerCase();
        const features = PLAN_FEATURES_DISPLAY[subscribeTab as any] || [];
        const inherits = PLAN_INHERITS_FROM[subscribeTab as any];
        const monthlyNet = (billingStatus as any)?.customPlanPriceNet ?? planNetAmount(billingStatus?.plan as PlanKey ?? "FREE");
        const monthlyGross = monthlyNet + ivaOf(monthlyNet);

        return (
          <div style={{ marginBottom: 16 }}>
            {/* Estado actual */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
              borderRadius: 12, marginBottom: 14,
              background: isActive ? "rgba(22,163,74,0.06)" : inTrial ? "rgba(244,166,35,0.06)" : isCanceled ? "rgba(220,38,38,0.06)" : "var(--adm-hover)",
              border: `1px solid ${isActive ? "rgba(22,163,74,0.2)" : inTrial ? "rgba(244,166,35,0.2)" : isCanceled ? "rgba(220,38,38,0.2)" : "var(--adm-card-border)"}`,
            }}>
              {isActive
                ? <CheckCircle2 size={17} color="#16a34a" />
                : inTrial ? <Clock size={17} color={GOLD} />
                : isCanceled ? <XCircle size={17} color="#dc2626" />
                : <CreditCard size={17} color="var(--adm-text3)" />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>
                  Plan {plan === "FREE" ? "Gratis" : plan === "SILVER" ? "Silver" : plan === "GOLD" ? "Gold" : "Premium"}
                  {" "}
                  <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 7px", borderRadius: 99, background: isActive ? "rgba(22,163,74,0.12)" : inTrial ? "rgba(244,166,35,0.12)" : isCanceled ? "rgba(220,38,38,0.12)" : "var(--adm-hover)", color: isActive ? "#16a34a" : inTrial ? GOLD : isCanceled ? "#dc2626" : "var(--adm-text3)" }}>
                    {isActive ? "Activo" : inTrial ? "Prueba" : isCanceled ? "Cancelado" : "Sin suscripción"}
                  </span>
                </p>
                {isActive && billingStatus?.currentPeriodEnd && (
                  <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>Próximo cobro: {formatDate(billingStatus.currentPeriodEnd)}</p>
                )}
                {inTrial && billingStatus?.trialEndsAt && (
                  <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>Prueba hasta el {formatDate(billingStatus.trialEndsAt)}</p>
                )}
                {isCanceled && billingStatus?.currentPeriodEnd && (
                  <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "#dc2626", margin: "2px 0 0" }}>Acceso hasta el {formatDate(billingStatus.currentPeriodEnd)}</p>
                )}
              </div>
              {billingStatus?.lastPaymentAt && (
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)", margin: 0 }}>Último pago</p>
                  <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text)", fontWeight: 600, margin: "2px 0 0" }}>{formatDate(billingStatus.lastPaymentAt)}</p>
                </div>
              )}
            </div>

            {/* Tabs de planes */}
            <div style={{ display: "flex", background: "var(--adm-hover)", borderRadius: 10, padding: 4, marginBottom: 12 }}>
              {ALL_TABS.map(t => {
                const active = subscribeTab === t;
                const color = TAB_COLORS[t].accent;
                return (
                  <button key={t} onClick={() => { setSubscribeTab(t); setConfirmPlan(false); }} style={{
                    flex: 1, padding: "9px 0", border: "none", cursor: "pointer", borderRadius: 7,
                    background: active ? "var(--adm-card)" : "transparent",
                    color: active ? color : "var(--adm-text3)",
                    fontFamily: F, fontSize: "0.8rem", fontWeight: 700,
                    boxShadow: active ? "0 1px 6px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.15s",
                  }}>
                    {t === "FREE" ? "🆓 Gratis" : t === "GOLD" ? "⭐ Gold" : "💎 Premium"}
                    {t === plan && <span style={{ marginLeft: 3, fontSize: "0.6rem", opacity: 0.7 }}>✓</span>}
                  </button>
                );
              })}
            </div>

            {/* Card del plan seleccionado */}
            <div style={{ background: "var(--adm-card)", border: `1.5px solid ${isCurrentTab ? tc.accent + "40" : "var(--adm-card-border)"}`, borderRadius: 16, overflow: "hidden", marginBottom: 10 }}>
              {/* Precio */}
              <div style={{ padding: "18px 20px 14px", background: isCurrentTab ? tc.bg : "transparent", borderBottom: "1px solid var(--adm-card-border)" }}>
                {isCurrentTab && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", background: tc.bg, border: `1px solid ${tc.border}`, borderRadius: 99, marginBottom: 10 }}>
                    <span style={{ color: tc.accent, fontSize: "0.72rem", fontWeight: 700, fontFamily: F }}>✓ Tu plan actual</span>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                  <span style={{ fontFamily: F, fontSize: "2.2rem", fontWeight: 800, color: "var(--adm-text)", lineHeight: 1 }}>
                    {net === 0 ? "$0" : formatCLP(net)}
                  </span>
                  <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", paddingBottom: 5 }}>
                    {net === 0 ? "para siempre" : "+ IVA /mes"}
                  </span>
                </div>
                {net > 0 && (
                  <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "6px 0 0" }}>
                    {formatCLP(gross)} con IVA · Sin contratos · Cancelas cuando quieras
                  </p>
                )}
                {isPremiumTrial && (
                  <div style={{ marginTop: 10, display: "inline-block", padding: "6px 12px", background: "#7c3aed15", border: "1px solid #7c3aed30", borderRadius: 8 }}>
                    <span style={{ fontFamily: F, fontSize: "0.8rem", fontWeight: 700, color: "#7c3aed" }}>7 días gratis para probar</span>
                  </div>
                )}
              </div>
              {/* Features */}
              <div style={{ padding: "14px 20px" }}>
                {inherits && (
                  <div style={{ padding: "3px 0 8px", borderBottom: `1px solid ${tc.border}`, marginBottom: 6 }}>
                    <span style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text3)", fontStyle: "italic" }}>{inherits}</span>
                  </div>
                )}
                {features.length > 0
                  ? features.map(f => <PlanFeatureRow key={f.text} text={f.text} tip={f.tip} color={tc.accent} />)
                  : <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text3)", margin: 0 }}>Carta QR digital · Panel autoadministrable · Editor de platos y precios</p>
                }
              </div>
              {/* Acciones */}
              <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                {!confirmPlan ? (
                  <>
                    {!isCurrentTab && subscribeTab !== "FREE" && (
                      <button onClick={() => setConfirmPlan(true)} disabled={subscribing || !rid} style={{ width: "100%", padding: "13px 0", border: "none", borderRadius: 999, background: tc.accent, color: "#fff", fontFamily: F, fontSize: "0.92rem", fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 14px ${tc.shadow}`, opacity: subscribing ? 0.7 : 1 }}>
                        {isPremiumTrial ? "Empezar 7 días gratis" : `Activar ${tabLabel}`}
                      </button>
                    )}
                    {!isCurrentTab && subscribeTab === "FREE" && plan !== "FREE" && (
                      <button onClick={() => setConfirmPlan(true)} disabled={actioning || !rid} style={{ width: "100%", padding: "12px 0", border: "1px solid #fca5a5", borderRadius: 999, background: "transparent", color: "#dc2626", fontFamily: F, fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" }}>
                        Volver al plan Gratis
                      </button>
                    )}
                    {isCurrentTab && isEarlyRenewal && (
                      <button onClick={() => setConfirmPlan(true)} disabled={subscribing || !rid} style={{ width: "100%", padding: "13px 0", border: "none", borderRadius: 999, background: tc.accent, color: "#fff", fontFamily: F, fontSize: "0.92rem", fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 14px ${tc.shadow}` }}>
                        Renovar por otro mes
                      </button>
                    )}
                    {isCurrentTab && !isEarlyRenewal && (
                      <div style={{ padding: "12px 16px", background: "var(--adm-hover)", borderRadius: 10, textAlign: "center" }}>
                        <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0 }}>
                          {subscribeTab === "FREE" ? "Sin suscripción activa" : "Estás disfrutando de este plan"}
                        </p>
                      </div>
                    )}
                    {!isExempt && showCancelButton && (
                      <button onClick={handleCancel} disabled={actioning} style={{ width: "100%", padding: "10px 0", background: "transparent", border: "1px solid rgba(248,113,113,.3)", borderRadius: 999, color: "#f87171", fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: actioning ? "wait" : "pointer" }}>
                        {actioning ? "Cancelando…" : "Cancelar plan"}
                      </button>
                    )}
                  </>
                ) : (
                  <div style={{ background: "var(--adm-hover)", borderRadius: 12, padding: "16px" }}>
                    <p style={{ fontFamily: F, fontSize: "0.7rem", fontWeight: 700, color: tc.accent, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 10px" }}>Resumen del pedido</p>
                    {isPremiumTrial && subscribeTab !== "FREE" ? (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text2)" }}>Plan {tabLabel} · 7 días gratis</span>
                          <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", fontWeight: 700 }}>$0</span>
                        </div>
                        <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "4px 0 0" }}>Después: {formatCLP(gross)} /mes con IVA</p>
                      </div>
                    ) : subscribeTab === "FREE" ? (
                      <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text2)", marginBottom: 14 }}>Tu suscripción quedará cancelada al final del periodo pagado.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text2)" }}>Plan {tabLabel} (neto)</span>
                          <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)" }}>{formatCLP(net)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text2)" }}>IVA (19%)</span>
                          <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)" }}>{formatCLP(iva)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 7, borderTop: "1px solid var(--adm-card-border)", marginTop: 3 }}>
                          <span style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 700, color: "var(--adm-text)" }}>Total</span>
                          <span style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 700, color: tc.accent }}>{formatCLP(gross)}</span>
                        </div>
                        <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "3px 0 0" }}>Pagas con tarjeta vía Flow.cl (Webpay)</p>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setConfirmPlan(false)} style={{ flex: 1, padding: "11px 0", background: "none", border: "1px solid var(--adm-card-border)", borderRadius: 999, color: "var(--adm-text2)", fontFamily: F, fontSize: "0.82rem", cursor: "pointer" }}>Volver</button>
                      <button onClick={subscribeTab === "FREE" ? handleCancel : handleSubscribe} disabled={subscribing || actioning} style={{ flex: 2, padding: "11px 0", border: "none", borderRadius: 999, background: subscribeTab === "FREE" ? "#dc2626" : tc.accent, color: "#fff", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", opacity: (subscribing || actioning) ? 0.7 : 1 }}>
                        {subscribing ? "Redirigiendo…" : actioning ? "Cancelando…" : subscribeTab === "FREE" ? "Confirmar" : isPremiumTrial ? "Activar prueba" : "Ir a pagar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Detalles de pago */}
            {billingStatus && (billingStatus.lastPaymentAt || billingStatus.currentPeriodEnd || billingStatus.hasSubscription) && (
              <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 18px", marginBottom: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {billingStatus.lastPaymentAt && (
                  <div>
                    <p style={{ fontSize: "0.66rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em", fontFamily: F }}>Último pago</p>
                    <p style={{ fontSize: "0.85rem", color: "var(--adm-text)", margin: "3px 0 0", fontWeight: 600, fontFamily: FB }}>{formatDate(billingStatus.lastPaymentAt)}</p>
                  </div>
                )}
                {billingStatus.currentPeriodEnd && (
                  <div>
                    <p style={{ fontSize: "0.66rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em", fontFamily: F }}>Periodo termina</p>
                    <p style={{ fontSize: "0.85rem", color: "var(--adm-text)", margin: "3px 0 0", fontWeight: 600, fontFamily: FB }}>{formatDate(billingStatus.currentPeriodEnd)}</p>
                  </div>
                )}
                {billingStatus.hasSubscription && monthlyNet > 0 && (
                  <div>
                    <p style={{ fontSize: "0.66rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em", fontFamily: F }}>Cobro mensual</p>
                    <p style={{ fontSize: "0.85rem", color: "var(--adm-text)", margin: "3px 0 0", fontWeight: 600, fontFamily: FB }}>{formatCLP(monthlyGross)}</p>
                    <p style={{ fontSize: "0.64rem", color: "var(--adm-text3)", margin: "2px 0 0", fontFamily: FB }}>{formatCLP(monthlyNet)} neto + {formatCLP(ivaOf(monthlyNet))} IVA</p>
                  </div>
                )}
                {billingStatus.hasSubscription && (
                  <div>
                    <p style={{ fontSize: "0.66rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em", fontFamily: F }}>Pasarela</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <p style={{ fontSize: "0.85rem", color: "var(--adm-text)", margin: 0, fontWeight: 600, fontFamily: FB }}>Flow.cl (Webpay)</p>
                      <a href="https://www.flow.cl/app/web/misDatos.php" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 3, fontSize: "0.72rem", color: GOLD, textDecoration: "none", fontFamily: F }}>
                        Gestionar <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                )}
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




      {/* QR Modal */}
      {qrModalOpen && selectedRestaurant && (
        <QRGeneratorModal restaurant={selectedRestaurant} onClose={() => setQrModalOpen(false)} />
      )}
    </div>
  );
}
