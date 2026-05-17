"use client";
import { useState } from "react";
import { HelpCircle, Mail, ChevronDown, CheckCircle, MessageCircle } from "lucide-react";
import { toast } from "sonner";

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
    <div style={{ padding: "24px 16px", maxWidth: 720, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <h1 style={{
        fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 700,
        color: "var(--adm-text)", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 8,
      }}>
        <HelpCircle size={20} color="var(--adm-text3)" /> Ayuda y soporte
      </h1>
      <p style={{ fontSize: "0.92rem", color: "var(--adm-text2)", margin: "0 0 24px" }}>
        Escríbenos o revisa las preguntas frecuentes
      </p>

      {/* Formulario de contacto */}
      <div style={{
        background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
        borderRadius: 22, padding: "24px 20px", marginBottom: 16,
      }}>
        {sent ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "rgba(74,222,128,.1)", display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 12px",
            }}>
              <CheckCircle size={24} color="#4ade80" />
            </div>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "0.95rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px" }}>
              Mensaje enviado
            </p>
            <p style={{ fontSize: "0.82rem", color: "var(--adm-text3)", margin: 0 }}>
              Te responderemos pronto a tu email.
            </p>
          </div>
        ) : (
          <>
            <h2 style={{
              fontFamily: "var(--font-display)", fontSize: "0.82rem", fontWeight: 800,
              color: "var(--adm-text3)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8,
              textTransform: "uppercase", letterSpacing: ".6px",
            }}>
              <MessageCircle size={14} /> Escríbenos
            </h2>
            <p style={{ fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 14px" }}>
              Cuéntanos qué necesitas y te respondemos por email en menos de 24h.
            </p>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="¿Qué necesitas? Describe tu duda o problema..."
              rows={4}
              style={{
                width: "100%", padding: "14px 16px", boxSizing: "border-box",
                background: "rgba(255,255,255,.04)", border: "1px solid var(--adm-card-border)",
                borderRadius: 14, color: "var(--adm-text)", fontFamily: "var(--font-body)", fontSize: "0.88rem",
                outline: "none", resize: "vertical", minHeight: 100,
              }}
            />
            <button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              style={{
                marginTop: 14, padding: "12px 24px",
                background: message.trim() ? `linear-gradient(135deg, #ffc44f, ${GOLD})` : "rgba(255,255,255,.06)",
                color: message.trim() ? "#100b03" : "var(--adm-text3)",
                border: "none", borderRadius: 999,
                fontFamily: "var(--font-display)", fontSize: "0.85rem", fontWeight: 700,
                cursor: message.trim() ? "pointer" : "default", opacity: sending ? 0.6 : 1,
              }}
            >
              {sending ? "Enviando..." : "Enviar mensaje"}
            </button>
          </>
        )}
      </div>

      {/* Preguntas frecuentes */}
      <div style={{
        background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
        borderRadius: 22, padding: "24px 20px",
      }}>
        <h2 style={{
          fontFamily: "var(--font-display)", fontSize: "0.82rem", fontWeight: 800,
          color: "var(--adm-text3)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8,
          textTransform: "uppercase", letterSpacing: ".6px",
        }}>
          <HelpCircle size={14} /> Preguntas frecuentes
        </h2>
        <p style={{ fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 16px" }}>
          Las dudas más comunes sobre tu carta y el panel.
        </p>
        <div style={{ display: "flex", flexDirection: "column" }}>
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
                <span style={{ fontFamily: "var(--font-body)", fontSize: "0.88rem", color: "var(--adm-text)", fontWeight: 500 }}>
                  {item.q}
                </span>
                <ChevronDown
                  size={16} color="var(--adm-text3)"
                  style={{ flexShrink: 0, transform: openFaq === i ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}
                />
              </button>
              {openFaq === i && (
                <p style={{ fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 14px", lineHeight: 1.6, paddingRight: 20 }}>
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
