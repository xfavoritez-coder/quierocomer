"use client";
import { useEffect } from "react";

/**
 * Fija el favicon de la pestaña a `url` mientras el componente está montado.
 * Quita cualquier <link rel="icon"> existente (incluido el /logo.png del layout
 * raíz, que si no el navegador prefiere) y deja UN solo icono con la url dada.
 * Al desmontar restaura los originales.
 */
export function useFavicon(url: string | null | undefined) {
  useEffect(() => {
    if (!url || typeof document === "undefined") return;

    // Guarda y remueve los iconos existentes (evita que el navegador use /logo.png).
    const existing = Array.from(
      document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'),
    ) as HTMLLinkElement[];
    existing.forEach((l) => l.remove());

    // Icono gestionado por el hook.
    const link = document.createElement("link");
    link.setAttribute("rel", "icon");
    link.setAttribute("href", url);
    document.head.appendChild(link);

    return () => {
      link.remove();
      existing.forEach((l) => document.head.appendChild(l)); // restaura los originales
    };
  }, [url]);
}
