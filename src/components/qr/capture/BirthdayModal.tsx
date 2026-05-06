"use client";

import { useState } from "react";
import { X } from "lucide-react";
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

  // Capitaliza "juan pablo" → "Juan Pablo"
  const formatName = (n: string) =>
    n.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

  const handleSubmit = async () => {
    if (status !== "idle") return;
    if (!existingUser && !email) return;
    if (!birthDate) return;
    setStatus("loading");

    if (existingUser) {
      await fetch("/api/qr/user/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthDate }),
      });
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

      if (bannerVariantId) {
        await fetch("/api/qr/banner/convert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variantId: bannerVariantId }),
        });
      }

      await res.json();
    }

    // Track BIRTHDAY_SAVED con A/B metadata
    const abMetadata = abVariant
      ? { abExperiment: abVariant.experimentSlug, titleId: abVariant.titleId, subtitleId: abVariant.subtitleId, ctaId: abVariant.ctaId }
      : undefined;
    fetch("/api/qr/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "BIRTHDAY_SAVED",
        restaurantId,
        guestId: getGuestId(),
        sessionId: getSessionId(),
        dbSessionId: getDbSessionId(),
        ...(abMetadata ? { metadata: abMetadata } : {}),
      }),
    }).catch(() => {});

    setStatus("success");
    onSuccess?.();

    // Si el usuario ya tenía nombre guardado (caso existingUser), no preguntamos.
    if (existingUser?.name) {
      onClose();
      return;
    }
    // Si es usuario nuevo o existingUser sin nombre, abrimos el step de captura de nombre
    setPhase("name");
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
              <div style={{ position: "relative", overflow: "hidden" }}>
                <label style={{ display: "block", fontSize: "0.78rem", color: "#888", marginBottom: 4, fontFamily: "inherit" }}>{t(lang, "bdayLabelDate")}</label>
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
                    {t(lang, "bdayPlaceholderDate")}
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

        {/* ── FASE 2: SUCCESS + NAME PROMPT ── */}
        {phase === "name" && (
          <div style={{ textAlign: "center" }}>
            {/* Confirmación de éxito */}
            <span style={{ fontSize: "2.6rem", display: "block", marginBottom: 8, animation: "bdayDonePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>🎉</span>
            <h3 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0e0e0e", lineHeight: 1.2, marginBottom: 4 }}>
              {t(lang, "bdayDoneTitle")}
            </h3>
            <p style={{ fontSize: "0.88rem", color: "#888", margin: "0 0 22px", lineHeight: 1.45 }}>
              {t(lang, "bdayDoneSub")}
            </p>

            {/* Separador sutil */}
            <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #eee, transparent)", margin: "0 0 20px" }} />

            {/* Prompt nombre */}
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
        )}
      </div>
    </div>
  );
}
