"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import BirthdayModal from "./BirthdayModal";

interface Props {
  restaurantId: string;
}

export default function BirthdayBanner({ restaurantId }: Props) {
  const [variant, setVariant] = useState<{ id: string; text: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "success">("idle");
  const [show, setShow] = useState(false);
  const [existingUser, setExistingUser] = useState<{ name: string | null; email: string } | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem("qr_birthday_dismissed")) return;

    fetch("/api/qr/user/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          // Logged in — show only if no birthday saved
          if (!d.user.birthDate) {
            setExistingUser({ name: d.user.name, email: d.user.email });
            setShow(true);
          }
          return;
        }
        // Not logged in — show banner with variant
        fetch("/api/qr/banner/select")
          .then((r) => r.json())
          .then((d) => {
            if (d.variant) {
              setVariant(d.variant);
              setShow(true);
            }
          });
      })
      .catch(() => {});
  }, []);

  if (!show || dismissed) return null;

  if (status === "success") {
    return (
      <div
        className="font-[family-name:var(--font-dm)]"
        style={{
          margin: "8px 20px 20px",
          padding: "14px 18px",
          background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
          border: "1px solid rgba(22,163,74,0.15)",
          borderRadius: 14,
          textAlign: "center",
        }}
      >
        <span style={{ color: "#16a34a", fontSize: "0.88rem", fontWeight: 600 }}>
          ¡Listo! Guardamos tu cumpleaños 🎂
        </span>
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
        @keyframes bdayPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(244,166,35,0.3); }
          50% { box-shadow: 0 0 0 6px rgba(244,166,35,0); }
        }
      `}</style>
      <div
        className="font-[family-name:var(--font-dm)]"
        style={{
          margin: "28px 20px 4px",
          padding: "16px 18px",
          background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fffbeb 100%)",
          backgroundSize: "200% 100%",
          animation: "bdaySlideIn 0.5s ease-out, bdayShimmer 8s ease-in-out 1s infinite",
          border: "1px solid rgba(244,166,35,0.18)",
          borderRadius: 14,
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* Emoji */}
        <span style={{ fontSize: "1.6rem", flexShrink: 0, animation: "bdayBounce 2s ease-in-out infinite" }}>🎂</span>

        {/* Text — always 2 lines: title + subtitle */}
        <div style={{ flex: 1, minWidth: 0, paddingRight: 60 }}>
          <p style={{ fontSize: "0.92rem", fontWeight: 700, color: "#92400e", lineHeight: 1.3, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {existingUser?.name ? `${existingUser.name}, ¿cuándo es tu cumple?` : "¿Cuándo es tu cumple?"}
          </p>
          <p style={{ fontSize: "0.85rem", color: "#b45309", lineHeight: 1.3, margin: "2px 0 0", opacity: 0.8 }}>
            {existingUser ? "Guárdalo y recibe una sorpresa 🎁" : "Regístrate y recibe una sorpresa 🎁"}
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={() => setModalOpen(true)}
          className="active:scale-95 transition-transform"
          style={{
            position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
            flexShrink: 0, background: "#F4A623", color: "white", border: "none",
            borderRadius: 50, padding: "8px 14px", fontSize: "0.82rem", fontWeight: 700,
            fontFamily: "inherit", cursor: "pointer",
            animation: "bdayPulse 2.5s ease-in-out infinite",
          }}
        >
          Me apunto
        </button>
      </div>

      {modalOpen && (
        <BirthdayModal
          restaurantId={restaurantId}
          existingUser={existingUser}
          bannerVariantId={variant?.id}
          onClose={() => setModalOpen(false)}
          onSuccess={() => setStatus("success")}
        />
      )}
    </>
  );
}
