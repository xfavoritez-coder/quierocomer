"use client";

import { useState, useEffect } from "react";
import BirthdayModal from "./BirthdayModal";
import { getGuestId, getSessionId } from "@/lib/guestId";
import { getDbSessionId } from "@/lib/sessionTracker";

interface Props {
  restaurantId: string;
  restaurantName?: string;
}

/**
 * Auto-shows the birthday modal on the 2nd visit if user hasn't saved birthday yet.
 * Mounted at top level of carta — doesn't depend on scroll position.
 */
export default function BirthdayAutoModal({ restaurantId, restaurantName }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [existingUser, setExistingUser] = useState<{ name: string | null; email: string } | null>(null);
  const [variant, setVariant] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem("qr_birthday_dismissed")) return;

    const visitKey = `qc_visit_count_${restaurantId}`;
    const visits = parseInt(localStorage.getItem(visitKey) || "0");
    // visits already incremented by BirthdayBanner, so check >= 2
    const isSecondVisit = visits >= 2;
    const alreadyShowedModal = localStorage.getItem(`qc_bday_modal_shown_${restaurantId}`) === "1";

    if (!isSecondVisit || alreadyShowedModal) return;

    // Check if user needs birthday
    fetch("/api/qr/user/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          if (!d.user.birthDate) {
            setExistingUser({ name: d.user.name, email: d.user.email });
            setModalOpen(true);
            localStorage.setItem(`qc_bday_modal_shown_${restaurantId}`, "1");
            fetch("/api/qr/stats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventType: "BIRTHDAY_MODAL_AUTO_SHOWN" as any, restaurantId, guestId: getGuestId(), sessionId: getSessionId(), dbSessionId: getDbSessionId() }) }).catch(() => {});
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
              fetch("/api/qr/stats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventType: "BIRTHDAY_MODAL_AUTO_SHOWN" as any, restaurantId, guestId: getGuestId(), sessionId: getSessionId(), dbSessionId: getDbSessionId() }) }).catch(() => {});
            }
          });
      })
      .catch(() => {});
  }, [restaurantId]);

  if (!modalOpen) return null;

  return (
    <BirthdayModal
      restaurantId={restaurantId}
      restaurantName={restaurantName}
      existingUser={existingUser}
      bannerVariantId={variant?.id}
      onClose={() => { setModalOpen(false); sessionStorage.setItem("qr_birthday_dismissed", "1"); }}
      onSuccess={() => sessionStorage.setItem("qr_birthday_dismissed", "1")}
    />
  );
}
