"use client";
import { useState, useEffect, useRef } from "react";
import { ShoppingCart, Copy, Check, ExternalLink, Truck, Package, Layers, Clock, FileText, DollarSign } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import { toast } from "sonner";
import SkeletonLoading from "@/components/admin/SkeletonLoading";
import { usePanelLang } from "@/lib/i18n/panel";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-input-border)",
  borderRadius: 8, fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)",
  outline: "none", boxSizing: "border-box",
};

// ─── Country phone config ────────────────────────────────────────────────────
const PHONE_COUNTRIES = [
  {
    code: "CL",
    dial: "+56",
    placeholder: "9 1234 5678",
    maxDigits: 9,
    flag: (
      <svg width="20" height="14" viewBox="0 0 20 14" style={{ borderRadius: 2, flexShrink: 0 }}>
        <rect width="20" height="7" fill="#fff"/>
        <rect y="7" width="20" height="7" fill="#D52B1E"/>
        <rect width="7" height="7" fill="#002D62"/>
        <polygon points="3.5,1.5 4.2,3.5 6.2,3.5 4.7,4.7 5.3,6.7 3.5,5.5 1.7,6.7 2.3,4.7 0.8,3.5 2.8,3.5" fill="#fff"/>
      </svg>
    ),
  },
  {
    code: "US",
    dial: "+1",
    placeholder: "555 123 4567",
    maxDigits: 10,
    flag: (
      <svg width="20" height="14" viewBox="0 0 20 14" style={{ borderRadius: 2, flexShrink: 0 }}>
        <rect width="20" height="14" fill="#B22234"/>
        <rect y="1.08" width="20" height="1.08" fill="#fff"/>
        <rect y="3.23" width="20" height="1.08" fill="#fff"/>
        <rect y="5.38" width="20" height="1.08" fill="#fff"/>
        <rect y="7.54" width="20" height="1.08" fill="#fff"/>
        <rect y="9.69" width="20" height="1.08" fill="#fff"/>
        <rect y="11.85" width="20" height="1.08" fill="#fff"/>
        <rect width="8" height="7.54" fill="#3C3B6E"/>
      </svg>
    ),
  },
] as const;

type CountryCode = "CL" | "US";

function formatPhone(v: string, country: CountryCode) {
  const c = PHONE_COUNTRIES.find(p => p.code === country)!;
  const d = v.replace(/\D/g, "").slice(0, c.maxDigits);
  if (country === "US") {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
    return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  }
  if (d.length <= 1) return d;
  if (d.length <= 5) return `${d[0]} ${d.slice(1)}`;
  return `${d[0]} ${d.slice(1, 5)} ${d.slice(5)}`;
}

function buildFullPhone(local: string, country: CountryCode): string | undefined {
  const digits = local.replace(/\D/g, "");
  if (!digits) return undefined;
  const dial = PHONE_COUNTRIES.find(p => p.code === country)!.dial;
  return `${dial}${digits}`;
}

function parseStoredPhone(stored: string | null | undefined): { country: CountryCode; local: string } {
  if (!stored) return { country: "CL", local: "" };
  if (stored.startsWith("+1")) return { country: "US", local: stored.slice(2) };
  if (stored.startsWith("+56")) return { country: "CL", local: stored.slice(3) };
  // no dial prefix — assume CL
  return { country: "CL", local: stored.replace(/\D/g, "") };
}

