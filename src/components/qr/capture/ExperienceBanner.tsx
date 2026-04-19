"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
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

interface Props {
  restaurantId: string;
}

const DISMISS_KEY = "quierocomer_exp_dismissed";

export default function ExperienceBanner({ restaurantId }: Props) {
  const [exp, setExp] = useState<ExperienceData | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState(0); // 0=intro, 1=name, 2=birth, 3=email, 4=result
  const [userName, setUserName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [teaser, setTeaser] = useState<{ resultName: string; resultDescription: string; resultTraits: string[] } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    // Check if dismissed this session
    if (sessionStorage.getItem(`${DISMISS_KEY}_${restaurantId}`)) return;

    fetch(`/api/qr/experience?restaurantId=${restaurantId}`)
      .then(r => r.json())
      .then(d => {
        if (d.experience) {
          setExp(d.experience);
          // Show after 5 seconds (production: 30000)
          timerRef.current = setTimeout(() => setVisible(true), 5000);
        }
      })
      .catch(() => {});

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [restaurantId]);

  const dismiss = () => {
    setVisible(false);
    setDismissed(true);
    sessionStorage.setItem(`${DISMISS_KEY}_${restaurantId}`, "1");
  };

  const openModal = () => {
    setModalOpen(true);
    setStep(0);
    setVisible(false);
  };

  const handleSubmit = async () => {
    if (!exp || !userName || !birthDate || !email) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/qr/experience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experienceId: exp.id, guestId: getGuestId(), userName, birthDate, email }),
      });
      const data = await res.json();
      if (data.teaser) setTeaser(data.teaser);
      setStep(4);
    } catch {}
    setSubmitting(false);
  };

  if (dismissed || !exp) return null;

  const accent = exp.accentColor;

  return (
    <>
      {/* Banner */}
      {visible && !modalOpen && (
        <div
          className="font-[family-name:var(--font-dm)]"
          style={{
            margin: "16px 20px", padding: "18px",
            background: `linear-gradient(135deg, #1a1a1a 0%, #111 100%)`,
            border: `1px solid ${accent}40`,
            borderRadius: 16,
            display: "flex", alignItems: "center", gap: 14,
            position: "relative",
            boxShadow: `0 4px 20px ${accent}15`,
            opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(10px)",
            transition: "all 0.4s ease",
          }}
        >
          <button onClick={dismiss} style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", padding: 2, cursor: "pointer" }}>
            <X size={13} color="rgba(255,255,255,0.4)" />
          </button>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: `${accent}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", flexShrink: 0 }}>
            {exp.iconEmoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: "0.92rem", fontWeight: 700, color: "white", margin: 0 }}>{exp.name}</p>
            <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", margin: "3px 0 0" }}>{exp.description}</p>
          </div>
          <button onClick={openModal} className="active:scale-95 transition-transform" style={{ background: accent, color: "#0a0a0a", border: "none", borderRadius: 50, padding: "10px 18px", fontSize: "0.82rem", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", flexShrink: 0, boxShadow: `0 4px 14px ${accent}40` }}>
            Descubrir
          </button>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <>
          <div onClick={() => { setModalOpen(false); dismiss(); }} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
          <div
            className="font-[family-name:var(--font-dm)]"
            style={{
              position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
              width: "100%", maxWidth: 420, maxHeight: "88vh",
              background: "#0a0a0a", borderRadius: "28px 28px 0 0",
              zIndex: 101, padding: "32px 24px 40px", overflowY: "auto",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 36, height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 100 }} />

            {/* Step 0: Intro */}
            {step === 0 && (
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: "3rem", display: "block", marginBottom: 16 }}>{exp.iconEmoji}</span>
                <h2 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "26px", fontWeight: 600, color: "white", margin: "0 0 12px", lineHeight: 1.1 }}>{exp.name}</h2>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5, margin: "0 0 28px" }}>{exp.description}</p>
                <button onClick={() => setStep(1)} style={{ background: accent, color: "#0a0a0a", border: "none", borderRadius: 50, padding: "14px 32px", fontSize: "15px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: `0 4px 16px ${accent}40` }}>
                  Empezar
                </button>
              </div>
            )}

            {/* Step 1: Name */}
            {step === 1 && (
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", margin: "0 0 8px" }}>Paso 1 de 3</p>
                <h2 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "22px", fontWeight: 600, color: "white", margin: "0 0 24px" }}>¿Cómo te llamas?</h2>
                <input autoFocus value={userName} onChange={e => setUserName(e.target.value)} placeholder="Tu nombre" style={{ width: "100%", padding: "14px 18px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "white", fontSize: "16px", outline: "none", textAlign: "center", fontFamily: "inherit", boxSizing: "border-box" }} />
                <button onClick={() => { if (userName) setStep(2); }} disabled={!userName} style={{ marginTop: 20, background: accent, color: "#0a0a0a", border: "none", borderRadius: 50, padding: "14px 32px", fontSize: "15px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", opacity: userName ? 1 : 0.4 }}>
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
                <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} style={{ width: "100%", padding: "14px 18px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: birthDate ? "white" : "rgba(255,255,255,0.3)", fontSize: "16px", outline: "none", textAlign: "center", fontFamily: "inherit", colorScheme: "dark", boxSizing: "border-box" }} />
                <button onClick={() => { if (birthDate) setStep(3); }} disabled={!birthDate} style={{ marginTop: 20, background: accent, color: "#0a0a0a", border: "none", borderRadius: 50, padding: "14px 32px", fontSize: "15px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", opacity: birthDate ? 1 : 0.4 }}>
                  Siguiente
                </button>
              </div>
            )}

            {/* Step 3: Email */}
            {step === 3 && (
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", margin: "0 0 8px" }}>Paso 3 de 3</p>
                <h2 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "22px", fontWeight: 600, color: "white", margin: "0 0 8px" }}>¿Dónde enviamos tu resultado?</h2>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", margin: "0 0 24px" }}>Recibirás tu resultado en unos minutos</p>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" style={{ width: "100%", padding: "14px 18px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "white", fontSize: "16px", outline: "none", textAlign: "center", fontFamily: "inherit", boxSizing: "border-box" }} />
                <button onClick={handleSubmit} disabled={!email || submitting} style={{ marginTop: 20, background: accent, color: "#0a0a0a", border: "none", borderRadius: 50, padding: "14px 32px", fontSize: "15px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", opacity: !email || submitting ? 0.4 : 1 }}>
                  {submitting ? "Consultando..." : "Descubrir mi resultado"}
                </button>
              </div>
            )}

            {/* Step 4: Result teaser */}
            {step === 4 && teaser && (
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: "3rem", display: "block", marginBottom: 12 }}>{exp.iconEmoji}</span>
                <p style={{ fontSize: "12px", color: accent, letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 8px" }}>{userName}, eres</p>
                <h2 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "32px", fontWeight: 600, color: accent, margin: "0 0 16px" }}>{teaser.resultName}</h2>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)", lineHeight: 1.5, margin: "0 0 12px" }}>{teaser.resultDescription}</p>
                <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
                  {teaser.resultTraits.map(t => (
                    <span key={t} style={{ fontSize: "11px", padding: "4px 10px", borderRadius: 50, background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}>{t}</span>
                  ))}
                </div>
                <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", margin: "0 0 24px" }}>En los próximos minutos recibirás tu resultado completo por email</p>
                <button onClick={() => { setModalOpen(false); dismiss(); }} style={{ background: "rgba(255,255,255,0.08)", color: "white", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 50, padding: "12px 28px", fontSize: "14px", fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
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
