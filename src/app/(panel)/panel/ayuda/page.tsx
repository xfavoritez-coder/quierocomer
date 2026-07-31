"use client";
import { useState } from "react";
import { HelpCircle, CheckCircle, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { usePanelLang } from "@/lib/i18n/panel";

const GOLD = "#F4A623";

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
    <div style={{ padding: "24px 16px", maxWidth: 720, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <h1 style={{
        fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 700,
        color: "var(--adm-text)", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 8,
      }}>
        <HelpCircle size={20} color="var(--adm-text3)" /> {t("help_title")}
      </h1>
      <p style={{ fontSize: "0.92rem", color: "var(--adm-text2)", margin: "0 0 24px" }}>
        {t("help_subtitle")}
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
              {t("help_sent_title")}
            </p>
            <p style={{ fontSize: "0.82rem", color: "var(--adm-text3)", margin: 0 }}>
              {t("help_sent_desc")}
            </p>
          </div>
        ) : (
          <>
            <h2 style={{
              fontFamily: "var(--font-display)", fontSize: "0.82rem", fontWeight: 800,
              color: "var(--adm-text3)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8,
              textTransform: "uppercase", letterSpacing: ".6px",
            }}>
              <MessageCircle size={14} /> {t("help_write_us")}
            </h2>
            <p style={{ fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 14px" }}>
              {t("help_write_desc")}
            </p>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={t("help_placeholder")}
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
              {sending ? t("help_sending") : t("help_send")}
            </button>
          </>
        )}
      </div>

    </div>
  );
}
