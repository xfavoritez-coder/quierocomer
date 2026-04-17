"use client";

import { useState, useEffect } from "react";

interface Props {
  restaurantId: string;
}

export default function PostGenioCapture({ restaurantId }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [isRegistered, setIsRegistered] = useState(true); // Default true to hide until checked

  useEffect(() => {
    fetch("/api/qr/user/me")
      .then((r) => r.json())
      .then((d) => setIsRegistered(!!d.user))
      .catch(() => setIsRegistered(false));
  }, []);

  if (isRegistered) return null;

  const handleSubmit = async () => {
    if (!email || status !== "idle") return;
    setStatus("loading");

    const dietType = localStorage.getItem("qr_diet");
    const restrictions = localStorage.getItem("qr_restrictions");

    await fetch("/api/qr/user/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        dietType,
        restrictions: restrictions ? JSON.parse(restrictions) : [],
        restaurantId,
        source: "post_genio",
      }),
    });

    setStatus("success");
  };

  return (
    <div className="font-[family-name:var(--font-dm)]" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 20, marginTop: 16, textAlign: "center" }}>
      {status === "success" ? (
        <p style={{ color: "#4ade80", fontSize: "0.9rem", fontWeight: 600 }}>✓ Revisa tu correo</p>
      ) : (
        <>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.78rem", marginBottom: 10 }}>
            ¿Quieres que recuerde tus gustos?
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              padding: "12px 16px",
              color: "white",
              fontSize: "0.92rem",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={handleSubmit}
            style={{
              width: "100%",
              marginTop: 8,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "white",
              borderRadius: 50,
              padding: "11px 20px",
              fontSize: "0.85rem",
              fontFamily: "inherit",
              opacity: status === "loading" ? 0.5 : 1,
            }}
          >
            {status === "loading" ? "Guardando..." : "Guardar mis gustos →"}
          </button>
          <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.2)", marginTop: 8 }}>
            Gratis · Sin contraseña · Funciona en todos los restaurantes
          </p>
        </>
      )}
    </div>
  );
}
