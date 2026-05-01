"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface Props {
  type: "no-results" | "redundant-vegan" | "redundant-vegetarian";
}

const MESSAGES: Record<Props["type"], string> = {
  "no-results": "Aún no hay opciones con tus preferencias en esta carta 🧞",
  "redundant-vegan": "¡Todo el menú es vegano! 🌿",
  "redundant-vegetarian": "¡Todo el menú es vegetariano! 🥗",
};

const DISMISS_KEY = "qc_diet_message_dismissed";

export default function GenioDietMessage({ type }: Props) {
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === "1");

  if (dismissed) return null;

  return (
    <div
      className="font-[family-name:var(--font-dm)]"
      style={{
        margin: "0 12px 10px",
        padding: "12px 38px 12px 14px",
        background: "#F5F4F1",
        border: "0.5px solid rgba(0,0,0,0.06)",
        borderRadius: 14,
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span style={{ fontSize: "1.3rem", flexShrink: 0, lineHeight: 1 }}>🧞</span>
      <p style={{ fontSize: "0.82rem", color: "#555", margin: 0, lineHeight: 1.4, fontWeight: 500 }}>
        {MESSAGES[type]}
      </p>
      <button
        onClick={() => { setDismissed(true); sessionStorage.setItem(DISMISS_KEY, "1"); }}
        style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", padding: 4, lineHeight: 1 }}
      >
        <X size={14} color="#bbb" />
      </button>
    </div>
  );
}
