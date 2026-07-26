"use client";
import { useState, useEffect } from "react";
import { ShoppingCart, Copy, Check, ExternalLink, Truck, Package, Layers, Phone, Clock, FileText, DollarSign, Lock } from "lucide-react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { toast } from "sonner";
import SkeletonLoading from "@/components/admin/SkeletonLoading";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-input-border)",
  borderRadius: 8, fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)",
  outline: "none", boxSizing: "border-box",
};

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

const DELIVERY_OPTIONS = [
  { value: "PICKUP", label: "Solo retiro", icon: Package },
  { value: "DELIVERY", label: "Solo delivery", icon: Truck },
  { value: "BOTH", label: "Ambos", icon: Layers },
] as const;

export default function PedirOnlinePage() {
  const { selectedRestaurantId } = useAdminSession();
  const rid = selectedRestaurantId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<OrderingData | null>(null);
  const [copied, setCopied] = useState(false);

  // form state
  const [enabled, setEnabled] = useState(false);
  const [phone, setPhone] = useState("");
  const [delivery, setDelivery] = useState<"PICKUP" | "DELIVERY" | "BOTH">("PICKUP");
  const [minAmount, setMinAmount] = useState("");
  const [waitTime, setWaitTime] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!rid) return;
    setLoading(true);
    fetch(`/api/admin/locales/${rid}`)
      .then(r => r.json())
      .then((d: OrderingData) => {
        setData(d);
        setEnabled(d.orderingEnabled ?? false);
        // Prioridad: número guardado → whatsapp del restaurante → whatsapp del dueño
        setPhone(d.orderingPhone || d.whatsapp || d.owner?.whatsapp || "");
        setDelivery((d.orderingDelivery as "PICKUP" | "DELIVERY" | "BOTH") || "BOTH");
        setMinAmount(d.orderingMinAmount != null ? String(d.orderingMinAmount) : "");
        setWaitTime(d.orderingWaitTime || "");
        setNote(d.orderingNote || "");
      })
      .catch(() => toast.error("Error al cargar configuración"))
      .finally(() => setLoading(false));
  }, [rid]);

  const save = async () => {
    if (!rid) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/locales/${rid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderingEnabled: enabled,
          orderingPhone: phone.trim() || null,
          orderingDelivery: delivery,
          orderingMinAmount: minAmount ? parseInt(minAmount, 10) : null,
          orderingWaitTime: waitTime.trim() || null,
          orderingNote: note.trim() || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setData(updated);
        toast.success("Configuración guardada");
      } else {
        const err = await res.json();
        toast.error(err.error || "Error al guardar");
      }
    } catch { toast.error("Error de conexión"); }
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

  // Premium gate
  if (!data || data.plan !== "PREMIUM") {
    return (
      <div style={{ padding: "32px 20px", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(244,166,35,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Lock size={24} color={GOLD} />
        </div>
        <h2 style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 8px" }}>
          Pedidos online es exclusivo del plan Premium
        </h2>
        <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text2)", margin: "0 0 20px", lineHeight: 1.6 }}>
          Permite que tus clientes armen su pedido desde el celular y te lo envíen directo por WhatsApp. Sin comisiones, sin apps de terceros.
        </p>
        <a href="/panel/mi-restaurant?section=plans" style={{ display: "inline-block", padding: "10px 22px", background: GOLD, color: "#fff", borderRadius: 999, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, textDecoration: "none" }}>
          Ver plan Premium
        </a>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 0 40px" }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <ShoppingCart size={20} color={GOLD} />
          <h2 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>
            Pedidos online
          </h2>
        </div>
        <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
          Tus clientes eligen sus platos, arman el pedido y te lo envían por WhatsApp. Sin comisiones ni apps de terceros.
        </p>
      </div>

      {/* Activar / desactivar */}
      <div style={{ background: "var(--adm-card)", border: `1px solid ${enabled ? "rgba(22,163,74,0.3)" : "var(--adm-card-border)"}`, borderRadius: 16, padding: "16px 18px", marginBottom: 16, transition: "border-color 0.2s" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 3px" }}>
              {enabled ? "✅ Pedidos activados" : "Activar pedidos online"}
            </p>
            <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0 }}>
              {enabled ? "Tus clientes pueden pedirte a través del link" : "Los clientes aún no pueden hacer pedidos"}
            </p>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
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
            Tu link de pedidos
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", margin: 0, flex: 1, wordBreak: "break-all" }}>
              {orderUrl}
            </p>
            <button onClick={copyLink} style={{ flexShrink: 0, padding: "6px 12px", border: "none", borderRadius: 8, background: GOLD, color: "#fff", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copiado" : "Copiar"}
            </button>
            <a href={orderUrl} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, padding: "6px 10px", border: "1px solid var(--adm-card-border)", borderRadius: 8, color: "var(--adm-text2)", display: "flex", alignItems: "center" }}>
              <ExternalLink size={13} />
            </a>
          </div>
          <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "8px 0 0" }}>
            Comparte este link por WhatsApp, Instagram o donde quieras. Tus clientes podrán hacer su pedido sin descargar ninguna app.
          </p>
        </div>
      )}

      {/* Config */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px 18px", marginBottom: 16 }}>

        {/* WhatsApp destino */}
        <Field
          label="WhatsApp del local"
          hint="Número donde llegará el pedido. Incluye código de país: +56912345678"
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Phone size={16} color="var(--adm-text3)" style={{ flexShrink: 0 }} />
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              style={inputStyle}
              placeholder="+56912345678"
              type="tel"
            />
          </div>
        </Field>

        {/* Tipo de entrega */}
        <Field label="Tipo de entrega disponible">
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

        {/* Monto mínimo */}
        {(delivery === "DELIVERY" || delivery === "BOTH") && (
          <Field
            label="Monto mínimo para delivery"
            hint="Si el carrito no llega a este monto, se avisa al cliente en el checkout. Dejar vacío para sin mínimo."
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
        <Field label="Tiempo de espera estimado" hint="Texto libre que verán los clientes en el checkout.">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={16} color="var(--adm-text3)" style={{ flexShrink: 0 }} />
            <input
              value={waitTime}
              onChange={e => setWaitTime(e.target.value)}
              style={inputStyle}
              placeholder="Ej: 30-45 min"
            />
          </div>
        </Field>

        {/* Nota personalizada */}
        <Field label="Mensaje para el cliente" hint="Aparece al final del checkout, antes de enviar el pedido.">
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
          {saving ? "Guardando..." : "Guardar configuración"}
        </button>
      </div>

      {/* Info */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "14px 16px" }}>
        <p style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 700, color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: ".05em", margin: "0 0 10px" }}>
          ¿Cómo funciona?
        </p>
        {[
          "El cliente abre tu link de pedidos y ve toda tu carta",
          "Elige los platos, cantidad y modificadores (tamaño, extras, etc.)",
          "Completa el checkout con su nombre, teléfono y dirección si es delivery",
          "Con un tap se abre WhatsApp con el pedido listo para enviarte",
          "Tú recibes el mensaje en tu WhatsApp y coordinas directamente con el cliente",
        ].map((step, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
            <span style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(244,166,35,0.15)", color: GOLD, fontFamily: F, fontSize: "0.7rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
              {i + 1}
            </span>
            <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
