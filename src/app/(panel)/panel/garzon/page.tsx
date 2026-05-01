"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import PlanPageGate from "@/components/admin/PlanPageGate";
import { Bell, Smartphone, CheckCircle, Copy, Check, Shield, ArrowLeft } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

export default function GarzonPage() {
  const { restaurants, selectedRestaurantId } = useAdminSession();
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const restaurant = restaurants.find(r => r.id === selectedRestaurantId);
  const garzonLink = restaurant ? `https://quierocomer.cl/qr/${restaurant.slug}/garzon` : "";

  useEffect(() => {
    if (!garzonLink) return;
    QRCode.toDataURL(garzonLink, { width: 400, margin: 1, errorCorrectionLevel: "H", color: { dark: "#0e0e0e", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [garzonLink]);

  const copyLink = () => {
    navigator.clipboard.writeText(garzonLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!restaurant) {
    return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "var(--adm-text2)", fontFamily: F }}>Selecciona un restaurante</p></div>;
  }

  return (
    <PlanPageGate feature="waiter">
    <div style={{ maxWidth: 640 }}>
      <Link href="/panel" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", color: "var(--adm-text2)", fontFamily: FB, fontSize: "0.78rem", marginBottom: 12 }}>
        <ArrowLeft size={16} /> Volver al inicio
      </Link>
      <h1 style={{ fontFamily: F, fontSize: "1.3rem", color: "var(--adm-text)", margin: "0 0 8px" }}>Panel del Garzón</h1>
      <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text2)", margin: "0 0 24px", lineHeight: 1.5 }}>
        Permite a tus clientes llamar al garzón desde su celular. Tu equipo recibe la notificación al instante.
      </p>

      {/* ── Cómo funciona ── */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "24px 20px", marginBottom: 20, boxShadow: "var(--adm-card-shadow, none)" }}>
        <h2 style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 20px" }}>¿Cómo funciona?</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {[
            { icon: Smartphone, num: "1", title: "El cliente escanea el QR", desc: "Desde la carta digital, presiona el botón \"Llamar garzón\" en su celular." },
            { icon: Bell, num: "2", title: "Tu garzón recibe la alerta", desc: "Le llega una notificación con sonido al instante. Ve el número de mesa y las preferencias del cliente." },
            { icon: CheckCircle, num: "3", title: "Atiende y confirma", desc: "El garzón toca \"Atender mesa\" y va a atender al cliente. Así de simple." },
          ].map(step => (
            <div key={step.num} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #FFF4E0, #FDEFC7)", border: "1px solid #E8D0A0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <step.icon size={18} color={GOLD} />
              </div>
              <div>
                <p style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 3px" }}>{step.title}</p>
                <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Configura el panel ── */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "24px 20px", marginBottom: 20, boxShadow: "var(--adm-card-shadow, none)" }}>
        <h2 style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Configura el panel del garzón</h2>

        {/* One-time note */}
        <div style={{ background: "linear-gradient(135deg, #FFF4E0, #FDEFC7)", border: "1px solid #E8D0A0", borderRadius: 10, padding: "10px 14px", marginBottom: 20 }}>
          <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "#8a7550", margin: 0, lineHeight: 1.5 }}>
            Esta configuración se hace <strong style={{ color: "#1a1a1a" }}>solo una vez</strong> por cada garzón. Una vez listo, el panel queda guardado en su celular y funciona automáticamente.
          </p>
        </div>

        {/* Link + QR */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 4px" }}>
            Comparte este link o QR con tu garzón
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", background: "var(--adm-input)", borderRadius: 10, padding: "10px 12px", border: "1px solid var(--adm-input-border)", marginBottom: 12 }}>
            <span style={{ fontFamily: FB, fontSize: "0.72rem", color: GOLD, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{garzonLink}</span>
            <button onClick={copyLink} style={{
              padding: "6px 12px", background: copied ? "rgba(34,197,94,0.15)" : `rgba(244,166,35,0.15)`,
              border: "none", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              fontFamily: FB, fontSize: "0.7rem", fontWeight: 600, color: copied ? "#22c55e" : GOLD, flexShrink: 0,
            }}>
              {copied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
            </button>
          </div>
          {qrDataUrl && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <img src={qrDataUrl} alt="QR panel garzón" style={{ width: 120, height: 120, borderRadius: 8 }} />
              <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "8px 0 0", textAlign: "center" }}>Escanea con el celular del garzón</p>
            </div>
          )}
        </div>

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Step 1 */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 700, color: "white" }}>1</span>
            </div>
            <div>
              <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 3px" }}>Abre el link en el celular</p>
              <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
                El garzón abre el link en el navegador de su celular. Verá el panel de <strong style={{ color: "#1a1a1a" }}>{restaurant.name}</strong>.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 700, color: "white" }}>2</span>
            </div>
            <div>
              <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 3px" }}>Guarda como app en el celular</p>
              <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 8px", lineHeight: 1.5 }}>
                Así las notificaciones funcionan de forma confiable, incluso con el celular bloqueado.
              </p>
              <div style={{ background: "var(--adm-hover)", borderRadius: 10, padding: "10px 14px" }}>
                <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text)", margin: "0 0 4px" }}>
                  <strong>iPhone:</strong> Safari → Compartir (↑) → "Agregar a inicio"
                </p>
                <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text)", margin: 0 }}>
                  <strong>Android:</strong> Chrome → menú (⋮) → "Agregar a inicio"
                </p>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 700, color: "white" }}>3</span>
            </div>
            <div>
              <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 3px" }}>Inicia sesión como <strong style={{ color: "#1a1a1a" }}>{restaurant.name}</strong></p>
              <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
                Al abrir la app por primera vez, el garzón debe tocar "Activar notificaciones" para conectarse al panel de <strong style={{ color: "#1a1a1a" }}>{restaurant.name}</strong>.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: F, fontSize: "0.75rem", fontWeight: 700, color: "white" }}>4</span>
            </div>
            <div>
              <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 3px" }}>Acepta los permisos de notificación</p>
              <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 8px", lineHeight: 1.5 }}>
                Cuando el navegador pregunte "¿Permitir notificaciones?", el garzón <strong style={{ color: "#1a1a1a" }}>debe tocar "Permitir"</strong>. Sin esto, no recibirá los llamados.
              </p>
              <div style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 8, padding: "8px 12px" }}>
                <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "#16a34a", margin: 0, lineHeight: 1.5 }}>
                  ¡Listo! El garzón ya puede recibir llamados de los clientes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Security note ── */}
      <div style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Shield size={18} color="#b45309" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 600, color: "#b45309", margin: "0 0 4px" }}>Link público</p>
          <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "#92400e", margin: 0, lineHeight: 1.5 }}>
            Este link no requiere contraseña. Solo compártelo con las personas de tu equipo que necesiten recibir los llamados.
          </p>
        </div>
      </div>
    </div>
    </PlanPageGate>
  );
}
