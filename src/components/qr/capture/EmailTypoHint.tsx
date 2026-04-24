"use client";

import { checkEmailTypo } from "@/lib/emailTypo";

interface Props {
  email: string;
  onAccept: (corrected: string) => void;
}

export default function EmailTypoHint({ email, onAccept }: Props) {
  const suggestion = checkEmailTypo(email);
  if (!suggestion) return null;

  return (
    <button
      type="button"
      onClick={() => onAccept(suggestion)}
      className="font-[family-name:var(--font-dm)]"
      style={{
        display: "block", width: "100%", textAlign: "left",
        background: "rgba(244,166,35,0.08)", border: "1px solid rgba(244,166,35,0.2)",
        borderRadius: 8, padding: "6px 12px", marginTop: 4,
        color: "#F4A623", fontSize: "0.78rem", cursor: "pointer",
      }}
    >
      ¿Quisiste decir <strong>{suggestion}</strong>?
    </button>
  );
}
