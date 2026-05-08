"use client";
import { useState, useEffect, useCallback, useContext } from "react";
import { SessionContext } from "@/lib/admin/SessionContext";
import { toast } from "sonner";
import { Receipt, FileText } from "lucide-react";
import SkeletonLoading from "@/components/admin/SkeletonLoading";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

type BillingInfo = {
  billingCompanyName: string | null;
  billingRut: string | null;
  billingGiro: string | null;
  billingAddress: string | null;
  billingCity: string | null;
  billingEmail: string | null;
  billingContactName: string | null;
  billingPhone: string | null;
  isComplete: boolean;
  missingFields: string[];
};

const FIELD_LABELS: Record<string, string> = {
  billingCompanyName: "Razón social",
  billingRut: "RUT",
  billingGiro: "Giro",
  billingAddress: "Dirección comercial",
  billingCity: "Comuna / Ciudad",
  billingEmail: "Email facturación",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", background: "var(--adm-input)",
  border: "1px solid var(--adm-input-border)", borderRadius: 8,
  fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)",
  outline: "none", boxSizing: "border-box",
};

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5, fontWeight: 500 }}>
        {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
      </label>
      {children}
      {hint && <p style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)", marginTop: 3 }}>{hint}</p>}
    </div>
  );
}

export default function FacturacionPage() {
  const ctx = useContext(SessionContext);
  const rid = ctx?.selectedRestaurantId || null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<BillingInfo | null>(null);

  // Form state
  const [companyName, setCompanyName] = useState("");
  const [rut, setRut] = useState("");
  const [giro, setGiro] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");

  const fetchInfo = useCallback(async () => {
    if (!rid) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/billing/billing-info?restaurantId=${rid}`);
      if (!res.ok) { setLoading(false); return; }
      const d: BillingInfo = await res.json();
      setInfo(d);
      setCompanyName(d.billingCompanyName || "");
      setRut(d.billingRut || "");
      setGiro(d.billingGiro || "");
      setAddress(d.billingAddress || "");
      setCity(d.billingCity || "");
      setEmail(d.billingEmail || "");
      setContactName(d.billingContactName || "");
      setPhone(d.billingPhone || "");
    } catch {}
    setLoading(false);
  }, [rid]);

  useEffect(() => { fetchInfo(); }, [fetchInfo]);

  const handleSave = async () => {
    if (!rid || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/billing/billing-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: rid,
          billingCompanyName: companyName,
          billingRut: rut,
          billingGiro: giro,
          billingAddress: address,
          billingCity: city,
          billingEmail: email,
          billingContactName: contactName,
          billingPhone: phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "No se pudo guardar");
        setSaving(false);
        return;
      }
      setInfo(data);
      if (data.billingRut) setRut(data.billingRut);
      toast.success(data.isComplete ? "Datos de facturación completos" : "Guardado");
    } catch {
      toast.error("Error de conexión");
    }
    setSaving(false);
  };

  if (loading) return <SkeletonLoading type="form" />;
  if (!rid) return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "var(--adm-text2)", fontFamily: F }}>Selecciona un restaurant</p></div>;

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontFamily: F, fontSize: "1.3rem", color: "var(--adm-text)", margin: "0 0 4px" }}>Datos de facturación</h1>
      <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 20px" }}>
        Estos datos los usamos para emitir tu factura electrónica cada mes
      </p>

      {/* Estado */}
      {info && !info.isComplete && (
        <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 12, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <FileText size={20} color="#92400e" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 700, color: "#92400e", margin: 0 }}>
              Faltan datos para emitir tu factura
            </p>
            <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "#78350f", margin: "4px 0 0", lineHeight: 1.5 }}>
              Necesitamos: {info.missingFields.map((f) => FIELD_LABELS[f] || f).join(", ")}. Sin estos datos no podremos emitir tu factura electrónica.
            </p>
          </div>
        </div>
      )}
      {info && info.isComplete && (
        <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 12, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <Receipt size={20} color="#15803d" style={{ flexShrink: 0 }} />
          <div>
            <p style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 700, color: "#15803d", margin: 0 }}>
              Datos completos
            </p>
            <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "#166534", margin: "2px 0 0" }}>
              Listo para emitir factura electrónica con IVA incluido.
            </p>
          </div>
        </div>
      )}

      {/* Empresa */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 16px" }}>
          Empresa
        </h3>
        <Field label="Razón social" required>
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} style={inputStyle} placeholder="Restaurantes SpA" />
        </Field>
        <Field label="RUT" required hint="Formato: 76.123.456-7">
          <input value={rut} onChange={(e) => setRut(e.target.value)} style={inputStyle} placeholder="76.123.456-7" />
        </Field>
        <Field label="Giro" required hint="Actividad económica registrada en el SII">
          <input value={giro} onChange={(e) => setGiro(e.target.value)} style={inputStyle} placeholder="Restaurante / Servicio de comida" />
        </Field>
      </div>

      {/* Dirección */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 16px" }}>
          Dirección comercial
        </h3>
        <Field label="Dirección" required>
          <input value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle} placeholder="Av. Providencia 1234, oficina 502" />
        </Field>
        <Field label="Comuna / Ciudad" required>
          <input value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} placeholder="Providencia, Santiago" />
        </Field>
      </div>

      {/* Contacto */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 16px" }}>
          Contacto de facturación
        </h3>
        <Field label="Email facturación" required hint="Ahí enviamos la factura cada mes">
          <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="contabilidad@tu-empresa.cl" type="email" />
        </Field>
        <Field label="Nombre responsable">
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} style={inputStyle} placeholder="Juan Pérez" />
        </Field>
        <Field label="Teléfono">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} placeholder="+56 2 1234 5678" type="tel" />
        </Field>
      </div>

      <button onClick={handleSave} disabled={saving} style={{
        width: "100%", padding: 12, background: GOLD, color: "white", border: "none", borderRadius: 8,
        fontFamily: F, fontSize: "0.9rem", fontWeight: 700, cursor: saving ? "wait" : "pointer",
      }}>
        {saving ? "Guardando..." : "Guardar datos de facturación"}
      </button>

      <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
        Tus datos solo se usan para emitir factura. No se comparten con terceros.
      </p>
    </div>
  );
}
