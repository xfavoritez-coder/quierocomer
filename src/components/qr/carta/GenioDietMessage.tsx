"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { filterSupportedRestrictions } from "@/lib/qr/utils/carouselMode";

interface Props {
  type: "no-results" | "redundant-vegan" | "redundant-vegetarian" | "reordered-spicy";
  diet?: string | null;
  restrictions?: string[];
  restaurantName?: string;
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

export default function GenioDietMessage({ type, diet, restrictions, restaurantName }: Props) {
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === "1");

  if (dismissed) return null;

  // Variante "reordered-spicy": el cliente marcó solo "sin picante". La
  // mayoría de la carta no es picante, así que en lugar de "no encontramos"
  // (gris, decepcionante) mostramos un mensaje verde positivo confirmando
  // que la carta ya quedó reordenada para él.
  // SOLO se muestra cuando el flag transient qc_spicy_msg_pending está set
  // (lo setea el Genio al cerrar si tiene _spicy guardado). Se consume al
  // mount via useEffect — en cambios de vista o recargas posteriores ya no
  // aparece. Si el cliente vuelve al Genio y guarda otra vez, el flag se
  // resetea y vuelve a verse una vez.
  if (type === "reordered-spicy") {
    return <ReorderedSpicyMessage />;
  }

  let message = "";
  if (type === "redundant-vegan" || type === "redundant-vegetarian") {
    message = REDUNDANT_MESSAGES[type];
  } else {
    // no-results: construir mensaje especifico segun lo que el usuario marco.
    // Filtra restricciones legacy (mariscos, alcohol, etc) que ya no estan en Genio
    // pero pueden quedar en localStorage del usuario.
    const supported = filterSupportedRestrictions(restrictions || []);
    const prefList = buildPreferenceList(diet, supported);
    // Nombre real del local cuando lo tenemos; sino texto generico.
    const subject = restaurantName || "Este restaurante";
    if (prefList) {
      message = `${subject} todavía no tiene platos marcados como ${prefList}, pero seguro encuentras algo que te guste`;
    } else {
      message = `${subject} todavía no tiene platos marcados con tus preferencias, pero seguro encuentras algo que te guste`;
    }
  }

  return (
    <div
      id="genio-diet-message"
      className="font-[family-name:var(--font-dm)]"
      style={{
        margin: "0 12px 10px",
        padding: "12px 38px 12px 14px",
        background: "var(--carta-surface)",
        border: "0.5px solid var(--carta-card-border)",
        borderRadius: 14,
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span style={{ fontSize: "1.3rem", flexShrink: 0, lineHeight: 1 }}>🧞</span>
      <p style={{ fontSize: "0.82rem", color: "var(--carta-text2)", margin: 0, lineHeight: 1.4, fontWeight: 500 }}>
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

/**
 * Banner verde 'Reordenamos la carta para ti...'. Aparece en cada visita
 * fresca de la carta cuando el cliente tiene activa solo la restriccion
 * '_spicy' (no picante). El cliente puede cerrarlo y no se le repite en
 * la misma sesion; vuelve a aparecer en la proxima visita.
 *
 * Antes solo se mostraba justo despues de cerrar el Genio (via flag
 * transient qc_spicy_msg_pending), por lo que clientes recurrentes con
 * restriccion ya guardada nunca veian la confirmacion.
 */
function ReorderedSpicyMessage() {
  const [show, setShow] = useState(false);
  const [closed, setClosed] = useState(false);
  // Diferenciamos texto: "Listo. Reordenamos..." cuando el cliente viene de
  // cerrar el Genio (accion reciente), vs texto pasivo cuando es una visita
  // recurrente con la restriccion ya guardada (no hay accion reciente que
  // celebrar — solo recordamos).
  const [fromGenio, setFromGenio] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = sessionStorage.getItem("qc_spicy_msg_dismissed") === "1";
    const pending = sessionStorage.getItem("qc_spicy_msg_pending") === "1";
    if (pending) {
      setFromGenio(true);
      sessionStorage.removeItem("qc_spicy_msg_pending");
    }
    if (!dismissed) setShow(true);
  }, []);

  const handleClose = () => {
    setClosed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("qc_spicy_msg_dismissed", "1");
    }
  };

  if (!show || closed) return null;
  return (
    <div
      className="font-[family-name:var(--font-dm)]"
      style={{
        margin: "0 12px 10px",
        padding: "12px 38px 12px 14px",
        background: "var(--carta-surface)",
        border: "1px solid var(--carta-card-border)",
        borderRadius: 14,
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span style={{ fontSize: "1.3rem", flexShrink: 0, lineHeight: 1 }}>✅</span>
      <p style={{ fontSize: "0.82rem", color: "var(--carta-text2)", margin: 0, lineHeight: 1.4, fontWeight: 500 }}>
        {fromGenio
          ? "Listo. Reordenamos la carta para ti dejando lo picante al final, y marcamos cada plato picante con 🌶️ en su foto para que no te confundas."
          : "Esta carta está reordenada para ti: los platos picantes quedan al final y los marcamos con 🌶️ en su foto."}
      </p>
      <button
        onClick={handleClose}
        style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", padding: 4, lineHeight: 1 }}
      >
        <X size={14} color="var(--carta-text3)" />
      </button>
    </div>
  );
}
