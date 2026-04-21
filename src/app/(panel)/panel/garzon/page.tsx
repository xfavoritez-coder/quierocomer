"use client";
import { useState } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { Bell, Smartphone, CheckCircle, Copy, Check, Shield } from "lucide-react";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

export default function GarzonPage() {
  const { restaurants, selectedRestaurantId } = useAdminSession();
  const [copied, setCopied] = useState(false);

  const restaurant = restaurants.find(r => r.id === selectedRestaurantId);
  const garzonLink = restaurant ? `https://quierocomer.cl/qr/admin/garzon/${restaurant.slug}` : "";

  const copyLink = () => {
    navigator.clipboard.writeText(garzonLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!restaurant) {
    return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "var(--adm-text2)", fontFamily: F }}>Selecciona un restaurante</p></div>;
  }

  return (
    <div style={{ maxWidth: 640 }}>
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
        <h2 style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 16px" }}>Configura el panel del garzón</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Step 1: Share link */}
          <div>
            <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 4px" }}>
              1. Comparte este link con tu garzón
            </p>
            <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 8px", lineHeight: 1.5 }}>
              Envíalo por WhatsApp, email, o haz que escanee el código QR de más abajo.
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", background: "var(--adm-input)", borderRadius: 10, padding: "10px 12px", border: "1px solid var(--adm-input-border)" }}>
              <span style={{ fontFamily: FB, fontSize: "0.72rem", color: GOLD, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{garzonLink}</span>
              <button onClick={copyLink} style={{
                padding: "6px 12px", background: copied ? "rgba(34,197,94,0.15)" : `rgba(244,166,35,0.15)`,
                border: "none", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                fontFamily: FB, fontSize: "0.7rem", fontWeight: 600, color: copied ? "#22c55e" : GOLD, flexShrink: 0,
              }}>
                {copied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
              </button>
            </div>
          </div>

          {/* Step 2 */}
          <div>
            <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 4px" }}>
              2. El garzón abre el link en su celular
            </p>
            <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
              Al abrirlo verá el panel de llamadas. Si no hay llamadas activas, verá un mensaje de espera.
            </p>
          </div>

          {/* Step 3 */}
          <div>
            <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 4px" }}>
              3. Activa las notificaciones
            </p>
            <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
              Cuando el navegador pregunte "¿Permitir notificaciones?", el garzón <strong>debe tocar "Permitir"</strong>. Esto es obligatorio para que reciba las alertas con sonido, incluso con el celular bloqueado.
            </p>
            <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, padding: "8px 12px", marginTop: 8 }}>
              <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "#b91c1c", margin: 0, lineHeight: 1.5 }}>
                Sin notificaciones activadas, el garzón no recibirá los llamados de los clientes.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div>
            <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 4px" }}>
              4. Guardar como app en el celular
            </p>
            <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
              Para que las notificaciones funcionen de forma confiable, el garzón debe guardar el panel como app:
            </p>
            <div style={{ background: "var(--adm-hover)", borderRadius: 10, padding: "12px 14px", marginTop: 8 }}>
              <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text)", margin: "0 0 6px" }}>
                <strong>iPhone:</strong> Safari → Compartir (↑) → "Agregar a pantalla de inicio"
              </p>
              <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text)", margin: 0 }}>
                <strong>Android:</strong> Chrome → menú (⋮) → "Agregar a pantalla de inicio"
              </p>
            </div>
            <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", marginTop: 6 }}>
              Esto abre el panel sin barra de navegador y mantiene las notificaciones activas en segundo plano.
            </p>
          </div>
        </div>
      </div>

      {/* ── Security note ── */}
      <div style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Shield size={18} color="#b45309" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 600, color: "#b45309", margin: "0 0 4px" }}>Link público</p>
          <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "#92400e", margin: 0, lineHeight: 1.5 }}>
            Este link no requiere contraseña. Solo compártelo con las personas de tu equipo que necesiten recibir los llamados. No lo publiques en redes sociales.
          </p>
        </div>
      </div>
    </div>
  );
}
