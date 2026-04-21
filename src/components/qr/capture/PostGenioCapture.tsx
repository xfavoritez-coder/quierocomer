"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { getGuestId, getSessionId } from "@/lib/guestId";
import GenioTip, { TIP_BG, TIP_TEXT_COLOR } from "../genio/GenioTip";

interface Props {
  restaurantId: string;
}

export default function PostGenioCapture({ restaurantId }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [isRegistered, setIsRegistered] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetch("/api/qr/user/me")
      .then((r) => r.json())
      .then((d) => setIsRegistered(!!d.user))
      .catch(() => setIsRegistered(false));
  }, []);

  if (isRegistered) return null;

  const handleSubmit = async () => {
    if (!email || !name || status !== "idle") return;
    setStatus("loading");

    const dietType = localStorage.getItem("qr_diet");
    const restrictions = localStorage.getItem("qr_restrictions");
    const dislikesRaw = localStorage.getItem("qr_dislikes");

    const res = await fetch("/api/qr/user/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        name: name || null,
        dietType,
        restrictions: restrictions ? JSON.parse(restrictions) : [],
        dislikes: dislikesRaw ? JSON.parse(dislikesRaw) : [],
        restaurantId,
        source: "post_genio",
        guestId: getGuestId(),
        sessionId: getSessionId(),
      }),
    });

    const data = await res.json();
    if (data.userId) {
      document.cookie = `qr_user_id=${data.userId};path=/;max-age=${60 * 60 * 24 * 365}`;
    }

    setStatus("success");
  };

  const inputStyle = {
    background: "#f5f0ea", border: "1px solid #e8e0d6", borderRadius: 10,
    padding: "12px 16px", color: "#0e0e0e", fontSize: "0.92rem",
    outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" as const,
  };

  return (
    <>
      {/* Trigger — uses GenioTip style */}
      <GenioTip
        arrow={null as any}
        onClose={undefined}
        badgeLabel="Tip del Genio"
        style={{ width: 280, cursor: "pointer" }}
      >
        <button
          onClick={() => setModalOpen(true)}
          className="active:scale-95 transition-transform"
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "inherit", padding: 0, color: TIP_TEXT_COLOR,
            fontSize: "14px", lineHeight: 1.5, fontWeight: 400, textAlign: "left",
          }}
        >
          Guarda tus gustos para que te recomiende mejor la próxima vez.
          <span style={{ display: "block", color: "#F4A623", fontWeight: 600, marginTop: 6, fontSize: "13px" }}>
            Guardar mis gustos →
          </span>
        </button>
      </GenioTip>

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center font-[family-name:var(--font-dm)]"
          style={{ zIndex: 100, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", minHeight: "100dvh" }}
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div
            style={{
              background: TIP_BG,
              borderRadius: 20,
              padding: "32px 24px 28px",
              maxWidth: 340,
              width: "90%",
              boxShadow: "0 25px 60px rgba(180,130,50,0.15)",
              position: "relative",
            }}
          >
            {/* Close */}
            <button
              onClick={() => setModalOpen(false)}
              style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={18} color="#c4a882" />
            </button>

            {status === "success" ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <span style={{ fontSize: "2.4rem", display: "block", marginBottom: 12 }}>🧞</span>
                <p style={{ color: "#16a34a", fontSize: "1rem", fontWeight: 700 }}>¡Listo! Tus gustos quedaron guardados</p>
                <p style={{ color: "#999", fontSize: "0.85rem", marginTop: 6 }}>La próxima vez te recomendaré mejor</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <span style={{ fontSize: "2.4rem", display: "block", marginBottom: 10 }}>🧞</span>
                  <h3
                    className="font-[family-name:var(--font-playfair)]"
                    style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0e0e0e", lineHeight: 1.2 }}
                  >
                    Guarda tus gustos
                  </h3>
                  <p style={{ fontSize: "0.85rem", color: "#999", marginTop: 6, lineHeight: 1.5 }}>
                    Así el Genio te recomienda mejor cada vez
                  </p>
                </div>

                {/* Form */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                    style={inputStyle}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    style={inputStyle}
                  />
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
                    {status === "loading" ? "Guardando..." : "Guardar"}
                  </button>
                </div>

                <p style={{ textAlign: "center", fontSize: "0.75rem", color: "#bbb", marginTop: 12 }}>
                  🔒 Gratis · Sin contraseña · Funciona en todos los restaurantes
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
