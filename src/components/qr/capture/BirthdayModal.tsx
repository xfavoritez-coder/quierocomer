"use client";

import { useState, useRef } from "react";
import { X, Calendar } from "lucide-react";
import { getGuestId, getSessionId } from "@/lib/guestId";
import { getDbSessionId } from "@/lib/sessionTracker";
import EmailTypoHint from "./EmailTypoHint";
import { useLang } from "@/contexts/LangContext";
import { t } from "@/lib/qr/i18n";

export interface AbVariant {
  experimentSlug: string;
  titleId?: string;
  titleText?: string;
  subtitleId?: string;
  subtitleText?: string;
  ctaId?: string;
  ctaText?: string;
}

interface Props {
  restaurantId: string;
  restaurantName?: string;
  /** If user is already logged in, pass their data to update instead of register */
  existingUser?: { name: string | null; email: string } | null;
  bannerVariantId?: string;
  /** Active multi-armed bandit variant — overrides default i18n copy. */
  abVariant?: AbVariant | null;
  onClose: () => void;
  onSuccess?: () => void;
}

type Phase = "form" | "name";

export default function BirthdayModal({ restaurantId, restaurantName, existingUser, bannerVariantId, abVariant, onClose, onSuccess }: Props) {
  const lang = useLang();
  // Form state
  const [email, setEmail] = useState(existingUser?.email || "");
  const [birthDate, setBirthDate] = useState("");
  // Texto visible con mascara DD/MM/AAAA. birthDate es el ISO YYYY-MM-DD que se envia al backend.
  const [birthDateText, setBirthDateText] = useState("");
  const hiddenDateRef = useRef<HTMLInputElement>(null);

  const handleDateTextChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length >= 5) formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length >= 3) formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setBirthDateText(formatted);
    if (digits.length === 8) {
      const dd = parseInt(digits.slice(0, 2), 10);
      const mm = parseInt(digits.slice(2, 4), 10);
      const yyyy = parseInt(digits.slice(4), 10);
      const currentYear = new Date().getFullYear();
      if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && yyyy >= 1900 && yyyy <= currentYear) {
        setBirthDate(`${yyyy}-${mm.toString().padStart(2, "0")}-${dd.toString().padStart(2, "0")}`);
        return;
      }
    }
    setBirthDate("");
  };

  const handleDatePickerChange = (val: string) => {
    setBirthDate(val);
    if (val) {
      const [yyyy, mm, dd] = val.split("-");
      setBirthDateText(`${dd}/${mm}/${yyyy}`);
    } else {
      setBirthDateText("");
    }
  };

  const openDatePicker = () => {
    const input = hiddenDateRef.current;
    if (!input) return;
    // showPicker() es la API moderna; si no esta soportada, hacemos focus + click
    if (typeof (input as any).showPicker === "function") {
      try { (input as any).showPicker(); return; } catch { /* fallback */ }
    }
    input.focus();
    input.click();
  };
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [phase, setPhase] = useState<Phase>("form");

  // Cierre sin guardar = "dismissed" (solo si todavía está en form, sin haber guardado nunca)
  const handleDismiss = () => {
    if (status !== "success") {
      // No guardó → tracking de dismiss
      fetch("/api/qr/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "BIRTHDAY_DISMISSED",
          restaurantId,
          guestId: getGuestId(),
          sessionId: getSessionId(),
          dbSessionId: getDbSessionId(),
        }),
      }).catch(() => {});
    }
    onClose();
  };
  // Name capture state (post-success)
  const [name, setName] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  // Info devuelta por /register que distingue cuenta nueva vs re-registro
  const [registrationInfo, setRegistrationInfo] = useState<{
    alreadyExisted: boolean;
    hadPreviousBirthday: boolean;
    hadPreviousName: boolean;
    userName: string | null;
  } | null>(null);

  // Capitaliza "juan pablo" → "Juan Pablo"
  const formatName = (n: string) =>
    n.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

  const handleSubmit = async () => {
    if (status !== "idle") return;
    if (!existingUser && !email) return;
    if (!birthDate) return;
    setStatus("loading");

    let persisted = false;
    let errorMsg: string | null = null;

    if (existingUser) {
      const res = await fetch("/api/qr/user/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthDate }),
      });
      persisted = res.ok;
      if (!res.ok) errorMsg = "No pudimos guardar tu fecha. Intenta de nuevo.";
    } else {
      const savedDiet = localStorage.getItem("qr_diet") || null;
      const savedRestrictions = localStorage.getItem("qr_restrictions");
      const restrictions = savedRestrictions ? JSON.parse(savedRestrictions).filter((r: string) => r !== "ninguna") : [];

      const res = await fetch("/api/qr/user/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: null, // se pide en el siguiente paso para no romper la barrera
          birthDate,
          dietType: savedDiet,
          restrictions,
          restaurantId,
          source: "birthday_banner",
          guestId: getGuestId(),
          sessionId: getSessionId(),
          dbSessionId: getDbSessionId(),
          bannerVariantId: bannerVariantId || null,
        }),
      });

      persisted = res.ok;
      if (!res.ok) {
        try {
          const data = await res.json();
          errorMsg = data?.error || "No pudimos guardar tu cumple. Verifica el email e intenta de nuevo.";
        } catch {
          errorMsg = "No pudimos guardar tu cumple. Intenta de nuevo.";
        }
      } else {
        if (bannerVariantId) {
          await fetch("/api/qr/banner/convert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ variantId: bannerVariantId }),
          });
        }
        try {
          const data = await res.json();
          setRegistrationInfo({
            alreadyExisted: !!data?.alreadyExisted,
            hadPreviousBirthday: !!data?.hadPreviousBirthday,
            hadPreviousName: !!data?.hadPreviousName,
            userName: data?.userName || null,
          });
        } catch { /* ignore */ }
      }
    }

    // Solo trackear BIRTHDAY_SAVED si efectivamente se persistio — evitamos
    // contar 'cumples guardados' fantasma cuando el register fallo (email
    // duplicado u otro error) y la metrica del panel no cuadra con clientes.
    if (!persisted) {
      setStatus("idle");
      if (errorMsg) alert(errorMsg);
      return;
    }

    // Track BIRTHDAY_SAVED con A/B metadata + info para distinguir nuevos vs re-registros
    const abMetadata = abVariant
      ? { abExperiment: abVariant.experimentSlug, titleId: abVariant.titleId, subtitleId: abVariant.subtitleId, ctaId: abVariant.ctaId }
      : {};
    // existingUser viene como prop si la cookie qr_user_id ya estaba — entonces
    // siempre fue cuenta existente. Para el caso anonimo, leemos del response.
    const wasExistingAccount = !!existingUser || (registrationInfo?.alreadyExisted ?? false);
    // hadBirthday: solo lo sabemos por el response del register (caso anonimo).
    // Si existingUser, le acabamos de agregar el cumple via PATCH — antes no lo tenia.
    const hadBirthdayBefore = registrationInfo?.hadPreviousBirthday ?? false;
    fetch("/api/qr/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "BIRTHDAY_SAVED",
        restaurantId,
        guestId: getGuestId(),
        sessionId: getSessionId(),
        dbSessionId: getDbSessionId(),
        metadata: { ...abMetadata, wasExistingAccount, hadBirthdayBefore },
      }),
    }).catch(() => {});

    setStatus("success");
    onSuccess?.();

    // Solo si ya teniamos nombre guardado evitamos preguntar de nuevo.
    // Si la cuenta existia pero sin nombre, igual le pedimos el nombre.
    const alreadyHadName = !!existingUser?.name;
    setPhase("name"); // mostrar phase 2 (success + name capture o welcome-back)
    if (alreadyHadName) {
      // Cuenta con nombre — auto-cerrar despues de 2.2s sin pedir nada mas
      setTimeout(() => onClose(), 2200);
    }
  };

  const handleSaveName = async () => {
    if (nameSaving) return;
    const trimmed = name.trim();
    if (!trimmed) {
      onClose();
      return;
    }
    setNameSaving(true);
    try {
      await fetch("/api/qr/user/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formatName(trimmed) }),
      });
      // Track captura post-éxito
      fetch("/api/qr/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "BIRTHDAY_NAME_CAPTURED",
          restaurantId,
          guestId: getGuestId(),
          sessionId: getSessionId(),
          dbSessionId: getDbSessionId(),
        }),
      }).catch(() => {});
    } catch {}
    onClose();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center font-[family-name:var(--font-dm)]"
      style={{ zIndex: 200, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", minHeight: "100dvh" }}
      onClick={(e) => { if (e.target === e.currentTarget && phase === "form") handleDismiss(); }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 20,
          padding: "32px 24px 28px",
          maxWidth: 360,
          width: "90%",
          maxHeight: "90dvh",
          overflowY: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
          position: "relative",
        }}
      >
        <button
          onClick={handleDismiss}
          style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer" }}
        >
          <X size={18} color="#ccc" />
        </button>

        {/* ── FASE 1: FORM ── */}
        {phase === "form" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <span style={{ fontSize: "2.8rem", display: "block", marginBottom: 10 }}>🎂</span>
              <h3
                className="font-[family-name:var(--font-playfair)]"
                style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0e0e0e", lineHeight: 1.2 }}
              >
                {abVariant?.titleText
                  || (restaurantName ? t(lang, "bdayModalTitleRestaurant").replace("{name}", restaurantName) : t(lang, "bdayModalTitle"))}
              </h3>
              <p style={{ fontSize: "0.85rem", color: "#888", marginTop: 6, lineHeight: 1.5 }}>
                {abVariant?.subtitleText || t(lang, "bdayModalSub")}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {!existingUser && (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", color: "#888", marginBottom: 4, fontFamily: "inherit" }}>{t(lang, "bdayLabelEmail")}</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t(lang, "bdayPlaceholderEmail")}
                      style={{
                        width: "100%", background: "#f9f9f7", border: "1px solid #eee", borderRadius: 10,
                        padding: "12px 16px", color: "#0e0e0e", fontSize: "0.92rem",
                        outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <EmailTypoHint email={email} onAccept={setEmail} />
                </>
              )}
              <div style={{ position: "relative" }}>
                <label style={{ display: "block", fontSize: "0.78rem", color: "#888", marginBottom: 4, fontFamily: "inherit" }}>{t(lang, "bdayLabelDate")}</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="DD/MM/AAAA"
                    value={birthDateText}
                    onChange={(e) => handleDateTextChange(e.target.value)}
                    maxLength={10}
                    style={{
                      width: "100%", background: "#f9f9f7", border: "1px solid #eee", borderRadius: 10,
                      padding: "12px 44px 12px 16px", color: "#0e0e0e", fontSize: "0.92rem",
                      outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                      letterSpacing: "0.02em",
                    }}
                  />
                  <button
                    type="button"
                    onClick={openDatePicker}
                    aria-label="Abrir calendario"
                    style={{
                      position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                      background: "transparent", border: "none", cursor: "pointer",
                      padding: 6, display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#888",
                    }}
                  >
                    <Calendar size={18} />
                  </button>
                  {/* Input date oculto — se abre solo al hacer click en el icono */}
                  <input
                    ref={hiddenDateRef}
                    type="date"
                    value={birthDate}
                    onChange={(e) => handleDatePickerChange(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    style={{
                      position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                      width: 1, height: 1, padding: 0, opacity: 0, pointerEvents: "none",
                    }}
                  />
                </div>
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
                {status === "loading" ? t(lang, "bdaySaving") : (abVariant?.ctaText || t(lang, "bdayButton"))}
              </button>
            </div>

            {!existingUser && (
              <p style={{ textAlign: "center", fontSize: "0.75rem", color: "#aaa", marginTop: 12 }}>
                🔒 {t(lang, "bdayPrivacy")}
              </p>
            )}
          </>
        )}

        {/* ── FASE 2: SUCCESS + NAME PROMPT (o welcome-back si ya estaba registrado) ── */}
        {phase === "name" && (() => {
          // Welcome-back automatico SOLO si ya teniamos nombre. Si la cuenta
          // existia pero no tenia nombre, pasamos al flow normal de captura.
          const previousName = existingUser?.name || registrationInfo?.userName || null;
          const showWelcomeBack = !!existingUser?.name;
          const hadBirthday = registrationInfo?.hadPreviousBirthday ?? false;
          const firstName = previousName?.split(" ")[0] || null;

          if (showWelcomeBack) {
            const title = firstName ? `¡Te tenemos, ${firstName}! 🎉` : "¡Ya estabas con nosotros! 🎉";
            const sub = hadBirthday
              ? "Tu cumpleaños ya estaba guardado. Te avisaremos cuando se acerque tu día."
              : "Guardamos tu cumpleaños. Te avisaremos cuando se acerque tu día.";
            return (
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: "2.6rem", display: "block", marginBottom: 8, animation: "bdayDonePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>🎉</span>
                <h3 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0e0e0e", lineHeight: 1.2, marginBottom: 8 }}>
                  {title}
                </h3>
                <p style={{ fontSize: "0.92rem", color: "#666", margin: "0 0 18px", lineHeight: 1.5 }}>
                  {sub}
                </p>
                <button
                  onClick={onClose}
                  className="active:scale-[0.98] transition-transform"
                  style={{
                    width: "100%", background: "#F4A623", color: "white",
                    borderRadius: 50, padding: "13px 20px", fontSize: "0.95rem", fontWeight: 700,
                    border: "none", fontFamily: "inherit", cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(244,166,35,0.3)",
                  }}
                >
                  Continuar
                </button>
                <style>{`@keyframes bdayDonePop { 0% { transform: scale(0.4); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }`}</style>
              </div>
            );
          }

          // Cuenta nueva: confirmacion + captura de nombre
          return (
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: "2.6rem", display: "block", marginBottom: 8, animation: "bdayDonePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>🎉</span>
              <h3 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0e0e0e", lineHeight: 1.2, marginBottom: 4 }}>
                {t(lang, "bdayDoneTitle")}
              </h3>
              <p style={{ fontSize: "0.88rem", color: "#888", margin: "0 0 22px", lineHeight: 1.45 }}>
                {t(lang, "bdayDoneSub")}
              </p>

              <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #eee, transparent)", margin: "0 0 20px" }} />

              <p style={{ fontSize: "0.7rem", color: "#F4A623", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 6 }}>
                {t(lang, "bdayNameSubtitle")}
              </p>
              <p style={{ fontSize: "0.88rem", color: "#666", margin: "0 0 14px", lineHeight: 1.45 }}>
                {t(lang, "bdayNamePrompt")}
              </p>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t(lang, "bdayPlaceholderName")}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); }}
                style={{
                  width: "100%", background: "#f9f9f7", border: "1px solid #eee", borderRadius: 10,
                  padding: "12px 16px", color: "#0e0e0e", fontSize: "0.95rem",
                  outline: "none", fontFamily: "inherit", boxSizing: "border-box", textAlign: "center",
                  marginBottom: 14,
                }}
              />
              <button
                onClick={handleSaveName}
                disabled={nameSaving}
                className="active:scale-[0.98] transition-transform"
                style={{
                  width: "100%", background: "#F4A623", color: "white",
                  borderRadius: 50, padding: "13px 20px", fontSize: "0.95rem", fontWeight: 700,
                  border: "none", fontFamily: "inherit", cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(244,166,35,0.3)",
                  opacity: nameSaving ? 0.6 : 1, marginBottom: 8,
                }}
              >
                {t(lang, "bdayNameContinue")}
              </button>
              <button
                onClick={onClose}
                style={{ background: "none", border: "none", color: "#aaa", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}
              >
                {t(lang, "bdayNameSkip")}
              </button>

              <style>{`@keyframes bdayDonePop { 0% { transform: scale(0.4); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }`}</style>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
