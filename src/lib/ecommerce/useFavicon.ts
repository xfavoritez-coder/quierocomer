"use client";
import { useEffect } from "react";

/**
 * Fija el favicon de la pestaña a `url` mientras el componente está montado.
 * Muta el <link rel="icon"> existente (evita pelear con el del layout raíz) y
 * restaura el original al desmontar.
 */
export function useFavicon(url: string | null | undefined) {
  useEffect(() => {
    if (!url || typeof document === "undefined") return;
    let link = document.querySelector('link[rel~="icon"]') as HTMLLinkElement | null;
    const created = !link;
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "icon");
      document.head.appendChild(link);
    }
    const prevHref = link.getAttribute("href");
    const prevType = link.getAttribute("type");
    link.setAttribute("href", url);
    link.removeAttribute("type"); // el navegador infiere el tipo del logo
    return () => {
      if (created) link!.remove();
      else {
        if (prevHref) link!.setAttribute("href", prevHref);
        if (prevType) link!.setAttribute("type", prevType);
      }
    };
  }, [url]);
}
