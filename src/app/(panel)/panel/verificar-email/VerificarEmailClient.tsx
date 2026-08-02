"use client";

import { useState } from "react";

interface Props {
  ownerId: string;
  email: string;
  maskedEmail: string;
  ownerName: string;
}

export default function VerificarEmailClient({ ownerId, email, maskedEmail, ownerName }: Props) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [changeStatus, setChangeStatus] = useState<"idle" | "sending" | "sent" | "error" | "invalid">("idle");
  const [currentMasked, setCurrentMasked] = useState(maskedEmail);
  const [errorMsg, setErrorMsg] = useState("");

  const firstName = ownerName.split(" ")[0];

  async function handleResend() {
    setStatus("sending");
    try {
      const res = await fetch("/api/panel/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId }),
      });
      if (res.ok) {
        setStatus("sent");
      } else {
        const data = await res.json();
        setErrorMsg(data.message || "Error al reenviar");
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed.includes("@") || !trimmed.includes(".")) {
      setChangeStatus("invalid");
      return;
    }
    setChangeStatus("sending");
    try {
      const res = await fetch("/api/panel/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId, newEmail: trimmed }),
      });
      const data = await res.json();
      if (res.ok) {
        // Update masked display
        const [local, domain] = trimmed.split("@");
        const masked = (local.length <= 2 ? local[0] + "***" : local[0] + "***" + local.slice(-1)) + "@" + domain;
        setCurrentMasked(masked);
        setChangeStatus("sent");
        setShowChangeEmail(false);
        setStatus("sent");
        setNewEmail("");
      } else {
        setErrorMsg(data.message || "Error al cambiar email");
        setChangeStatus("error");
      }
    } catch {
      setChangeStatus("error");
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#0f0d0a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "420px",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <span style={{ fontFamily: "Georgia, serif", fontSize: "18px", color: "#e8930a" }}>
            QuieroComer
          </span>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: "#1a1710",
          border: "1px solid #3a3020",
          borderRadius: "24px",
          padding: "32px 28px",
        }}>
          {/* Icon */}
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <div style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              backgroundColor: "#2a2010",
              border: "1px solid #e8930a33",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto",
              fontSize: "28px",
            }}>
              ✉️
            </div>
          </div>

          <h1 style={{
            fontFamily: "Georgia, serif",
            fontSize: "22px",
            color: "#f5f0e8",
            textAlign: "center",
            margin: "0 0 12px",
            lineHeight: 1.3,
          }}>
            {firstName ? `${firstName}, verifica` : "Verifica"} tu correo
          </h1>

          <p style={{
            fontSize: "14px",
            color: "#9a8a70",
            textAlign: "center",
            margin: "0 0 24px",
            lineHeight: 1.6,
          }}>
            Te enviamos un link de acceso a{" "}
            <strong style={{ color: "#c9b89a" }}>{currentMasked}</strong>.
            Haz clic en ese link para verificar tu cuenta y acceder al panel.
          </p>

          {/* Status messages */}
          {status === "sent" && (
            <div style={{
              backgroundColor: "#0d2010",
              border: "1px solid #1a4020",
              borderRadius: "12px",
              padding: "12px 16px",
              marginBottom: "16px",
              fontSize: "13px",
              color: "#4caf50",
              textAlign: "center",
            }}>
              ✓ Email reenviado — revisa tu bandeja de entrada
            </div>
          )}

          {status === "error" && (
            <div style={{
              backgroundColor: "#200d0d",
              border: "1px solid #401a1a",
              borderRadius: "12px",
              padding: "12px 16px",
              marginBottom: "16px",
              fontSize: "13px",
              color: "#f44336",
              textAlign: "center",
            }}>
              {errorMsg || "Error al reenviar. Intenta de nuevo."}
            </div>
          )}

          {/* Resend button */}
          <button
            onClick={handleResend}
            disabled={status === "sending" || status === "sent"}
            style={{
              width: "100%",
              backgroundColor: status === "sent" ? "#1a2a1a" : "#e8930a",
              color: status === "sent" ? "#4caf50" : "#ffffff",
              border: "none",
              borderRadius: "14px",
              padding: "16px",
              fontSize: "15px",
              fontWeight: 700,
              cursor: status === "sending" || status === "sent" ? "default" : "pointer",
              marginBottom: "16px",
              transition: "opacity 0.2s",
              opacity: status === "sending" ? 0.7 : 1,
            }}
          >
            {status === "sending" ? "Enviando..." : status === "sent" ? "✓ Email enviado" : "Reenviar email de verificación"}
          </button>

          {/* Change email link */}
          {!showChangeEmail ? (
            <button
              onClick={() => setShowChangeEmail(true)}
              style={{
                background: "none",
                border: "none",
                color: "#9a8a70",
                fontSize: "13px",
                cursor: "pointer",
                width: "100%",
                textAlign: "center",
                textDecoration: "underline",
                padding: "4px",
              }}
            >
              El correo está mal, quiero cambiarlo
            </button>
          ) : (
            <form onSubmit={handleChangeEmail} style={{ marginTop: "8px" }}>
              <p style={{ fontSize: "13px", color: "#9a8a70", marginBottom: "10px", textAlign: "center" }}>
                Ingresa el correo correcto:
              </p>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => { setNewEmail(e.target.value); setChangeStatus("idle"); }}
                placeholder="correo@ejemplo.com"
                autoFocus
                style={{
                  width: "100%",
                  backgroundColor: "#0f0d0a",
                  border: "1px solid #3a3020",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  color: "#f5f0e8",
                  fontSize: "14px",
                  marginBottom: "10px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {changeStatus === "invalid" && (
                <p style={{ fontSize: "12px", color: "#f44336", marginBottom: "8px" }}>
                  Ingresa un email válido
                </p>
              )}
              {changeStatus === "error" && (
                <p style={{ fontSize: "12px", color: "#f44336", marginBottom: "8px" }}>
                  {errorMsg || "Error al cambiar el correo"}
                </p>
              )}
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => { setShowChangeEmail(false); setChangeStatus("idle"); setNewEmail(""); }}
                  style={{
                    flex: 1,
                    backgroundColor: "#2a2010",
                    border: "1px solid #3a3020",
                    borderRadius: "10px",
                    padding: "12px",
                    color: "#9a8a70",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={changeStatus === "sending"}
                  style={{
                    flex: 2,
                    backgroundColor: "#e8930a",
                    border: "none",
                    borderRadius: "10px",
                    padding: "12px",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: changeStatus === "sending" ? "default" : "pointer",
                    opacity: changeStatus === "sending" ? 0.7 : 1,
                  }}
                >
                  {changeStatus === "sending" ? "Cambiando..." : "Cambiar y reenviar"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Help text */}
        <p style={{
          textAlign: "center",
          fontSize: "12px",
          color: "#5a4a35",
          marginTop: "20px",
        }}>
          ¿Problemas? Escríbenos por WhatsApp
        </p>
      </div>
    </div>
  );
}
