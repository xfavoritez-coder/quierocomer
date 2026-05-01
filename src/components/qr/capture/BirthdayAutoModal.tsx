"use client";

import { useState, useEffect } from "react";
import BirthdayModal from "./BirthdayModal";
import { getGuestId, getSessionId } from "@/lib/guestId";
import { getDbSessionId } from "@/lib/sessionTracker";
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
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("qr_birthday_dismissed")) return;
    if (sessionStorage.getItem("qc_bday_auto_checked")) return;
    sessionStorage.setItem("qc_bday_auto_checked", "1");

    const visitKey = `qc_visit_count_${restaurantId}`;
    const localVisits = parseInt(localStorage.getItem(visitKey) || "0") + 1;
    localStorage.setItem(visitKey, String(localVisits));

    const alreadyShowedModal = localStorage.getItem(`qc_bday_modal_shown_${restaurantId}`) === "1";
    if (alreadyShowedModal) return;

    const guestId = getGuestId();

    // Server-side visit check (per-guest, survives localStorage clears / different browsers)
    // restaurantSessions is the count BEFORE this visit's session-start fires,
    // so >= 1 means at least one prior session → this is at least the 2nd visit.
    fetch(`/api/qr/guest/visit-info?guestId=${encodeURIComponent(guestId)}&restaurantId=${encodeURIComponent(restaurantId)}`)
      .then((r) => r.json())
      .then((info) => {
        const serverPriorSessions = info.restaurantSessions || 0;
        const isSecondVisit = localVisits >= 2 || serverPriorSessions >= 1;
        if (!isSecondVisit) return;

        // Check if user needs birthday
        fetch("/api/qr/user/me")
          .then((r) => r.json())
          .then((d) => {
            if (d.user) {
              if (!d.user.birthDate) {
                setExistingUser({ name: d.user.name, email: d.user.email });
                setModalOpen(true);
                localStorage.setItem(`qc_bday_modal_shown_${restaurantId}`, "1");
                fetch("/api/qr/stats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventType: "BIRTHDAY_MODAL_AUTO_SHOWN" as any, restaurantId, guestId, sessionId: getSessionId(), dbSessionId: getDbSessionId() }) }).catch(() => {});
              }
              return;
            }
            // Not logged in — use banner variant
            fetch("/api/qr/banner/select")
              .then((r) => r.json())
              .then((d) => {
                if (d.variant) {
                  setVariant(d.variant);
                  setModalOpen(true);
                  localStorage.setItem(`qc_bday_modal_shown_${restaurantId}`, "1");
                  fetch("/api/qr/stats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventType: "BIRTHDAY_MODAL_AUTO_SHOWN" as any, restaurantId, guestId, sessionId: getSessionId(), dbSessionId: getDbSessionId() }) }).catch(() => {});
                }
              });
          })
          .catch(() => {});
      })
      .catch(() => {});
  }, [restaurantId]);

  return (
    <>
      {modalOpen && (
        <BirthdayModal
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          existingUser={existingUser}
          bannerVariantId={variant?.id}
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
            background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
            border: "1px solid rgba(244,166,35,0.35)",
            borderRadius: 14,
            padding: "14px 18px",
            maxWidth: "calc(100vw - 32px)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
            animation: "bdayToastIn 0.32s ease-out",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: "1.4rem", lineHeight: 1 }}>🎉</span>
          <div>
            <p style={{ margin: 0, fontSize: "0.92rem", fontWeight: 700, color: "#92400e" }}>{t(lang, "bdaySuccessTitle")}</p>
            <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#b45309", opacity: 0.85 }}>{t(lang, "bdaySuccessSub")}</p>
          </div>
          <style>{`@keyframes bdayToastIn { from { opacity: 0; transform: translate(-50%, 12px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
        </div>
      )}
    </>
  );
}
