"use client";

import { useState, useEffect } from "react";
import BirthdayModal, { type AbVariant } from "./BirthdayModal";
import { getGuestId, getSessionId } from "@/lib/guestId";
import { getDbSessionId, ensureDbSessionAsync } from "@/lib/sessionTracker";
import { useLang } from "@/contexts/LangContext";
import { t } from "@/lib/qr/i18n";

interface Props {
  restaurantId: string;
  restaurantName?: string;
}

/**
 * Auto-shows the birthday modal on the 2nd visit if user hasn't saved birthday yet.
 * Mounted at top level of carta — doesn't depend on scroll position.
 * Owns the visit counter (increments on mount, checks >= 2).
 */
export default function BirthdayAutoModal({ restaurantId, restaurantName }: Props) {
  const lang = useLang();
  const [modalOpen, setModalOpen] = useState(false);
  const [existingUser, setExistingUser] = useState<{ name: string | null; email: string } | null>(null);
  const [variant, setVariant] = useState<{ id: string; text: string } | null>(null);
  const [abVariant, setAbVariant] = useState<AbVariant | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("qr_birthday_dismissed")) return;
    if (sessionStorage.getItem("qc_bday_auto_checked")) return;
    sessionStorage.setItem("qc_bday_auto_checked", "1");

    const alreadyShowedModal = localStorage.getItem(`qc_bday_modal_shown_${restaurantId}`) === "1";
    if (alreadyShowedModal) return;

    const guestId = getGuestId();

    // Track BIRTHDAY_MODAL_AUTO_SHOWN con un dbSessionId ya resuelto y la
    // variante A/B servida — esto le permite al bandit atribuir cada
    // impresión al título/subtítulo/CTA exactos que se mostraron.
    const trackAutoShown = async (dbSessionId: string | null, ab: AbVariant | null) => {
      const metadata = ab
        ? { abExperiment: ab.experimentSlug, titleId: ab.titleId, subtitleId: ab.subtitleId, ctaId: ab.ctaId }
        : undefined;
      try {
        await fetch("/api/qr/stats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType: "BIRTHDAY_MODAL_AUTO_SHOWN" as any,
            restaurantId,
            guestId,
            sessionId: getSessionId(),
            dbSessionId,
            ...(metadata ? { metadata } : {}),
          }),
          keepalive: true,
        });
      } catch {}
    };

    // Resolvemos primero el dbSessionId del cliente actual. Lo pasamos al
    // endpoint para que NO cuente la sesión actual como una visita previa
    // (importante cuando el cliente cierra la pestaña y vuelve a abrir
    // dentro del SESSION_REUSE_WINDOW de 2 min: la sesión persistida queda
    // en DB y el conteo crudo la trataría como "1 visita previa" — falso).
    (async () => {
      const dbSessionId = (await ensureDbSessionAsync(3000)) || getDbSessionId();
      const params = new URLSearchParams({ guestId, restaurantId });
      if (dbSessionId) params.set("excludeSessionId", dbSessionId);

      try {
        const info = await fetch(`/api/qr/guest/visit-info?${params}`).then((r) => r.json());
        const serverPriorSessions = info.restaurantSessions || 0;
        // El modal sólo se muestra si hay al menos una sesión real previa.
        // Confiar sólo en el server (no en localStorage) elimina los falsos
        // positivos por refreshes que incrementaban un contador local.
        if (serverPriorSessions < 1) return;

        // Resolver la variante A/B en paralelo. Si falla o no hay
        // experimento configurado, el modal cae a los textos por defecto.
        const ab: AbVariant | null = await fetch("/api/qr/ab/birthday-modal")
          .then((r) => r.json())
          .then((d) => d?.hasVariants ? d : null)
          .catch(() => null);
        if (ab) setAbVariant(ab);

        // Verificar si el usuario ya tiene cumple guardado
        const me = await fetch("/api/qr/user/me").then((r) => r.json());
        if (me.user) {
          if (!me.user.birthDate) {
            setExistingUser({ name: me.user.name, email: me.user.email });
            setModalOpen(true);
            localStorage.setItem(`qc_bday_modal_shown_${restaurantId}`, "1");
            trackAutoShown(dbSessionId, ab);
          }
          return;
        }
        // Sin login — usar variante de banner
        const banner = await fetch("/api/qr/banner/select").then((r) => r.json());
        if (banner.variant) {
          setVariant(banner.variant);
          setModalOpen(true);
          localStorage.setItem(`qc_bday_modal_shown_${restaurantId}`, "1");
          trackAutoShown(dbSessionId, ab);
        }
      } catch {}
    })();
  }, [restaurantId]);

  return (
    <>
      {modalOpen && (
        <BirthdayModal
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          existingUser={existingUser}
          bannerVariantId={variant?.id}
          abVariant={abVariant}
          onClose={() => { setModalOpen(false); sessionStorage.setItem("qr_birthday_dismissed", "1"); }}
          onSuccess={() => {
            sessionStorage.setItem("qr_birthday_dismissed", "1");
            setShowSuccessToast(true);
            // Notify any other birthday components (inline banner) to hide themselves
            window.dispatchEvent(new CustomEvent("qc:birthday-saved"));
            setTimeout(() => setShowSuccessToast(false), 4500);
          }}
        />
      )}
      {showSuccessToast && (
        <div
          aria-live="polite"
          className="font-[family-name:var(--font-dm)]"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 250,
            background: "linear-gradient(135deg, #FFF8E5 0%, #FDE6BD 100%)",
            border: "1px solid rgba(244,166,35,0.4)",
            borderRadius: 18,
            padding: "16px 22px 16px 18px",
            maxWidth: "calc(100vw - 32px)",
            boxShadow: "0 14px 38px rgba(244,166,35,0.25), 0 4px 14px rgba(0,0,0,0.08)",
            animation: "bdayToastIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span style={{ fontSize: "2rem", lineHeight: 1, animation: "bdayToastBounce 0.9s ease-in-out infinite alternate", flexShrink: 0 }}>🎂</span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "0.98rem", fontWeight: 700, color: "#7B3F00", lineHeight: 1.2 }}>{t(lang, "bdaySuccessTitle")}</p>
            <p style={{ margin: "3px 0 0", fontSize: "0.82rem", color: "#9A5510", lineHeight: 1.35 }}>{t(lang, "bdaySuccessSub")}</p>
          </div>
          <style>{`
            @keyframes bdayToastIn { from { opacity: 0; transform: translate(-50%, 18px) scale(0.92); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }
            @keyframes bdayToastBounce { from { transform: translateY(0) rotate(-4deg); } to { transform: translateY(-3px) rotate(4deg); } }
          `}</style>
        </div>
      )}
    </>
  );
}
