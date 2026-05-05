"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface Props {
  type: "no-results" | "redundant-vegan" | "redundant-vegetarian";
  diet?: string | null;
  restrictions?: string[];
}

const REDUNDANT_MESSAGES: Record<"redundant-vegan" | "redundant-vegetarian", string> = {
  "redundant-vegan": "¡Todo el menú es vegano! 🌿",
  "redundant-vegetarian": "¡Todo el menú es vegetariano! 🥗",
};

const RESTRICTION_LABELS: Record<string, string> = {
  gluten: "sin gluten",
  lactosa: "sin lactosa",
  soja: "sin soya",
  soya: "sin soya",
  "frutos secos": "sin frutos secos",
  _spicy: "sin picante",
};
const DIET_LABELS: Record<string, string> = { vegan: "veganos", vegetarian: "vegetarianos" };

const NUT_ALIASES = ["maní", "mani", "nueces", "almendras", "nuez", "almendra"];

function buildPreferenceList(diet?: string | null, restrictions: string[] = []): string {
  const parts: string[] = [];
  if (diet === "vegan") parts.push("veganos");
  else if (diet === "vegetarian") parts.push("vegetarianos");
  // Colapsa nuts legacy en "sin frutos secos"
  let nutsAdded = false;
  for (const r of restrictions) {
    if (r === "ninguna") continue;
    if (NUT_ALIASES.includes(r) || r === "frutos secos") {
      if (!nutsAdded) { parts.push("sin frutos secos"); nutsAdded = true; }
      continue;
    }
    if (r === "_spicy") { parts.push("sin picante"); continue; }
    parts.push(RESTRICTION_LABELS[r] || `sin ${r}`);
  }
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} y ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} y ${parts.slice(-1)}`;
}

const DISMISS_KEY = "qc_diet_message_dismissed";

export default function GenioDietMessage({ type, diet, restrictions }: Props) {
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === "1");

  if (dismissed) return null;

  let message = "";
  if (type === "redundant-vegan" || type === "redundant-vegetarian") {
    message = REDUNDANT_MESSAGES[type];
  } else {
    // no-results: construir mensaje especifico segun lo que el usuario marco
    const prefList = buildPreferenceList(diet, (restrictions || []).filter(r => r !== "ninguna"));
    if (prefList) {
      message = `Este local todavía no tiene platos marcados como ${prefList}, pero seguro encuentras algo que te guste`;
    } else {
      message = "Este local todavía no tiene platos marcados con tus preferencias, pero seguro encuentras algo que te guste";
    }
  }

  return (
    <div
      id="genio-diet-message"
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
        {message}
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
