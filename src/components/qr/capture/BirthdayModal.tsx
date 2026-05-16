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
  /** Beneficio que el local le regala al cliente en su cumple. Si esta vacio,
   * el modal no muestra texto de regalo (solo titulo + form). */
  birthdayPerk?: string | null;
  /** If user is already logged in, pass their data to update instead of register */
  existingUser?: { name: string | null; email: string } | null;
  bannerVariantId?: string;
  /** Active multi-armed bandit variant — overrides default i18n copy. */
  abVariant?: AbVariant | null;
  onClose: () => void;
  onSuccess?: () => void;
  /** Llamado cuando el usuario guardo su nombre en el step post-cumple. Permite
   * al padre mostrar un toast personalizado con el nombre. */
  onNameSaved?: (name: string) => void;
}

type Phase = "form" | "done";

export default function BirthdayModal({ restaurantId, restaurantName, birthdayPerk, existingUser, bannerVariantId, abVariant, onClose, onSuccess, onNameSaved }: Props) {
  const lang = useLang();
  // Form state
  const [email, setEmail] = useState(existingUser?.email || "");
  const [userName, setUserName] = useState(existingUser?.name || "");
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

  // Detect promo-style variant (no birthday icon, different vibe)
  const isPromoVariant = abVariant?.titleText?.includes("descuentos");

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

    const trimmedName = userName.trim();
    const formattedName = trimmedName ? formatName(trimmedName) : null;

    let persisted = false;
    let errorMsg: string | null = null;

    if (existingUser) {
      const res = await fetch("/api/qr/user/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthDate, ...(formattedName && !existingUser.name ? { name: formattedName } : {}) }),
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
          name: formattedName,
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

    // Name was captured in the form itself — notify parent and show done
    if (formattedName) {
      onNameSaved?.(formattedName);
      // Track name capture
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
    }

    setPhase("done");
    setTimeout(() => onClose(), 2200);
  };


  return (
    <div
      className="fixed inset-0 flex items-center justify-center font-[family-name:var(--font-dm)]"
      style={{ zIndex: 200, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", minHeight: "100dvh" }}
      onClick={(e) => { if (e.target === e.currentTarget && phase === "form") handleDismiss(); }}
    >
      <style>{`.bday-input::placeholder { color: var(--carta-text3, #999) !important; opacity: 1; }`}</style>
      <div
        style={{
          background: "var(--carta-detail-bg, white)",
          borderRadius: 20,
          padding: "32px 24px 28px",
          maxWidth: 360,
          width: "90%",
          maxHeight: "90dvh",
          overflowY: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
          position: "relative",
          border: "1px solid var(--carta-card-border, transparent)",
        }}
      >
        <button
          onClick={handleDismiss}
          style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer" }}
        >
          <X size={18} color="var(--carta-text3, #ccc)" />
        </button>

        {/* ── FASE 1: FORM ── */}
        {phase === "form" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <span style={{ fontSize: "2.8rem", display: "block", marginBottom: 10 }}>{isPromoVariant ? "🎁" : "🎂"}</span>
              <h3
                className="font-[family-name:var(--font-playfair)]"
                style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--carta-text, #0e0e0e)", lineHeight: 1.2 }}
              >
                {abVariant?.titleText
                  || (restaurantName ? t(lang, "bdayModalTitleRestaurant").replace("{name}", restaurantName) : t(lang, "bdayModalTitle"))}
              </h3>
              {abVariant?.subtitleText && (
                <p style={{ fontSize: "0.85rem", color: "var(--carta-text-muted, #666)", marginTop: 8, lineHeight: 1.4 }}>
                  {abVariant.subtitleText}
                </p>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {!existingUser && (
                <>
                  <input
                    className="bday-input"
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder={t(lang, "bdayPlaceholderName")}
                    style={{
                      width: "100%", background: "var(--carta-search-bg, #f9f9f7)", border: "1px solid var(--carta-card-border, #eee)", borderRadius: 10,
                      padding: "12px 16px", color: "var(--carta-text, #0e0e0e)", fontSize: "0.92rem",
                      outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                    }}
                  />
                  <input
                    className="bday-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t(lang, "bdayPlaceholderEmail")}
                    style={{
                      width: "100%", background: "var(--carta-search-bg, #f9f9f7)", border: "1px solid var(--carta-card-border, #eee)", borderRadius: 10,
                      padding: "12px 16px", color: "var(--carta-text, #0e0e0e)", fontSize: "0.92rem",
                      outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                    }}
                  />
                  <EmailTypoHint email={email} onAccept={setEmail} />
                </>
              )}
              {existingUser && !existingUser.name && (
                <input
                  className="bday-input"
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder={t(lang, "bdayPlaceholderName")}
                  style={{
                    width: "100%", background: "var(--carta-search-bg, #f9f9f7)", border: "1px solid var(--carta-card-border, #eee)", borderRadius: 10,
                    padding: "12px 16px", color: "var(--carta-text, #0e0e0e)", fontSize: "0.92rem",
                    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                  }}
                />
              )}
              <div style={{ position: "relative" }}>
                <div style={{ position: "relative" }}>
                  <input
                    className="bday-input"
                    type="text"
                    inputMode="numeric"
                    placeholder={t(lang, "bdayPlaceholderDate")}
                    value={birthDateText}
                    onChange={(e) => handleDateTextChange(e.target.value)}
                    maxLength={10}
                    style={{
                      width: "100%", background: "var(--carta-search-bg, #f9f9f7)", border: "1px solid var(--carta-card-border, #eee)", borderRadius: 10,
                      padding: "12px 44px 12px 16px", color: "var(--carta-text, #0e0e0e)", fontSize: "0.92rem",
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
                      color: "var(--carta-text3, #888)",
                    }}
                  >
                    <Calendar size={18} />
                  </button>
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
                  width: "100%", marginTop: 4, background: "var(--carta-accent, #F4A623)", color: "white",
                  borderRadius: 50, padding: "13px 20px", fontSize: "0.95rem", fontWeight: 700,
                  border: "none", fontFamily: "inherit", cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(244,166,35,0.3)",
                  opacity: status === "loading" ? 0.6 : 1,
                }}
              >
                {status === "loading" ? t(lang, "bdaySaving") : (abVariant?.ctaText || t(lang, "bdayButton"))}
              </button>
            </div>

          </>
        )}

        {/* ── FASE 2: DONE ── */}
        {phase === "done" && (() => {
          const firstName = userName.trim() ? formatName(userName.trim()).split(" ")[0] : (existingUser?.name?.split(" ")[0] || null);
          const isReturning = !!existingUser?.name;
          const title = firstName ? `¡Listo, ${firstName}! 🎉` : (isReturning ? "¡Bienvenido de vuelta! 🎉" : t(lang, "bdayDoneTitle"));
          return (
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: "2.6rem", display: "block", marginBottom: 8, animation: "bdayDonePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>🎉</span>
              <h3 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--carta-text, #0e0e0e)", lineHeight: 1.2, marginBottom: 8 }}>
                {title}
              </h3>
              <p style={{ fontSize: "0.92rem", color: "#666", margin: "0 0 18px", lineHeight: 1.5 }}>
                {t(lang, "bdayDoneSub")}
              </p>
              <style>{`@keyframes bdayDonePop { 0% { transform: scale(0.4); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }`}</style>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
