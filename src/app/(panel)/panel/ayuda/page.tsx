"use client";
import { useState } from "react";
import { HelpCircle, Mail, ChevronDown, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

const FAQ = [
  { q: "¿Cómo cambio las fotos de mis platos?", a: "Ve a Mi Carta > Productos, haz click en un plato y sube una nueva foto desde el editor." },
  { q: "¿Cómo activo el garzón?", a: "Ve a Ajustes y activa la campanita. Luego comparte el link del panel garzón con tu equipo." },
  { q: "¿Puedo tener más de un local?", a: "Sí, cada local tiene su propia carta y panel. Contacta soporte para agregar otro local a tu cuenta." },
  { q: "¿Cómo cancelo mi suscripción?", a: "Ve a Mi Suscripción y presiona Cancelar. Mantienes acceso hasta el final del periodo pagado." },
  { q: "¿Cómo traduzco mi carta a otros idiomas?", a: "La carta se traduce automáticamente al inglés y portugués. Puedes editar las traducciones desde Mi Carta > Productos > icono de idioma." },
  { q: "¿Mis clientes necesitan descargar una app?", a: "No. Los clientes solo escanean el QR y ven la carta en su navegador. Sin descargas." },
];

export default function AyudaPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await fetch("/api/panel/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      setSent(true);
      setMessage("");
    } catch {
      toast.error("Error al enviar. Intenta de nuevo.");
    }
    setSending(false);
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
        <HelpCircle size={20} color={GOLD} /> Ayuda y soporte
      </h1>
      <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 24px" }}>
        ¿Necesitas ayuda? Escríbenos o revisa las preguntas frecuentes.
      </p>


      {/* Formulario de contacto */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "20px", marginBottom: 20 }}>
        {sent ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <CheckCircle size={24} color="#22c55e" />
            </div>
            <p style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 4px" }}>Mensaje enviado</p>
            <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", margin: 0 }}>Te responderemos pronto a tu email.</p>
          </div>
        ) : (
          <>
            <h2 style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 7 }}>
              <Mail size={16} color="var(--adm-text3)" /> Enviar mensaje a soporte
            </h2>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Describe tu problema o pregunta..."
              rows={4}
              style={{
                width: "100%", padding: "12px 14px", boxSizing: "border-box",
                background: "var(--adm-input)", border: "1px solid var(--adm-input-border)",
                borderRadius: 10, color: "var(--adm-text)", fontFamily: FB, fontSize: "0.85rem",
                outline: "none", resize: "vertical", minHeight: 100,
              }}
            />
            <button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              style={{
                marginTop: 12, padding: "10px 24px", background: message.trim() ? GOLD : "var(--adm-input)",
                color: message.trim() ? "white" : "var(--adm-text3)",
                border: "none", borderRadius: 10, fontFamily: F, fontSize: "0.82rem", fontWeight: 700,
                cursor: message.trim() ? "pointer" : "default", opacity: sending ? 0.6 : 1,
              }}
            >
              {sending ? "Enviando..." : "Enviar mensaje"}
            </button>
          </>
        )}
      </div>

      {/* Preguntas frecuentes */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "20px" }}>
        <h2 style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 7 }}>
          <CheckCircle size={16} color="var(--adm-text3)" /> Preguntas frecuentes
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {FAQ.map((item, i) => (
            <div key={i} style={{ borderBottom: i < FAQ.length - 1 ? "1px solid var(--adm-card-border)" : "none" }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: "100%", padding: "14px 0", background: "none", border: "none",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                  textAlign: "left", gap: 10,
                }}
              >
                <span style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", fontWeight: 500 }}>{item.q}</span>
                <ChevronDown size={16} color="var(--adm-text3)" style={{ flexShrink: 0, transform: openFaq === i ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
              </button>
              {openFaq === i && (
                <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 14px", lineHeight: 1.6, paddingRight: 20 }}>
                  {item.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
