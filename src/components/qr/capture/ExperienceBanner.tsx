"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { getGuestId } from "@/lib/guestId";

interface ExperienceData {
  id: string;
  name: string;
  slug: string;
  description: string;
  accentColor: string;
  iconEmoji: string;
  theme: string;
}

interface PreviousResult {
  resultName: string;
  resultTraits: string[];
  userName: string;
}

interface Props {
  restaurantId: string;
}

export default function ExperienceBanner({ restaurantId }: Props) {
  const [exp, setExp] = useState<ExperienceData | null>(null);
  const [prevResult, setPrevResult] = useState<PreviousResult | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [userName, setUserName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState("");
  const [registerMe, setRegisterMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [teaser, setTeaser] = useState<{ resultName: string; resultDescription: string; resultTraits: string[] } | null>(null);
  const [isRepeat, setIsRepeat] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const guestId = getGuestId();
    fetch(`/api/qr/experience?restaurantId=${restaurantId}&guestId=${guestId}`)
      .then(r => r.json())
      .then(d => {
        if (d.experience) {
          setExp(d.experience);
          if (d.previousResult) setPrevResult(d.previousResult);
        }
      })
      .catch(() => {});
  }, [restaurantId]);

  const openModal = (repeat: boolean) => {
    setIsRepeat(repeat);
    if (repeat) {
      setUserName("");
      setBirthDate("");
      setEmail("");
      setRegisterMe(false);
      setTeaser(null);
    } else {
      const userCookie = document.cookie.match(/qr_user_id=([^;]*)/);
      if (userCookie) {
        fetch("/api/qr/user/me").then(r => r.json()).then(d => {
          if (d.user?.name) {
            setUserName(d.user.name);
            if (d.user.email) setEmail(d.user.email);
            if (d.user.birthDate) setBirthDate(d.user.birthDate.split("T")[0]);
          }
        }).catch(() => {});
      }
      setRegisterMe(true);
    }
    setModalOpen(true);
    setStep(0);
  };

  const handleSubmit = async () => {
    if (!exp || !userName || !birthDate || !email) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/qr/experience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experienceId: exp.id,
          guestId: isRepeat ? null : getGuestId(),
          userName, birthDate, email,
          registerMe: registerMe && !isRepeat,
        }),
      });
      const data = await res.json();
      if (data.teaser) {
        setTeaser(data.teaser);
        if (!isRepeat) {
          setPrevResult({ resultName: data.teaser.resultName, resultTraits: data.teaser.resultTraits, userName });
        }
      }
      setStep(4);
    } catch {}
    setSubmitting(false);
  };

  if (!exp) return null;

  const accent = exp.accentColor;
  // For light accent colors, darken for use on light banner backgrounds
  const isLightAccent = (() => {
    const hex = accent.replace("#", "");
    if (hex.length < 6) return false;
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 160;
  })();
  const bannerAccent = isLightAccent ? "#5a4a3a" : accent;
  const hasPrevious = !!prevResult;

  return (
    <>
      {/* Banner */}
      {!modalOpen && (
        <div
          className="font-[family-name:var(--font-dm)]"
          style={{
            margin: "16px 20px", padding: "14px 16px",
            background: hasPrevious
              ? `linear-gradient(135deg, ${accent}18, ${accent}08)`
              : `linear-gradient(135deg, ${accent}12, ${accent}06)`,
            border: `1px solid ${accent}25`,
            borderRadius: 14,
          }}
        >
          {hasPrevious ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: "1.6rem", flexShrink: 0, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>{exp.iconEmoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "0.72rem", color: bannerAccent, margin: 0, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  {prevResult.userName}, eres
                </p>
                <p style={{ fontSize: "1rem", fontWeight: 700, color: "#0e0e0e", margin: "2px 0 0" }}>
                  {prevResult.resultName}
                </p>
              </div>
              <button onClick={() => openModal(true)} className="active:scale-95 transition-transform" style={{ background: "rgba(0,0,0,0.06)", color: "#555", border: "none", borderRadius: 50, padding: "7px 14px", fontSize: "0.75rem", fontWeight: 600, fontFamily: "inherit", cursor: "pointer", flexShrink: 0 }}>
                Repetir
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: "1.6rem", flexShrink: 0, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>{exp.iconEmoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "0.92rem", fontWeight: 700, color: "#0e0e0e", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{exp.name}</p>
                <p style={{ fontSize: "0.78rem", color: "#8a7060", margin: "2px 0 0" }}>{exp.description}</p>
              </div>
              <button onClick={() => openModal(false)} className="active:scale-95 transition-transform" style={{ background: "#F4A623", color: "white", border: "none", borderRadius: 50, padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 2px 10px rgba(244,166,35,0.3)", flexShrink: 0 }}>
                Descubrir
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <>
          <div onClick={() => setModalOpen(false)} style={{ position: "fixed", top: "-50px", left: 0, right: 0, bottom: "-50px", zIndex: 100, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
          <div
            className="font-[family-name:var(--font-dm)]"
            style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              width: "90%", maxWidth: 380,
              background: "#0a0a0a", borderRadius: 24,
              zIndex: 101, padding: "36px 28px 32px", overflowY: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            {/* X close button */}
            <button onClick={() => setModalOpen(false)} style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
              <X size={14} color="rgba(255,255,255,0.5)" />
            </button>

            {/* Step 0: Intro */}
            {step === 0 && (
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: "3rem", display: "block", marginBottom: 16 }}>{exp.iconEmoji}</span>
                <h2 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "26px", fontWeight: 600, color: "white", margin: "0 0 12px", lineHeight: 1.1 }}>{exp.name}</h2>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5, margin: "0 0 28px" }}>{exp.description}. Descúbrelo a través de tu nombre, gustos y fecha de nacimiento</p>
                <button onClick={() => {
                  if (!isRepeat && userName && birthDate && email) { handleSubmit(); }
                  else if (!isRepeat && userName) { setStep(birthDate ? 3 : 2); }
                  else { setStep(1); }
                }} style={{ background: "#F4A623", color: "#0a0a0a", border: "none", borderRadius: 50, padding: "14px 32px", fontSize: "15px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 4px 16px rgba(244,166,35,0.3)" }}>
                  {isRepeat ? "Empezar de nuevo" : "Empezar"}
                </button>
              </div>
            )}

            {/* Step 1: Name — no autoFocus to prevent mobile keyboard jump */}
            {step === 1 && (
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", margin: "0 0 8px" }}>Paso 1 de 3</p>
                <h2 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "22px", fontWeight: 600, color: "white", margin: "0 0 24px" }}>¿Cómo te llamas?</h2>
                <input
                  ref={nameRef}
                  value={userName}
                  onChange={e => setUserName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && userName) setStep(2); }}
                  placeholder="Tu nombre"
                  style={{ width: "100%", padding: "14px 18px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "white", fontSize: "16px", outline: "none", textAlign: "center", fontFamily: "inherit", boxSizing: "border-box" }}
                />
                <button onClick={() => { if (userName) setStep(2); }} disabled={!userName} style={{ marginTop: 20, background: "#F4A623", color: "#0a0a0a", border: "none", borderRadius: 50, padding: "14px 32px", fontSize: "15px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", opacity: userName ? 1 : 0.4 }}>
                  Siguiente
                </button>
              </div>
            )}

            {/* Step 2: Birth date */}
            {step === 2 && (
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", margin: "0 0 8px" }}>Paso 2 de 3</p>
                <h2 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "22px", fontWeight: 600, color: "white", margin: "0 0 8px" }}>¿Cuándo naciste?</h2>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", margin: "0 0 24px" }}>Los astros necesitan esta información</p>
                <input
                  type="date"
                  value={birthDate}
                  onChange={e => setBirthDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  min="1940-01-01"
                  style={{ width: "100%", padding: "14px 18px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: birthDate ? "white" : "rgba(255,255,255,0.3)", fontSize: "16px", outline: "none", textAlign: "center", fontFamily: "inherit", colorScheme: "dark", boxSizing: "border-box", WebkitAppearance: "none", appearance: "none" as any }}
                />
                <button onClick={() => { if (birthDate) setStep(3); }} disabled={!birthDate} style={{ marginTop: 20, background: "#F4A623", color: "#0a0a0a", border: "none", borderRadius: 50, padding: "14px 32px", fontSize: "15px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", opacity: birthDate ? 1 : 0.4 }}>
                  Siguiente
                </button>
              </div>
            )}

            {/* Step 3: Email + register checkbox */}
            {step === 3 && (
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", margin: "0 0 8px" }}>Paso 3 de 3</p>
                <h2 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "22px", fontWeight: 600, color: "white", margin: "0 0 8px" }}>¿Dónde enviamos tu resultado?</h2>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.35)", margin: "0 0 24px" }}>Recibirás tu resultado completo por email en 2 minutos</p>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && email) handleSubmit(); }}
                  placeholder="tu@email.com"
                  style={{ width: "100%", padding: "14px 18px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "white", fontSize: "16px", outline: "none", textAlign: "center", fontFamily: "inherit", boxSizing: "border-box" }}
                />
                {!isRepeat && (
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 16, cursor: "pointer", textAlign: "left" }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${registerMe ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)"}`, background: registerMe ? "rgba(255,255,255,0.15)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, transition: "all 0.15s" }} onClick={() => setRegisterMe(!registerMe)}>
                      {registerMe && <span style={{ color: "white", fontSize: "12px", lineHeight: 1 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>Guardar mis datos para recomendaciones personalizadas</span>
                  </label>
                )}
                <button onClick={handleSubmit} disabled={!email || submitting} style={{ marginTop: 20, background: "#F4A623", color: "#0a0a0a", border: "none", borderRadius: 50, padding: "14px 32px", fontSize: "15px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", opacity: !email || submitting ? 0.4 : 1 }}>
                  {submitting ? "Consultando..." : "Descubrir mi resultado"}
                </button>
              </div>
            )}

            {/* Step 4: Result teaser */}
            {step === 4 && teaser && (
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: "3rem", display: "block", marginBottom: 12 }}>{exp.iconEmoji}</span>
                <p style={{ fontSize: "12px", color: accent, letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 8px" }}>{userName}, eres</p>
                <h2 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "33px", fontWeight: 600, color: accent, margin: "0 0 16px" }}>{teaser.resultName}</h2>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)", lineHeight: 1.5, margin: "0 0 12px" }}>{teaser.resultDescription}</p>
                <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
                  {teaser.resultTraits.map(t => (
                    <span key={t} style={{ fontSize: "13px", padding: "4px 10px", borderRadius: 50, background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}>{t}</span>
                  ))}
                </div>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", margin: "0 0 24px", lineHeight: 1.5 }}>En 2 minutos recibirás el detalle completo de tu resultado por email</p>
                <button onClick={() => setModalOpen(false)} style={{ background: "rgba(255,255,255,0.08)", color: "white", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 50, padding: "12px 28px", fontSize: "14px", fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                  Volver a la carta
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
