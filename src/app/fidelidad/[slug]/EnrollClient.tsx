"use client";

import { useState, useEffect } from "react";

interface RewardTier {
  stamp: number;
  reward: string;
}
interface Props {
  slug: string;
  restaurantName: string;
  restaurantLogo: string | null;
  colorMode?: string;
  hideBack?: boolean;
  program: {
    name: string;
    cardColorHex: string;
    accentColor: string;
    stampIcon: string;
    stampGoal: number;
    description: string | null;
    heroText?: string | null;
    rewards: RewardTier[];
  };
}

function isLight(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.6;
}

export default function EnrollClient({ slug, restaurantName, restaurantLogo, colorMode, hideBack, program }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ appleUrl: string | null; googleSaveUrl: string | null } | null>(null);
  const [device, setDevice] = useState<"ios" | "android" | "other">("other");

  const accent = program.accentColor || program.cardColorHex;
  const onAccentText = isLight(accent) ? "#111" : "#fff";
  const isLightMode = colorMode === "LIGHT";
  const iconText = program.stampIcon === "logo" ? "sellos" : program.stampIcon;

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) setDevice("ios");
    else if (/android/i.test(ua)) setDevice("android");
  }, []);

  const submit = async () => {
    setError("");
    if (!name) { setError("Ingresa tu nombre."); return; }
    if (!email) { setError("Ingresa tu email."); return; }
    if (!birthDate) { setError("Ingresa tu fecha de cumpleaños."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/loyalty/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name, email, phone, birthDate: birthDate || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error");

      if (device === "ios" && d.appleUrl) { window.location.href = d.appleUrl; return; }
      if (device === "android" && d.googleSaveUrl) { window.location.href = d.googleSaveUrl; return; }
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
    background: isLightMode ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
    border: isLightMode ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.15)",
    borderRadius: 12,
    color: isLightMode ? "#111" : "#fff",
    fontSize: "1rem",
    outline: "none",
    display: "block",
  };
  const inputClass = "enroll-input";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: isLightMode ? '#F9F7F4' : '#0d0d0d',
        color: isLightMode ? '#111' : '#fff',
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Botón volver — oculto para clientes tipo STORE */}
      {!hideBack && (
        <a href={`/${slug}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", color: isLightMode ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.55)", fontSize: "0.82rem", fontWeight: 600, textDecoration: "none" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Volver
        </a>
      )}

      {/* ── HERO HEADER ── */}
      <div style={{
        position: "relative",
        overflow: "hidden",
        background: `linear-gradient(160deg, ${accent}30 0%, ${accent}10 45%, ${isLightMode ? '#F9F7F4' : '#111'} 100%)`,
        borderBottom: `1px solid ${accent}30`,
        padding: "32px 20px 28px",
        textAlign: "center",
      }}>
        <div style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", background: `radial-gradient(circle, ${accent}25 0%, transparent 65%)`, top: -80, right: -80, pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 180, height: 180, borderRadius: "50%", background: `radial-gradient(circle, ${accent}15 0%, transparent 65%)`, bottom: -50, left: -50, pointerEvents: "none" }} />

        {/* Logo + nombre */}
        {restaurantLogo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={restaurantLogo} alt="" style={{ width: 62, height: 62, borderRadius: "50%", objectFit: "cover", margin: "0 auto 10px", display: "block", border: `3px solid ${accent}`, boxShadow: `0 0 20px ${accent}66` }} />
        )}
        <p style={{ fontSize: "0.72rem", fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.14em", margin: "0 0 2px" }}>{restaurantName}</p>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 900, margin: "0 0 20px", lineHeight: 1.15, color: isLightMode ? '#111' : '#fff' }}>{program.name || "Tarjeta de premios"}</h1>

        {/* Texto descriptivo */}
        <p style={{ fontSize: "0.88rem", color: isLightMode ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.65)", lineHeight: 1.55, margin: "0 0 20px", maxWidth: 340, marginLeft: "auto", marginRight: "auto" }}>
          {(program as any).heroText || "Acumula sellos cada vez que compras y canjéalos por productos gratis. Tu tarjeta se guarda directamente en tu celular."}
        </p>

        {/* ── PREVIEW TARJETA ── */}
        <div style={{
          background: `linear-gradient(135deg, ${accent}18, rgba(255,255,255,0.04))`,
          border: `1.5px solid ${accent}40`,
          borderRadius: 20,
          padding: "18px 16px",
          marginBottom: 22,
          position: "relative",
          zIndex: 1,
        }}>
          <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: accent, margin: "0 0 14px" }}>
            Junta {program.stampGoal} sellos y gana
          </p>

          {/* Grid de sellos */}
          {(() => {
            const rewardStamps = new Set(program.rewards.map((r) => r.stamp));
            const cols = program.stampGoal <= 6 ? program.stampGoal : program.stampGoal <= 8 ? 4 : program.stampGoal <= 10 ? 5 : 6;
            const stampFontSize = cols <= 4 ? "1.3rem" : cols <= 5 ? "1.1rem" : "1rem";
            const stampNumFontSize = cols <= 4 ? "0.75rem" : cols <= 5 ? "0.7rem" : "0.6rem";
            // Máximo 52px por círculo + gaps para que nunca queden demasiado grandes
            const gridMaxWidth = cols * 52 + (cols - 1) * 8;
            return (
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, width: "100%", maxWidth: gridMaxWidth }}>
                {Array.from({ length: program.stampGoal }).map((_, i) => {
                  const num = i + 1;
                  const isReward = rewardStamps.has(num);
                  const isFilled = i < 1; // primer sello "lleno" como preview
                  return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                      <div style={{
                        width: "100%",
                        aspectRatio: "1",
                        borderRadius: "50%",
                        border: `2.5px solid ${isFilled || isReward ? accent : `${accent}50`}`,
                        background: isFilled ? accent : isReward ? `${accent}20` : `${accent}08`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: isReward ? `0 0 14px ${accent}66` : isFilled ? `0 0 10px ${accent}88` : "none",
                        fontSize: stampFontSize,
                        color: isFilled ? onAccentText : isReward ? accent : `${accent}60`,
                        fontWeight: 900,
                        position: "relative",
                      }}>
                        {isFilled ? (iconText === "sellos" ? "★" : iconText) : isReward ? "🎁" : <span style={{ fontSize: stampNumFontSize }}>{num}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
            );
          })()}

          {/* Recompensas */}
          {program.rewards.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {program.rewards.map((r, idx) => (
                <div key={r.stamp} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  background: isLightMode ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.05)",
                  borderRadius: 12, padding: "10px 14px",
                  border: `1px solid ${accent}30`,
                }}>
                  {/* Círculo grande estilo imagen */}
                  <div style={{
                    flexShrink: 0,
                    width: 52, height: 52, borderRadius: "50%",
                    border: isLightMode ? "3px solid rgba(0,0,0,0.15)" : "3px solid rgba(255,255,255,0.9)",
                    background: isLightMode ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    boxShadow: isLightMode ? "0 0 16px rgba(0,0,0,0.08)" : "0 0 16px rgba(255,255,255,0.15)",
                    lineHeight: 1,
                  }}>
                    <span style={{ fontSize: "1.2rem", fontWeight: 900, color: isLightMode ? "#111" : "#fff" }}>{r.stamp}</span>
                    <span style={{ fontSize: "0.45rem", fontWeight: 700, color: isLightMode ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.05em" }}>sellos</span>
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: "0.97rem", color: isLightMode ? "#111" : "#fff" }}>{r.reward}</p>
                    <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: isLightMode ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)" }}>
                      Canjea tu premio al completar {r.stamp} sello{r.stamp > 1 ? "s" : ""}.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <style>{`@keyframes stampPop { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }`}</style>
      </div>

      <div style={{ width: "100%", maxWidth: 420, margin: "0 auto", padding: "24px 18px 48px" }}>

        {!done ? (
          <>
            {/* Formulario */}
            <p style={{ fontWeight: 700, fontSize: "1.05rem", margin: "0 0 18px", color: isLightMode ? "#111" : "#fff" }}>Crea tu tarjeta gratis</p>

            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: isLightMode ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.6)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Nombre</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" style={inputStyle} className={inputClass} />
            </label>

            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: isLightMode ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.6)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" style={inputStyle} className={inputClass} inputMode="email" />
            </label>

            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: isLightMode ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.6)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Fecha de cumpleaños</span>
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputClass} style={{ ...inputStyle, colorScheme: isLightMode ? "light" : "dark", WebkitAppearance: "none", appearance: "none" as any }} />
            </label>

            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: isLightMode ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.6)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Teléfono</span>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+56 9 1234 5678" style={{ ...inputStyle, marginBottom: 0 }} className={inputClass} inputMode="tel" />
            </label>

            {error && <p style={{ color: "#ff6b6b", fontSize: "0.85rem", margin: "0 0 12px" }}>{error}</p>}

            <button
              type="button"
              onClick={submit}
              disabled={loading}
              style={{ width: "100%", padding: "15px", borderRadius: 12, border: "none", background: accent, color: onAccentText, fontSize: "1.05rem", fontWeight: 800, cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
            >
              {loading ? "Creando…" : (
                <>
                  {device === "ios" ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                  ) : device === "android" ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21.56 10.738l-9.4-9.4a1.794 1.794 0 0 0-2.538 0l-1.76 1.759 2.226 2.226a2.133 2.133 0 0 1 2.7 2.72l2.145 2.146a2.133 2.133 0 1 1-1.279 1.218l-2-2v5.264a2.134 2.134 0 1 1-1.755-.062V9.157a2.134 2.134 0 0 1-1.159-2.8L6.52 4.134 2.44 8.214a1.794 1.794 0 0 0 0 2.537l9.4 9.4a1.794 1.794 0 0 0 2.537 0l7.183-7.182a1.794 1.794 0 0 0 0-2.231z"/></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>
                  )}
                  {device === "ios" ? "Agregar a Apple Wallet" : device === "android" ? "Guardar en Google Wallet" : "Crear mi tarjeta"}
                </>
              )}
            </button>
            {program.description && (
              <p style={{ color: isLightMode ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)", fontSize: "0.72rem", textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
                {program.description}
              </p>
            )}
          </>
        ) : (
          <>
            {/* Éxito → botones de wallet */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: "2.4rem" }}>🎉</div>
              <p style={{ fontWeight: 800, fontSize: "1.15rem", margin: "6px 0 4px", color: isLightMode ? "#111" : "#fff" }}>¡Tu tarjeta está lista{name ? `, ${name}` : ""}!</p>
              <p style={{ color: isLightMode ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.6)", margin: 0 }}>Agrégala a tu teléfono para empezar a juntar {iconText}.</p>
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
            <p style={{ color: isLightMode ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)", fontSize: "0.72rem", textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
              En iPhone usa Apple Wallet; en Android, Google Wallet.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
