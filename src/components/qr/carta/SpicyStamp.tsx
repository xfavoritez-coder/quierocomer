"use client";

import { useState, useEffect } from "react";

/**
 * Detecta si el cliente activo el filtro "sin picante" (_spicy) en el Genio.
 * Lee del localStorage 'qr_restrictions'. Devuelve un boolean reactivo a
 * cambios via el evento custom 'genio-updated' (que dispara el modal del
 * Genio al guardar/borrar preferencias).
 */
export function useClientAvoidsSpicy(): boolean {
  const [avoids, setAvoids] = useState(false);
  useEffect(() => {
    const compute = () => {
      try {
        const raw = localStorage.getItem("qr_restrictions");
        if (!raw) { setAvoids(false); return; }
        const arr = JSON.parse(raw);
        setAvoids(Array.isArray(arr) && arr.includes("_spicy"));
      } catch {
        setAvoids(false);
      }
    };
    compute();
    window.addEventListener("genio-updated", compute);
    window.addEventListener("storage", compute);
    return () => {
      window.removeEventListener("genio-updated", compute);
      window.removeEventListener("storage", compute);
    };
  }, []);
  return avoids;
}

/**
 * Stamp circular blanco con 🌶️ que se posiciona absoluto en la esquina
 * superior izquierda de la foto del plato. Solo se muestra cuando ambos:
 * - el cliente activo "sin picante" en el Genio (avoids = true)
 * - el plato es picante (isSpicy = true)
 *
 * Pensado para ir DENTRO del contenedor relativo de la foto. Si el contenedor
 * es la foto en si (Image fill), se posiciona sobre ella.
 */
interface Props {
  isSpicy: boolean;
  size?: number;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
}

export default function SpicyStamp({ isSpicy, size = 24, top, left, right, bottom }: Props) {
  const avoids = useClientAvoidsSpicy();
  if (!avoids || !isSpicy) return null;
  // Default: top-left con offset 6 si no se pasa nada
  const t = top ?? (bottom === undefined ? 6 : undefined);
  const l = left ?? (right === undefined && top === undefined && bottom === undefined ? 6 : undefined);
  return (
    <span
      title="Picante — marcado para ti porque pediste sin picante"
      aria-label="Picante"
      style={{
        position: "absolute",
        top: t,
        left: l,
        right,
        bottom,
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.96)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.6),
        boxShadow: "0 2px 6px rgba(0,0,0,0.18), 0 0 0 1.5px rgba(239,68,68,0.4)",
        zIndex: 5,
        pointerEvents: "none",
      }}
    >
      🌶️
    </span>
  );
}
