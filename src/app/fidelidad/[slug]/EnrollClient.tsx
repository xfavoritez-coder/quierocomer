"use client";

import { useState } from "react";

interface RewardTier {
  stamp: number;
  reward: string;
}
interface Props {
  slug: string;
  restaurantName: string;
  restaurantLogo: string | null;
  program: {
    name: string;
    cardColorHex: string;
    stampIcon: string;
    stampGoal: number;
    description: string | null;
    rewards: RewardTier[];
  };
}

function isLight(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.6;
}

export default function EnrollClient({ slug, restaurantName, restaurantLogo, program }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ appleUrl: string | null; googleSaveUrl: string | null } | null>(null);

  const accent = program.cardColorHex;
  const onAccentText = isLight(accent) ? "#111" : "#fff";
  const iconText = program.stampIcon === "logo" ? "sellos" : program.stampIcon;

  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = () => /android/i.test(navigator.userAgent);

  const submit = async () => {
    setError("");
    if (!name && !email && !phone) {
      setError("Ingresa tu nombre y un contacto.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/loyalty/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name, email, phone, birthDate: birthDate || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error");

      // Redirigir directo al wallet según dispositivo
      if (isIOS() && d.appleUrl) {
        window.location.href = d.appleUrl;
        return;
      }
      if (isAndroid() && d.googleSaveUrl) {
        window.location.href = d.googleSaveUrl;
        return;
      }

      // Desktop u otro: mostrar pantalla con ambos botones
      setDone({ appleUrl: d.appleUrl, googleSaveUrl: d.googleSaveUrl });
    } catch (e: any) {
      setError(e.message || "No pudimos crear tu tarjeta.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px 14px",
    boxSizing: "border-box",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 12,
    color: "#fff",
    fontSize: "1rem",
    outline: "none",
    marginBottom: 12,
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0d0d0d",
        color: "#fff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        justifyContent: "center",
        padding: "28px 18px 48px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Encabezado del restaurante */}
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          {restaurantLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={restaurantLogo} alt="" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", margin: "0 auto 12px", display: "block", background: "rgba(255,255,255,0.1)" }} />
          )}
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>{restaurantName}</h1>
          <p style={{ color: "rgba(255,255,255,0.6)", margin: "4px 0 0" }}>{program.name}</p>
        </div>

        {/* Recompensas */}
        {program.rewards.length > 0 && (
          <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 16, marginBottom: 22 }}>
            <p style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.5)", margin: "0 0 10px" }}>
              Junta {iconText} y gana
            </p>
            {program.rewards.map((r) => (
              <div key={r.stamp} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                <span style={{ minWidth: 44, height: 28, borderRadius: 8, background: accent, color: onAccentText, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.85rem" }}>
                  {r.stamp} {iconText}
                </span>
                <span style={{ fontSize: "0.95rem" }}>{r.reward}</span>
              </div>
            ))}
          </div>
        )}

        {!done ? (
          <>
            {/* Formulario */}
            <p style={{ fontWeight: 700, fontSize: "1.05rem", margin: "0 0 12px" }}>Crea tu tarjeta gratis</p>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" style={inputStyle} />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={inputStyle} inputMode="email" />
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono (opcional)" style={inputStyle} inputMode="tel" />
            <div style={{ position: "relative", marginBottom: 12 }}>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                style={{ ...inputStyle, marginBottom: 0, colorScheme: "dark" }}
              />
              {!birthDate && (
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.35)", fontSize: "1rem", pointerEvents: "none" }}>
                  Fecha de cumpleaños (opcional)
                </span>
              )}
            </div>

            {error && <p style={{ color: "#ff6b6b", fontSize: "0.85rem", margin: "0 0 12px" }}>{error}</p>}

            <button
              type="button"
              onClick={submit}
              disabled={loading}
              style={{ width: "100%", padding: "15px", borderRadius: 12, border: "none", background: accent, color: onAccentText, fontSize: "1.05rem", fontWeight: 800, cursor: "pointer", opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Creando…" : "Crear mi tarjeta"}
            </button>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
              La guardarás en Apple Wallet o Google Wallet. {program.description}
            </p>
          </>
        ) : (
          <>
            {/* Éxito → botones de wallet */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: "2.4rem" }}>🎉</div>
              <p style={{ fontWeight: 800, fontSize: "1.15rem", margin: "6px 0 4px" }}>¡Tu tarjeta está lista{name ? `, ${name}` : ""}!</p>
              <p style={{ color: "rgba(255,255,255,0.6)", margin: 0 }}>Agrégala a tu teléfono para empezar a juntar {iconText}.</p>
            </div>

            {done.appleUrl && (
              <a href={done.appleUrl} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: "15px", borderRadius: 12, background: accent, color: onAccentText, fontSize: "1rem", fontWeight: 700, textDecoration: "none", marginBottom: 12, boxSizing: "border-box" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                Agregar a Apple Wallet
              </a>
            )}
            {done.googleSaveUrl && (
              <a href={done.googleSaveUrl} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: "15px", borderRadius: 12, background: accent, color: onAccentText, fontSize: "1rem", fontWeight: 700, textDecoration: "none", boxSizing: "border-box" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21.56 10.738l-9.4-9.4a1.794 1.794 0 0 0-2.538 0l-1.76 1.759 2.226 2.226a2.133 2.133 0 0 1 2.7 2.72l2.145 2.146a2.133 2.133 0 1 1-1.279 1.218l-2-2v5.264a2.134 2.134 0 1 1-1.755-.062V9.157a2.134 2.134 0 0 1-1.159-2.8L6.52 4.134 2.44 8.214a1.794 1.794 0 0 0 0 2.537l9.4 9.4a1.794 1.794 0 0 0 2.537 0l7.183-7.182a1.794 1.794 0 0 0 0-2.231z"/></svg>
                Guardar en Google Wallet
              </a>
            )}
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
              En iPhone usa Apple Wallet; en Android, Google Wallet.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
