"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { getGuestId, getSessionId } from "@/lib/guestId";
import { getDbSessionId } from "@/lib/sessionTracker";

interface Props {
  restaurantId: string;
  type: "post_genio" | "repeat_dish" | "promo_unlock";
  dishName?: string;
  onRegister: () => void;
}

const CTA_DISMISS_KEY = "quierocomer_cta_dismissed";
const CTA_COOLDOWN = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_PER_SESSION = 1;

const COPY: Record<string, { title: string; subtitle: string; cta: string }> = {
  post_genio: {
    title: "¿Te gustó la recomendación?",
    subtitle: "Guarda tus gustos para la próxima vez",
    cta: "Guardar con mi email",
  },
  repeat_dish: {
    title: "Te interesa este plato",
    subtitle: "Te avisamos cuando esté en promoción",
    cta: "Avisarme",
  },
  promo_unlock: {
    title: "Tenemos una oferta para ti",
    subtitle: "Regístrate para desbloquearla",
    cta: "Desbloquear oferta",
  },
};

export default function ConversionCTA({ restaurantId, type, dishName, onRegister }: Props) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");

  useEffect(() => {
    // Check cooldown
    const lastDismissed = localStorage.getItem(`${CTA_DISMISS_KEY}_${type}`);
    if (lastDismissed && Date.now() - parseInt(lastDismissed) < CTA_COOLDOWN) return;

    // Check session limit
    const sessionCount = parseInt(sessionStorage.getItem("quierocomer_cta_count") || "0");
    if (sessionCount >= MAX_PER_SESSION) return;

    // Check if already registered
    const userId = document.cookie.match(/qr_user_id=([^;]*)/)?.[1];
    if (userId) return;

    // Show with delay
    setTimeout(() => setVisible(true), 1000);

    // Track CTA shown
    fetch("/api/qr/stats", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "QR_SCAN", restaurantId, guestId: getGuestId(), sessionId: getGuestId(), dbSessionId: getDbSessionId() }),
    }).catch(() => {});

    sessionStorage.setItem("quierocomer_cta_count", String(sessionCount + 1));
  }, [restaurantId, type]);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => setDismissed(true), 300);
    localStorage.setItem(`${CTA_DISMISS_KEY}_${type}`, String(Date.now()));
  }, [type]);

  const handleSubmit = async () => {
    if (!email || !name || status !== "idle") return;
    setStatus("loading");

    const res = await fetch("/api/qr/user/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email, name, restaurantId,
        source: `cta_${type}`,
        guestId: getGuestId(),
        sessionId: getSessionId(),
        dietType: localStorage.getItem("qr_diet"),
        restrictions: localStorage.getItem("qr_restrictions") ? JSON.parse(localStorage.getItem("qr_restrictions")!) : [],
      }),
    });

    const data = await res.json();
    if (data.userId) {
      document.cookie = `qr_user_id=${data.userId};path=/;max-age=${60 * 60 * 24 * 365}`;
      setStatus("success");
      setTimeout(() => { dismiss(); onRegister(); }, 1500);
    } else {
      setStatus("idle");
    }
  };

  if (dismissed || !visible) return null;

  const copy = COPY[type];

  if (status === "success") {
    return (
      <div className="fixed font-[family-name:var(--font-dm)]" style={{ bottom: 100, left: 12, right: 12, zIndex: 75, background: "rgba(22,163,74,0.95)", backdropFilter: "blur(20px)", borderRadius: 16, padding: "16px 20px", textAlign: "center", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
        <p style={{ color: "white", fontSize: "0.92rem", fontWeight: 600, margin: 0 }}>✅ ¡Registrado! Revisa tu correo</p>
      </div>
    );
  }

  return (
    <div
      className="fixed font-[family-name:var(--font-dm)]"
      style={{
        bottom: 100, left: 12, right: 12, zIndex: 75,
        opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: "all 0.3s ease-out",
      }}
    >
      <div style={{
        background: "rgba(14,14,14,0.95)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(244,166,35,0.2)", borderRadius: 16,
        padding: "18px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        position: "relative",
      }}>
        <button onClick={dismiss} style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", padding: 4, cursor: "pointer" }}>
          <X size={14} color="rgba(255,255,255,0.3)" />
        </button>

        <p style={{ fontSize: "0.92rem", fontWeight: 700, color: "white", margin: "0 0 2px" }}>{copy.title}</p>
        <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.5)", margin: "0 0 12px" }}>
          {type === "repeat_dish" && dishName ? `${dishName} — ${copy.subtitle}` : copy.subtitle}
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input placeholder="Tu nombre" value={name} onChange={e => setName(e.target.value)} style={{ flex: 1, padding: "9px 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "white", fontSize: "0.82rem", outline: "none", fontFamily: "inherit" }} />
          <input placeholder="tu@email.com" type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ flex: 1, padding: "9px 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "white", fontSize: "0.82rem", outline: "none", fontFamily: "inherit" }} />
        </div>

        <button onClick={handleSubmit} disabled={!email || !name || status === "loading"} style={{
          width: "100%", padding: "10px", background: "#F4A623", color: "#0a0a0a", border: "none", borderRadius: 50,
          fontSize: "0.85rem", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", opacity: status === "loading" ? 0.6 : 1,
        }}>
          {status === "loading" ? "Registrando..." : copy.cta}
        </button>
      </div>
    </div>
  );
}
