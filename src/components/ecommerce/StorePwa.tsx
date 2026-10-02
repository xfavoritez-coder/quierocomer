"use client";
import { useEffect } from "react";

/** Registra el service worker de la tienda para habilitar la PWA instalable y las
 *  notificaciones push. Solo en dominio propio (scope "/"), que es el caso de uso
 *  real de "app del local"; en el dominio principal la tienda sigue como web. */
export default function StorePwa({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw-store.js").catch(() => {});
  }, [enabled]);
  return null;
}
