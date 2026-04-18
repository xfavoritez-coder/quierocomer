"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface Props {
  restaurantId: string;
}

export default function BirthdayBanner({ restaurantId }: Props) {
  const [variant, setVariant] = useState<{ id: string; text: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [isRegistered, setIsRegistered] = useState(true);

  useEffect(() => {
    if (sessionStorage.getItem("qr_birthday_dismissed")) return;

    fetch("/api/qr/user/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) { setIsRegistered(true); return; }
        setIsRegistered(false);
        fetch("/api/qr/banner/select")
          .then((r) => r.json())
          .then((d) => { if (d.variant) setVariant(d.variant); });
      })
      .catch(() => setIsRegistered(false));
  }, []);

  if (isRegistered || dismissed || !variant) return null;

  // After success, show thank-you inline
  if (status === "success") {
    return (
      <div
        className="font-[family-name:var(--font-dm)]"
        style={{
          margin: "8px 20px 20px",
          padding: "14px 18px",
          background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
          border: "1px solid rgba(22,163,74,0.15)",
          borderRadius: 14,
          textAlign: "center",
        }}
      >
        <span style={{ color: "#16a34a", fontSize: "0.88rem", fontWeight: 600 }}>
          ¡Listo! Guardamos tu cumpleaños y tus preferencias 🎂
        </span>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!email || status !== "idle") return;
    setStatus("loading");

    // Grab Genio preferences from localStorage
    const savedDiet = localStorage.getItem("qr_diet") || null;
    const savedRestrictions = localStorage.getItem("qr_restrictions");
    const restrictions = savedRestrictions ? JSON.parse(savedRestrictions).filter((r: string) => r !== "ninguna") : [];

    const res = await fetch("/api/qr/user/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        name: name || null,
        birthDate: birthDate || null,
        dietType: savedDiet,
        restrictions,
        restaurantId,
        source: "birthday_banner",
        bannerVariantId: variant.id,
      }),
    });

    await fetch("/api/qr/banner/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId: variant.id }),
    });

    // Set cookie so user is "logged in"
    const data = await res.json();
    if (data.userId) {
      document.cookie = `qr_user_id=${data.userId};path=/;max-age=${60 * 60 * 24 * 365}`;
    }

    setStatus("success");
    setModalOpen(false);
  };

  return (
    <>
      <style>{`
        @keyframes bdaySlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bdayShimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes bdayBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes bdayPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(244,166,35,0.3); }
          50% { box-shadow: 0 0 0 6px rgba(244,166,35,0); }
        }
      `}</style>
      {/* ── Inline banner (compact & beautiful) ── */}
      <div
        className="font-[family-name:var(--font-dm)]"
        style={{
          margin: "24px 12px 32px",
          padding: "20px 16px",
          background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fffbeb 100%)",
          backgroundSize: "200% 100%",
          animation: "bdaySlideIn 0.5s ease-out, bdayShimmer 8s ease-in-out 1s infinite",
          border: "1px solid rgba(244,166,35,0.18)",
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          gap: 10,
          position: "relative",
        }}
      >
        {/* Emoji */}
        <span style={{ fontSize: "1.8rem", flexShrink: 0, animation: "bdayBounce 2s ease-in-out infinite" }}>🎂</span>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "0.97rem", fontWeight: 700, color: "#92400e", lineHeight: 1.3, margin: 0 }}>
            ¿Cuándo es tu cumple?
          </p>
          <p style={{ fontSize: "0.94rem", color: "#b45309", lineHeight: 1.4, margin: "3px 0 0", opacity: 0.85 }}>
            Regístrate y recibe una sorpresa
          </p>
        </div>

        {/* CTA button */}
        <button
          onClick={() => setModalOpen(true)}
          className="active:scale-95 transition-transform"
          style={{
            flexShrink: 0,
            background: "#F4A623",
            color: "white",
            border: "none",
            borderRadius: 50,
            padding: "9px 18px",
            fontSize: "0.88rem",
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
            marginRight: 20,
            animation: "bdayPulse 2.5s ease-in-out infinite",
          }}
        >
          Me apunto
        </button>

        {/* Dismiss */}
        <button
          onClick={() => { setDismissed(true); sessionStorage.setItem("qr_birthday_dismissed", "true"); }}
          style={{ position: "absolute", top: 6, right: 6, background: "none", border: "none", padding: 2, cursor: "pointer" }}
        >
          <X size={13} color="#d4a053" />
        </button>
      </div>

      {/* ── Modal ── */}
      {modalOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center font-[family-name:var(--font-dm)]"
          style={{ zIndex: 90, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
          onClick={() => setModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 20,
              padding: "32px 24px 28px",
              maxWidth: 360,
              width: "90%",
              boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
              position: "relative",
            }}
          >
            {/* Close */}
            <button
              onClick={() => setModalOpen(false)}
              style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={18} color="#ccc" />
            </button>

            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <span style={{ fontSize: "2.8rem", display: "block", marginBottom: 10 }}>🎂</span>
              <h3
                className="font-[family-name:var(--font-playfair)]"
                style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0e0e0e", lineHeight: 1.2 }}
              >
                ¡Queremos celebrar contigo!
              </h3>
              <p style={{ fontSize: "0.85rem", color: "#888", marginTop: 6, lineHeight: 1.5 }}>
                Déjanos tu cumpleaños y te tendremos una sorpresa especial
              </p>
            </div>

            {/* Form */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                style={{
                  background: "#f9f9f7",
                  border: "1px solid #eee",
                  borderRadius: 10,
                  padding: "12px 16px",
                  color: "#0e0e0e",
                  fontSize: "0.92rem",
                  outline: "none",
                  fontFamily: "inherit",
                  transition: "border 0.2s",
                }}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                style={{
                  background: "#f9f9f7",
                  border: "1px solid #eee",
                  borderRadius: 10,
                  padding: "12px 16px",
                  color: "#0e0e0e",
                  fontSize: "0.92rem",
                  outline: "none",
                  fontFamily: "inherit",
                  transition: "border 0.2s",
                }}
              />
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                placeholder="Tu cumpleaños"
                style={{
                  background: "#f9f9f7",
                  border: "1px solid #eee",
                  borderRadius: 10,
                  padding: "12px 16px",
                  color: birthDate ? "#0e0e0e" : "#999",
                  fontSize: "0.92rem",
                  outline: "none",
                  colorScheme: "light",
                  fontFamily: "inherit",
                  transition: "border 0.2s",
                }}
              />
              <button
                onClick={handleSubmit}
                className="active:scale-[0.98] transition-transform"
                style={{
                  width: "100%",
                  marginTop: 4,
                  background: "#F4A623",
                  color: "white",
                  borderRadius: 50,
                  padding: "13px 20px",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  border: "none",
                  fontFamily: "inherit",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(244,166,35,0.3)",
                  opacity: status === "loading" ? 0.6 : 1,
                }}
              >
                {status === "loading" ? "Registrando..." : "Quiero mi regalo 🎁"}
              </button>
            </div>

            <p style={{ textAlign: "center", fontSize: "0.8rem", color: "#888", marginTop: 12 }}>
              🔒 Solo usaremos tu email para avisarte en tu cumpleaños
            </p>
          </div>
        </div>
      )}
    </>
  );
}
