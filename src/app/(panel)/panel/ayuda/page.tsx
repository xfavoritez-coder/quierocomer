"use client";
import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { usePanelLang } from "@/lib/i18n/panel";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";
const WA = "#25D366";

const WA_HREF = "https://wa.me/56999946208?text=Hola%2C%20tengo%20una%20duda%20sobre%20QuieroComer%20%F0%9F%91%8B";

function WhatsAppIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function AyudaPage() {
  const { t } = usePanelLang();
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
      toast.error(t("help_error_send"));
    }
    setSending(false);
  };

  return (
    <div style={{ maxWidth: 560, fontFamily: FB }}>

      {/* Header */}
      <h1 style={{
        fontFamily: F, fontSize: "1.2rem", fontWeight: 900,
        color: "var(--adm-text)", margin: "0 0 4px", letterSpacing: "-0.03em",
      }}>
        ¿En qué te podemos ayudar?
      </h1>
      <p style={{ fontSize: "0.88rem", color: "var(--adm-text2)", margin: "0 0 24px", lineHeight: 1.5 }}>
        Escríbenos por WhatsApp o déjanos tu consulta y te respondemos pronto.
      </p>

      {/* WhatsApp CTA */}
      <a
        href={WA_HREF}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: "block", textDecoration: "none", marginBottom: 12 }}
      >
        <div style={{
          background: "linear-gradient(135deg, #1fbe5e 0%, #17a34a 100%)",
          borderRadius: 20, padding: "20px 22px",
          display: "flex", alignItems: "center", gap: 16,
          boxShadow: "0 4px 20px rgba(37,211,102,0.25)",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 28px rgba(37,211,102,0.35)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(37,211,102,0.25)"; }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            background: "rgba(255,255,255,0.2)", display: "grid", placeItems: "center",
            color: "#fff",
          }}>
            <WhatsAppIcon size={24} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 800, color: "#fff", margin: "0 0 2px" }}>
              Escribir por WhatsApp
            </p>
            <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "rgba(255,255,255,0.8)", margin: 0 }}>
              Respuesta rápida · +56 9 9994 6208
            </p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
      </a>

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
        <div style={{ flex: 1, height: 1, background: "var(--adm-card-border)" }} />
        <span style={{ fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
          o escríbenos aquí
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--adm-card-border)" }} />
      </div>

      {/* Form card */}
      <div style={{
        background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
        borderRadius: 20, padding: "22px 20px",
      }}>
        {sent ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "rgba(74,222,128,.12)", display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 12px",
            }}>
              <CheckCircle size={24} color="#4ade80" />
            </div>
            <p style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px" }}>
              {t("help_sent_title")}
            </p>
            <p style={{ fontSize: "0.82rem", color: "var(--adm-text3)", margin: "0 0 16px" }}>
              {t("help_sent_desc")}
            </p>
            <button
              onClick={() => setSent(false)}
              style={{
                padding: "8px 20px", background: "transparent",
                border: "1px solid var(--adm-card-border)", borderRadius: 999,
                fontFamily: F, fontSize: "0.78rem", fontWeight: 600,
                color: "var(--adm-text2)", cursor: "pointer",
              }}
            >
              Enviar otra consulta
            </button>
          </div>
        ) : (
          <>
            <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text2)", margin: "0 0 12px" }}>
              Envíanos tu consulta por escrito
            </p>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={t("help_placeholder")}
              rows={4}
              style={{
                width: "100%", padding: "12px 14px", boxSizing: "border-box",
                background: "var(--adm-input, rgba(255,255,255,.04))",
                border: "1px solid var(--adm-input-border, var(--adm-card-border))",
                borderRadius: 12, color: "var(--adm-text)", fontFamily: FB, fontSize: "0.88rem",
                outline: "none", resize: "vertical", minHeight: 96, lineHeight: 1.55,
              }}
            />
            <button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              style={{
                marginTop: 12, padding: "11px 24px",
                background: message.trim() ? `linear-gradient(135deg, #ffc44f, ${GOLD})` : "var(--adm-hover)",
                color: message.trim() ? "#100b03" : "var(--adm-text3)",
                border: "none", borderRadius: 999,
                fontFamily: F, fontSize: "0.85rem", fontWeight: 700,
                cursor: message.trim() && !sending ? "pointer" : "default",
                opacity: sending ? 0.6 : 1, transition: "background 0.15s",
              }}
            >
              {sending ? t("help_sending") : t("help_send")}
            </button>
          </>
        )}
      </div>

    </div>
  );
}
