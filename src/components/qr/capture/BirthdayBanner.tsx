"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import BirthdayModal from "./BirthdayModal";
import { getGuestId, getSessionId } from "@/lib/guestId";
import { getDbSessionId } from "@/lib/sessionTracker";
import { useLang } from "@/contexts/LangContext";
import { t } from "@/lib/qr/i18n";

interface Props {
  restaurantId: string;
  restaurantName?: string;
}

export default function BirthdayBanner({ restaurantId, restaurantName }: Props) {
  const lang = useLang();
  const [variant, setVariant] = useState<{ id: string; text: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "success">("idle");
  const [show, setShow] = useState(false);
  const [existingUser, setExistingUser] = useState<{ name: string | null; email: string } | null>(null);
  const [autoModal, setAutoModal] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("qr_birthday_dismissed")) return;

    // Track visit count per restaurant
    const visitKey = `qc_visit_count_${restaurantId}`;
    const visits = parseInt(localStorage.getItem(visitKey) || "0") + 1;
    localStorage.setItem(visitKey, String(visits));
    const isSecondVisit = visits === 2;
    const alreadyShowedModal = localStorage.getItem(`qc_bday_modal_shown_${restaurantId}`) === "1";

    fetch("/api/qr/user/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          if (!d.user.birthDate) {
            setExistingUser({ name: d.user.name, email: d.user.email });
            // Second visit + never showed modal → auto-open modal
            if (isSecondVisit && !alreadyShowedModal) {
              setAutoModal(true);
              setModalOpen(true);
              localStorage.setItem(`qc_bday_modal_shown_${restaurantId}`, "1");
              fetch("/api/qr/stats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventType: "BIRTHDAY_MODAL_AUTO_SHOWN", restaurantId, guestId: getGuestId(), sessionId: getSessionId(), dbSessionId: getDbSessionId() }) }).catch(() => {});
            }
            setShow(true);
          }
          return;
        }
        // Not logged in
        fetch("/api/qr/banner/select")
          .then((r) => r.json())
          .then((d) => {
            if (d.variant) {
              setVariant(d.variant);
              // Second visit + never showed modal → auto-open modal
              if (isSecondVisit && !alreadyShowedModal) {
                setAutoModal(true);
                setModalOpen(true);
                localStorage.setItem(`qc_bday_modal_shown_${restaurantId}`, "1");
                fetch("/api/qr/stats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventType: "BIRTHDAY_MODAL_AUTO_SHOWN", restaurantId, guestId: getGuestId(), sessionId: getSessionId(), dbSessionId: getDbSessionId() }) }).catch(() => {});
              }
              setShow(true);
            }
          });
      })
      .catch(() => {});
  }, [restaurantId]);

  if (!show || dismissed) return null;

  if (status === "success") {
    return (
      <div
        className="font-[family-name:var(--font-dm)]"
        style={{
          margin: "8px 20px 20px",
          padding: "18px 20px",
          background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
          border: "1px solid rgba(244,166,35,0.22)",
          borderRadius: 14,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "1.2rem", display: "flex", justifyContent: "center", gap: 4, marginBottom: 8 }}>
          <span style={{ animation: "bdayBounce 1.5s ease-in-out infinite" }}>🎊</span>
          <span style={{ animation: "bdayBounce 1.5s ease-in-out 0.2s infinite" }}>🎉</span>
          <span style={{ animation: "bdayBounce 1.5s ease-in-out 0.4s infinite" }}>🎊</span>
        </div>
        <p style={{ color: "#92400e", fontSize: "0.92rem", fontWeight: 700, margin: "0 0 4px" }}>
          {t(lang, "bdaySuccessTitle")}
        </p>
        <p style={{ color: "#b45309", fontSize: "0.78rem", margin: 0, opacity: 0.8 }}>
          {t(lang, "bdaySuccessSub")}
        </p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes bdaySlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bdayShimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes bdayBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
      <button
        onClick={() => {
          setModalOpen(true);
          fetch("/api/qr/stats", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventType: "BIRTHDAY_BANNER_CLICKED", restaurantId, guestId: getGuestId(), sessionId: getSessionId(), dbSessionId: getDbSessionId() }),
          }).catch(() => {});
        }}
        className="font-[family-name:var(--font-dm)] active:scale-[0.97] active:brightness-95 transition-all duration-100"
        style={{
          margin: "28px 20px 20px",
          padding: "16px 18px",
          width: "calc(100% - 40px)",
          background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fffbeb 100%)",
          backgroundSize: "200% 100%",
          animation: "bdaySlideIn 0.5s ease-out, bdayShimmer 8s ease-in-out 1s infinite",
          border: "1px solid rgba(244,166,35,0.22)",
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          gap: 12,
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(180,130,40,0.1), inset 0 1px 0 rgba(255,255,255,0.6)",
          textAlign: "left",
        }}
      >
        {/* Emoji */}
        <span style={{ fontSize: "1.6rem", flexShrink: 0, animation: "bdayBounce 2s ease-in-out infinite" }}>🎂</span>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "0.98rem", fontWeight: 700, color: "#92400e", lineHeight: 1.3, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {existingUser?.name ? t(lang, "bdayQuestionName").replace("{name}", existingUser.name) : t(lang, "bdayQuestion")}
          </p>
          <p style={{ fontSize: "0.97rem", color: "#b45309", lineHeight: 1.3, margin: "2px 0 0", opacity: 0.8 }}>
            {existingUser ? t(lang, "bdayHintExisting") : t(lang, "bdayHintNew")}
          </p>
        </div>

        {/* Arrow hint */}
        <span style={{ fontSize: "1.4rem", color: "#b45309", opacity: 0.35, flexShrink: 0, fontWeight: 300 }}>›</span>
      </button>

      {modalOpen && (
        <BirthdayModal
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          existingUser={existingUser}
          bannerVariantId={variant?.id}
          onClose={() => setModalOpen(false)}
          onSuccess={() => { setStatus("success"); sessionStorage.setItem("qr_birthday_dismissed", "1"); }}
        />
      )}
    </>
  );
}
