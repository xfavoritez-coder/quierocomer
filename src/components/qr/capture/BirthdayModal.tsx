"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { getGuestId, getSessionId } from "@/lib/guestId";
import EmailTypoHint from "./EmailTypoHint";

interface Props {
  restaurantId: string;
  restaurantName?: string;
  /** If user is already logged in, pass their data to update instead of register */
  existingUser?: { name: string | null; email: string } | null;
  bannerVariantId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function BirthdayModal({ restaurantId, restaurantName, existingUser, bannerVariantId, onClose, onSuccess }: Props) {
  const [name, setName] = useState(existingUser?.name || "");
  const [email, setEmail] = useState(existingUser?.email || "");
  const [birthDate, setBirthDate] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");

  const handleSubmit = async () => {
    if (status !== "idle") return;
    if (!existingUser && (!email || !name)) return;
    if (!birthDate) return;
    setStatus("loading");

    if (existingUser) {
      // Update existing user's birthday
      await fetch("/api/qr/user/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthDate }),
      });
    } else {
      // Register new user
      const savedDiet = localStorage.getItem("qr_diet") || null;
      const savedRestrictions = localStorage.getItem("qr_restrictions");
      const restrictions = savedRestrictions ? JSON.parse(savedRestrictions).filter((r: string) => r !== "ninguna") : [];

      const res = await fetch("/api/qr/user/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name || null,
          birthDate,
          dietType: savedDiet,
          restrictions,
          restaurantId,
          source: "birthday_banner",
          guestId: getGuestId(),
          sessionId: getSessionId(),
          bannerVariantId: bannerVariantId || null,
        }),
      });

      if (bannerVariantId) {
        await fetch("/api/qr/banner/convert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variantId: bannerVariantId }),
        });
      }

      const data = await res.json();
      if (data.userId) {
        document.cookie = `qr_user_id=${data.userId};path=/;max-age=${60 * 60 * 24 * 365}`;
      }
    }

    // Track birthday saved
    fetch("/api/qr/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "BIRTHDAY_SAVED", restaurantId, guestId: getGuestId(), sessionId: getSessionId() }),
    }).catch(() => {});

    setStatus("success");
    onSuccess?.();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center font-[family-name:var(--font-dm)]"
      style={{ zIndex: 200, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", minHeight: "100dvh" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 20,
          padding: "32px 24px 28px",
          maxWidth: 360,
          width: "90%",
          maxHeight: "90dvh",
          overflowY: "auto",
          boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer" }}
        >
          <X size={18} color="#ccc" />
        </button>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <span style={{ fontSize: "2.8rem", display: "block", marginBottom: 10 }}>🎂</span>
          <h3
            className="font-[family-name:var(--font-playfair)]"
            style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0e0e0e", lineHeight: 1.2 }}
          >
            {restaurantName ? `En ${restaurantName} queremos celebrar contigo` : "¡Queremos celebrar contigo!"}
          </h3>
          <p style={{ fontSize: "0.85rem", color: "#888", marginTop: 6, lineHeight: 1.5 }}>
            Déjanos tu cumpleaños y te tendremos una sorpresa especial
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {!existingUser && (
            <>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                style={{
                  background: "#f9f9f7", border: "1px solid #eee", borderRadius: 10,
                  padding: "12px 16px", color: "#0e0e0e", fontSize: "0.92rem",
                  outline: "none", fontFamily: "inherit",
                }}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                style={{
                  background: "#f9f9f7", border: "1px solid #eee", borderRadius: 10,
                  padding: "12px 16px", color: "#0e0e0e", fontSize: "0.92rem",
                  outline: "none", fontFamily: "inherit",
                }}
              />
              <EmailTypoHint email={email} onAccept={setEmail} />
            </>
          )}
          <div style={{ position: "relative", overflow: "hidden" }}>
            <label style={{ display: "block", fontSize: "0.78rem", color: "#888", marginBottom: 4, fontFamily: "inherit" }}>Fecha de cumpleaños</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              style={{
                width: "100%", background: "#f9f9f7", border: "1px solid #eee", borderRadius: 10,
                padding: "12px 16px", color: birthDate ? "#0e0e0e" : "transparent", fontSize: "0.92rem",
                outline: "none", colorScheme: "light", fontFamily: "inherit", boxSizing: "border-box",
              }}
            />
            {!birthDate && (
              <span style={{ position: "absolute", left: 16, top: 34, fontSize: "0.92rem", color: "#999", pointerEvents: "none" }}>
                Selecciona tu fecha
              </span>
            )}
          </div>
          <button
            onClick={handleSubmit}
            className="active:scale-[0.98] transition-transform"
            style={{
              width: "100%", marginTop: 4, background: "#F4A623", color: "white",
              borderRadius: 50, padding: "13px 20px", fontSize: "0.95rem", fontWeight: 700,
              border: "none", fontFamily: "inherit", cursor: "pointer",
              boxShadow: "0 4px 14px rgba(244,166,35,0.3)",
              opacity: status === "loading" ? 0.6 : 1,
            }}
          >
            {status === "loading" ? "Guardando..." : "Quiero mi regalo 🎁"}
          </button>
        </div>

        <p style={{ textAlign: "center", fontSize: "0.8rem", color: "#888", marginTop: 12 }}>
          🔒 Solo usaremos tu email para avisarte en tu cumpleaños
        </p>
      </div>
    </div>
  );
}
