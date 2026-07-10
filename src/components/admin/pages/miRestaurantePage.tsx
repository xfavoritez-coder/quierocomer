"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import PlanGate from "@/components/admin/PlanGate";
import { toast } from "sonner";
import { Camera, Phone, Globe, MapPin, Clock, QrCode, Bell, Copy, ExternalLink, Check, Store, Receipt, CreditCard, Shield, XCircle, Sparkles } from "lucide-react";
import { planNetAmount, ivaOf, type PlanKey } from "@/lib/billing/plans-config";
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
  ivaRate?: number;
  billingInfo?: { isComplete: boolean; missingFields: string[] };
};

function formatCLP(amount: number) {
  return `$${amount.toLocaleString("es-CL")}`;
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

  if (loading) return <SkeletonLoading type="form" />;
  if (!data || !rid) return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "var(--adm-text2)", fontFamily: F }}>Selecciona un restaurant</p></div>;

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}><Store size={20} color="var(--adm-text3)" /> Mi Restaurante</h1>
      <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 20px" }}>Configura la información y apariencia de tu local</p>

      {/* ── Plan actual ── */}
      {(() => {
        const plans = [
          { key: "FREE", label: "Gratis", price: "$0", color: "#888", bg: "var(--adm-hover)", icon: "📋" },
          { key: "SILVER", label: "Silver", price: "$14.900", color: "#94a3b8", bg: "linear-gradient(135deg, rgba(148,163,184,0.15), rgba(148,163,184,0.05))", icon: "🥈" },
          { key: "GOLD", label: "Gold", price: "$29.900", color: "#F4A623", bg: "linear-gradient(135deg, rgba(244,166,35,0.15), rgba(244,166,35,0.05))", icon: "🥇" },
          { key: "PREMIUM", label: "Premium", price: "$44.900", color: "#a78bfa", bg: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(124,58,237,0.05))", icon: "💎" },
        ];
        const current = plans.find(p => p.key === activePlan) || plans[0];
        return (
          <div style={{ marginBottom: 16 }}>
            {/* Active plan */}
            <div style={{
              padding: "20px 20px 18px", borderRadius: 16, overflow: "hidden", position: "relative",
              background: current.bg,
              border: `1.5px solid ${current.color}30`,
              marginBottom: 10,
            }}>
              <div style={{ position: "absolute", top: -30, right: -20, fontSize: "5rem", opacity: 0.06, pointerEvents: "none" }}>{current.icon}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: "1.3rem" }}>{current.icon}</span>
                <span style={{ fontFamily: F, fontSize: "0.68rem", fontWeight: 700, color: current.color, textTransform: "uppercase", letterSpacing: "1px" }}>Plan activo</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontFamily: F, fontSize: "1.4rem", fontWeight: 800, color: "var(--adm-text)", margin: 0, letterSpacing: "-0.5px" }}>
                    {current.label}
                  </p>
                  {data?.subscriptionStatus === "ACTIVE" && data?.currentPeriodEnd && (
                    <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "3px 0 0" }}>
                      Activo hasta el <strong style={{ color: "var(--adm-text2)" }}>{new Date(data.currentPeriodEnd).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}</strong>
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                  {data?.subscriptionStatus === "ACTIVE" && (
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent("show-plan-modal", { detail: { initialTab: data.plan?.toUpperCase(), renew: true } }))}
                      style={{
                        padding: "6px 14px", borderRadius: 999, border: `1.5px solid ${current.color}`, cursor: "pointer",
                        background: "transparent", color: current.color,
                        fontFamily: F, fontSize: "0.72rem", fontWeight: 700,
                      }}
                    >
                      Renovar
                    </button>
                  )}
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent("show-plan-modal"))}
                    style={{
                      padding: "6px 14px", borderRadius: 999, border: "none", cursor: "pointer",
                      background: current.color, color: "#fff",
                      fontFamily: F, fontSize: "0.72rem", fontWeight: 700,
                      boxShadow: `0 4px 16px ${current.color}30`,
                    }}
                  >
                    Ver planes
                  </button>
                </div>
              </div>
            </div>
            {/* Trial end date banner */}
            {data?.subscriptionStatus === "TRIALING" && data?.trialEndsAt && (() => {
              const trialDate = new Date(data.trialEndsAt);
              const dateStr = trialDate.toLocaleDateString("es-CL", { day: "numeric", month: "long" });
              return (
                <div style={{
                  padding: "12px 16px", borderRadius: 12,
                  background: "rgba(167,139,250,0.08)",
                  border: "1px solid rgba(167,139,250,0.25)",
                  display: "flex", alignItems: "flex-start", gap: 10,
                }}>
                  <span style={{ fontSize: "1rem", flexShrink: 0 }}>🎁</span>
                  <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
                    Tienes este plan gratis hasta el <strong style={{ color: "var(--adm-text)" }}>{dateStr}</strong>. Luego la carta vuelve al plan gratuito, no perderás nada.
                  </p>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* ── Suscripción detalles ── */}
      {billingStatus && (() => {
        const isExempt = billingStatus.billingExempt;
        const hasPaidSub = billingStatus.hasSubscription && (billingStatus.subscriptionStatus === "ACTIVE" || billingStatus.subscriptionStatus === "PAST_DUE");
        const monthlyNet = (billingStatus as any).customPlanPriceNet ?? planNetAmount(billingStatus.plan as PlanKey);
        const monthlyIva = ivaOf(monthlyNet);
        const monthlyGross = monthlyNet + monthlyIva;
        const formatDate = (d: string | null) => !d ? "—" : new Date(d).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });

        return (
          <>
            {/* Details grid inside a card */}
            {(billingStatus.lastPaymentAt || billingStatus.currentPeriodEnd || billingStatus.hasSubscription) && (
              <div style={{
                background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
                borderRadius: 16, padding: "18px 20px", marginBottom: 10,
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14,
              }}>
                {billingStatus.lastPaymentAt && (
                  <div>
                    <p style={{ fontSize: "0.68rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em", fontFamily: F }}>Último pago</p>
                    <p style={{ fontSize: "0.88rem", color: "var(--adm-text)", margin: "3px 0 0", fontWeight: 600, fontFamily: FB }}>{formatDate(billingStatus.lastPaymentAt)}</p>
                  </div>
                )}
                {billingStatus.currentPeriodEnd && (
                  <div>
                    <p style={{ fontSize: "0.68rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em", fontFamily: F }}>Periodo termina</p>
                    <p style={{ fontSize: "0.88rem", color: "var(--adm-text)", margin: "3px 0 0", fontWeight: 600, fontFamily: FB }}>{formatDate(billingStatus.currentPeriodEnd)}</p>
                  </div>
                )}
                {billingStatus.hasSubscription && monthlyNet > 0 && (
                  <div>
                    <p style={{ fontSize: "0.68rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em", fontFamily: F }}>Cobro mensual</p>
                    <p style={{ fontSize: "0.88rem", color: "var(--adm-text)", margin: "3px 0 0", fontWeight: 600, fontFamily: FB }}>{formatCLP(monthlyGross)}</p>
                    <p style={{ fontSize: "0.66rem", color: "var(--adm-text3)", margin: "2px 0 0", fontFamily: FB }}>{formatCLP(monthlyNet)} neto + {formatCLP(monthlyIva)} IVA</p>
                  </div>
                )}
                {billingStatus.hasSubscription && (
                  <div>
                    <p style={{ fontSize: "0.68rem", color: "var(--adm-text3)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em", fontFamily: F }}>Pasarela</p>
                    <p style={{ fontSize: "0.88rem", color: "var(--adm-text)", margin: "3px 0 0", fontWeight: 600, fontFamily: FB }}>Flow.cl (Webpay)</p>
                  </div>
                )}
              </div>
            )}

            {/* Método de pago */}
            {hasPaidSub && (
              <div style={{
                background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
                borderRadius: 16, padding: "16px 20px", marginBottom: 10,
              }}>
                <p style={{ fontFamily: F, fontSize: "0.68rem", fontWeight: 700, color: "var(--adm-text3)", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: ".6px", display: "flex", alignItems: "center", gap: 6 }}>
                  <Shield size={13} /> Método de pago
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 28, borderRadius: 6, background: "rgba(255,255,255,.06)", border: "1px solid var(--adm-card-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <CreditCard size={16} color="var(--adm-text3)" />
                    </div>
                    <div>
                      <p style={{ fontSize: "0.85rem", color: "var(--adm-text)", margin: 0, fontWeight: 600, fontFamily: FB }}>Tarjeta vía Webpay</p>
                      <p style={{ fontSize: "0.74rem", color: "var(--adm-text3)", margin: "2px 0 0", fontFamily: FB }}>Registrada en Flow.cl</p>
                    </div>
                  </div>
                  <a href="https://www.flow.cl/app/web/misDatos.php" target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.76rem", color: GOLD, textDecoration: "none", fontWeight: 600, fontFamily: F }}>
                    Gestionar <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            )}

            {/* Cancelar */}
            {!isExempt && hasPaidSub && (
              <div style={{
                background: "var(--adm-card)", border: "1px solid rgba(248,113,113,.15)",
                borderRadius: 16, padding: "16px 20px", marginBottom: 10,
              }}>
                <p style={{ fontFamily: F, fontSize: "0.68rem", fontWeight: 700, color: "var(--adm-text3)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: ".6px", display: "flex", alignItems: "center", gap: 6 }}>
                  <XCircle size={13} /> Cancelar suscripción
                </p>
                <p style={{ fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 12px", lineHeight: 1.6, fontFamily: FB }}>
                  Si cancelas, mantienes acceso hasta el final del periodo pagado. Tu carta sigue funcionando en plan Gratis.
                </p>
                <button onClick={handleCancel} disabled={actioning} style={{
                  padding: "8px 16px", background: "transparent", color: "#f87171",
                  border: "1px solid rgba(248,113,113,.3)", borderRadius: 999,
                  fontFamily: F, fontSize: "0.78rem", fontWeight: 600,
                  cursor: actioning ? "wait" : "pointer",
                }}>
                  {actioning ? "Cancelando…" : "Cancelar mi plan"}
                </button>
              </div>
            )}
          </>
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



      {/* ── Opciones de carta ── */}
      <Card title="Opciones de carta" icon={Sparkles}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 2px" }}>Asistente Genio ✨</p>
            <p style={{ fontFamily: F, fontSize: "0.75rem", color: "var(--adm-text2)", margin: 0 }}>Muestra el botón flotante de recomendaciones en la carta digital</p>
          </div>
          <button
            onClick={() => {
              const next = !genioFabEnabled;
              setGenioFabEnabled(next);
              save({ genioFabEnabled: next });
            }}
            style={{
              flexShrink: 0, width: 44, height: 24, borderRadius: 12, cursor: "pointer",
              border: "none", padding: 2,
              background: genioFabEnabled ? GOLD : "var(--adm-input-border)",
              transition: "background 0.2s",
              position: "relative",
            }}
          >
            <span style={{
              display: "block", width: 20, height: 20, borderRadius: "50%", background: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
              transform: genioFabEnabled ? "translateX(20px)" : "translateX(0)",
              transition: "transform 0.2s",
            }} />
          </button>
        </div>
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