function PhoneCountrySelector({ country, onChange }: { country: CountryCode; onChange: (c: CountryCode) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = PHONE_COUNTRIES.find(p => p.code === country)!;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "10px 10px", borderRadius: 8, border: "1px solid var(--adm-input-border)",
          background: "var(--adm-input)", color: "var(--adm-text)", cursor: "pointer",
          fontFamily: FB, fontSize: "0.82rem", whiteSpace: "nowrap",
        }}
      >
        {current.flag}
        <span style={{ fontWeight: 600 }}>{current.dial}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ marginLeft: 2 }}>
          <path d="M1 1l4 4 4-4" stroke="var(--adm-text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 200,
          background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
          borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.2)", minWidth: 120,
        }}>
          {PHONE_COUNTRIES.map(c => (
            <button
              key={c.code}
              type="button"
              onClick={() => { onChange(c.code); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                width: "100%", padding: "10px 14px", border: "none", cursor: "pointer",
                background: c.code === country ? "var(--adm-hover)" : "transparent",
                color: "var(--adm-text)", fontSize: 14, fontWeight: c.code === country ? 600 : 400,
                fontFamily: FB,
              }}
            >
              {c.flag}
              <span>{c.dial}</span>
              <span style={{ color: "var(--adm-text3)", fontSize: 12 }}>{c.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface OrderingData {
  id: string;
  slug: string;
  plan: string;
  orderingEnabled: boolean;
  orderingPhone: string | null;
  orderingDelivery: string;
  orderingMinAmount: number | null;
  orderingWaitTime: string | null;
  orderingNote: string | null;
  orderingPaymentMethods: string;
  whatsapp: string | null;
  owner?: { whatsapp?: string | null } | null;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, color: "var(--adm-text2)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".04em" }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "5px 0 0" }}>{hint}</p>}
    </div>
  );
}

export default function PedirOnlinePage() {
  const { t } = usePanelLang();
  const { selectedRestaurantId } = useAdminSession();
  const { activePlan } = usePanelSession();

  const DELIVERY_OPTIONS = [
    { value: "BOTH" as const, label: t("ordering_delivery_both"), icon: Layers },
    { value: "PICKUP" as const, label: t("ordering_delivery_pickup"), icon: Package },
    { value: "DELIVERY" as const, label: t("ordering_delivery_delivery"), icon: Truck },
  ];
  const rid = selectedRestaurantId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<OrderingData | null>(null);
  const [copied, setCopied] = useState(false);

  // form state
  const [enabled, setEnabled] = useState(false);
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>("CL");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [delivery, setDelivery] = useState<"PICKUP" | "DELIVERY" | "BOTH">("BOTH");
  const [minAmount, setMinAmount] = useState("");
  const [waitTime, setWaitTime] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<string[]>(["efectivo", "transferencia", "tarjeta"]);

  useEffect(() => {
    if (!rid) return;
    setLoading(true);
    fetch(`/api/admin/locales/${rid}`)
      .then(r => r.json())
      .then((d: OrderingData) => {
        setData(d);
        setEnabled(d.orderingEnabled ?? false);
        // Track section visit
        fetch("/api/panel/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId: rid, action: "pedidos_online_visit", details: { orderingEnabled: d.orderingEnabled ?? false } }),
        }).catch(() => {});
        const rawPhone = d.orderingPhone || d.whatsapp || d.owner?.whatsapp || "";
        const { country, local } = parseStoredPhone(rawPhone);
        setPhoneCountry(country);
        setPhoneLocal(local ? formatPhone(local, country) : "");
        setDelivery((d.orderingDelivery as "PICKUP" | "DELIVERY" | "BOTH") || "BOTH");
        setMinAmount(d.orderingMinAmount != null ? String(d.orderingMinAmount) : "");
        setWaitTime(d.orderingWaitTime || "");
        setNote(d.orderingNote || "");
        setPaymentMethods((d.orderingPaymentMethods || "efectivo,transferencia,tarjeta").split(",").filter(Boolean));
      })
      .catch(() => toast.error(t("ordering_error_load")))
      .finally(() => setLoading(false));
  }, [rid]);

  const ORDERING_EXCEPTIONS = ["el-menu-de-la-esquina"];
  const isPremium = (data?.plan === "PREMIUM") || (activePlan === "PREMIUM") || ORDERING_EXCEPTIONS.includes(data?.slug ?? "") || (data as any)?.subscriptionStatus === "TRIALING";

  const [togglingEnabled, setTogglingEnabled] = useState(false);

  const toggleEnabled = async () => {
    if (!rid || togglingEnabled) return;
    if (!isPremium) { window.dispatchEvent(new CustomEvent("show-plan-modal", { detail: { initialTab: "PREMIUM", source: "pedidos_online" } })); return; }
    const newVal = !enabled;
    setEnabled(newVal);
    setTogglingEnabled(true);
    try {
      const res = await fetch("/api/panel/ordering-enabled", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: rid, orderingEnabled: newVal }),
      });
      if (res.ok) {
        toast.success(newVal ? t("ordering_activated") : t("ordering_deactivated"));
        fetch("/api/panel/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId: rid, action: newVal ? "pedidos_online_activated" : "pedidos_online_deactivated" }),
        }).catch(() => {});
      } else {
        const err = await res.json().catch(() => ({}));
        setEnabled(!newVal);
        toast.error(err.error || t("ordering_error_save"));
      }
    } catch { setEnabled(!newVal); toast.error(t("ordering_error_connection")); }
    setTogglingEnabled(false);
  };

  const save = async () => {
    if (!rid) return;
    setSaving(true);
    try {
      const fullPhone = buildFullPhone(phoneLocal, phoneCountry);
      const res = await fetch(`/api/admin/locales/${rid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderingPhone: fullPhone || null,
          orderingDelivery: delivery,
          orderingMinAmount: minAmount ? parseInt(minAmount, 10) : null,
          orderingWaitTime: waitTime.trim() || null,
          orderingNote: note.trim() || null,
          orderingPaymentMethods: paymentMethods.join(",") || "efectivo,transferencia,tarjeta",
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setData(updated);
        toast.success(t("saved"));
      } else {
        const err = await res.json();
        toast.error(err.error || t("ordering_error_save"));
      }
    } catch { toast.error(t("ordering_error_connection")); }
    setSaving(false);
  };

  const orderUrl = data ? `${typeof window !== "undefined" ? window.location.origin : "https://quierocomer.com"}/pedir/${data.slug}` : "";

  const copyLink = () => {
    if (!orderUrl) return;
    navigator.clipboard.writeText(orderUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return <SkeletonLoading />;

  return (
    <>
    <div style={{ padding: "0 0 40px" }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <ShoppingCart size={20} color={GOLD} />
          <h2 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>
            {t("ordering_title")}
          </h2>
        </div>
        <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
          {t("ordering_desc")}
        </p>
      </div>

      {/* Activar / desactivar */}
      <div style={{ background: "var(--adm-card)", border: `1px solid ${enabled ? "rgba(22,163,74,0.3)" : "var(--adm-card-border)"}`, borderRadius: 16, padding: "16px 18px", marginBottom: 16, transition: "border-color 0.2s" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 3px" }}>
              {enabled ? t("ordering_enabled") : t("ordering_disabled")}
            </p>
            <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0 }}>
              {enabled ? t("ordering_enabled_desc") : t("ordering_disabled_desc")}
            </p>
          </div>
          <button
            onClick={toggleEnabled}
            disabled={togglingEnabled}
            style={{
              width: 48, height: 28, borderRadius: 999, border: "none", cursor: "pointer",
              background: enabled ? "#16a34a" : "var(--adm-input-border)",
              position: "relative", transition: "background 0.2s", flexShrink: 0,
            }}
          >
            <span style={{
              display: "block", width: 20, height: 20, borderRadius: "50%", background: "#fff",
              position: "absolute", top: 4, left: enabled ? 24 : 4, transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }} />
          </button>
        </div>
      </div>

      {/* Link de pedidos */}
      {enabled && (
        <div style={{ background: "rgba(244,166,35,0.06)", border: "1px solid rgba(244,166,35,0.2)", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
          <p style={{ fontFamily: F, fontSize: "0.72rem", fontWeight: 600, color: GOLD, textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 8px" }}>
            {t("ordering_link_label")}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <a href={orderUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", margin: 0, flex: 1, wordBreak: "break-all", textDecoration: "underline", textDecorationColor: "rgba(244,166,35,0.4)" }}>
              {orderUrl}
            </a>
            <button onClick={copyLink} style={{ flexShrink: 0, padding: "6px 12px", border: "none", borderRadius: 8, background: GOLD, color: "#fff", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? t("copied") : t("copy")}
            </button>
            <a href={orderUrl} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, padding: "6px 10px", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text2)", display: "flex", alignItems: "center" }}>
              <ExternalLink size={13} />
            </a>
          </div>
          <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text2)", margin: "8px 0 0" }}>
            {t("ordering_link_share")}
          </p>

          {/* QR */}
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ background: "#fff", padding: 10, borderRadius: 12, flexShrink: 0 }}>
              <QRCodeSVG value={orderUrl} size={96} />
            </div>
            <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
              Imprime este QR en mesas o mostrador para que tus clientes hagan su pedido directo desde el teléfono.
            </p>
          </div>
        </div>
      )}

      {/* Config */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px 18px", marginBottom: 16 }}>

        {/* WhatsApp destino */}
        <Field
          label={t("ordering_whatsapp")}
          hint={t("ordering_whatsapp_hint")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PhoneCountrySelector country={phoneCountry} onChange={c => { setPhoneCountry(c); setPhoneLocal(""); }} />
            <input
              value={phoneLocal}
              onChange={e => setPhoneLocal(formatPhone(e.target.value, phoneCountry))}
              style={inputStyle}
              placeholder={PHONE_COUNTRIES.find(p => p.code === phoneCountry)!.placeholder}
              type="tel"
            />
          </div>
        </Field>

        {/* Tipo de entrega */}
        <Field label={t("ordering_delivery_type")}>
          <div style={{ display: "flex", gap: 8 }}>
            {DELIVERY_OPTIONS.map(opt => {
              const active = delivery === opt.value;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => setDelivery(opt.value)}
                  style={{
                    flex: 1, padding: "10px 8px", borderRadius: 10, cursor: "pointer",
                    background: active ? "rgba(244,166,35,0.12)" : "var(--adm-input)",
                    border: active ? `1px solid rgba(244,166,35,0.4)` : "1px solid transparent",
                    color: active ? GOLD : "var(--adm-text3)",
                    fontFamily: F, fontSize: "0.75rem", fontWeight: active ? 700 : 500,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                    transition: "all 0.15s",
                  }}
                >
                  <Icon size={16} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Métodos de pago */}
        <Field label={t("ordering_payment_methods")} hint={t("ordering_payment_hint")}>
          <div style={{ display: "flex", gap: 8 }}>
            {([
              { value: "efectivo", label: t("ordering_payment_cash") },
              { value: "transferencia", label: t("ordering_payment_transfer") },
              { value: "tarjeta", label: t("ordering_payment_card") },
            ] as const).map(({ value, label }) => {
              const active = paymentMethods.includes(value);
              return (
                <button
                  key={value}
                  onClick={() => setPaymentMethods(prev =>
                    active ? prev.filter(m => m !== value) : [...prev, value]
                  )}
                  style={{
                    flex: 1, padding: "10px 8px", borderRadius: 10, cursor: "pointer",
                    background: active ? "rgba(244,166,35,0.12)" : "var(--adm-input)",
                    border: active ? `1px solid rgba(244,166,35,0.4)` : "1px solid transparent",
                    color: active ? GOLD : "var(--adm-text3)",
                    fontFamily: F, fontSize: "0.75rem", fontWeight: active ? 700 : 500,
                    transition: "all 0.15s",
                  }}
                >
                  {active ? "✓ " : ""}{label}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Monto mínimo */}
        {(delivery === "DELIVERY" || delivery === "BOTH") && (
          <Field
            label={t("ordering_min_amount")}
            hint={t("ordering_min_amount_hint")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <DollarSign size={16} color="var(--adm-text3)" style={{ flexShrink: 0 }} />
              <input
                value={minAmount}
                onChange={e => setMinAmount(e.target.value.replace(/\D/g, ""))}
                style={inputStyle}
                placeholder="Ej: 5000"
                inputMode="numeric"
              />
            </div>
          </Field>
        )}

        {/* Tiempo de espera */}
        <Field label={t("ordering_wait_time")} hint={t("ordering_wait_time_hint")}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={16} color="var(--adm-text3)" style={{ flexShrink: 0 }} />
            <input
              value={waitTime}
              onChange={e => setWaitTime(e.target.value)}
              style={inputStyle}
              placeholder={t("ordering_wait_time_placeholder")}
            />
          </div>
        </Field>

        {/* Nota personalizada */}
        <Field label={t("ordering_note")} hint={t("ordering_note_hint")}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <FileText size={16} color="var(--adm-text3)" style={{ flexShrink: 0, marginTop: 12 }} />
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              style={{ ...inputStyle, resize: "vertical", minHeight: 72 }}
              placeholder="Ej: Solo hacemos delivery dentro de Providencia y Las Condes."
            />
          </div>
        </Field>

        <button
          onClick={save}
          disabled={saving}
          style={{ width: "100%", padding: 11, background: GOLD, color: "#fff", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? t("ordering_saving") : t("ordering_save")}
        </button>
      </div>
    </div>
    </>
  );
}
