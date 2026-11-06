"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isInApp } from "@/lib/ecommerce/isInApp";

/**
 * Mantiene la cookie `qc_app` en sincronía con si el storefront corre dentro de
 * la app nativa (WebView de Capacitor). El servidor lee esa cookie para decidir
 * si muestra los platos marcados como appOnly (exclusivos de la app).
 *
 * - Dentro de la app y la cookie aún no está → la setea y refresca una vez, para
 *   que la página vuelva a renderizar incluyendo los platos exclusivos.
 * - En la web normal con la cookie puesta (caso raro) → la limpia y refresca, así
 *   nunca se filtran productos solo-app a un navegador web.
 *
 * `active` = lo que el servidor creyó en este render (cookie presente). Al cambiar
 * la cookie y refrescar, `active` se actualiza y el efecto deja de dispararse.
 */
export default function AppFlagSync({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    const inApp = isInApp();
    if (inApp === active) return; // ya está sincronizado
    try {
      document.cookie = inApp
        ? "qc_app=1; path=/; max-age=31536000; SameSite=Lax; Secure"
        : "qc_app=; path=/; max-age=0; SameSite=Lax; Secure";
    } catch { return; }
    // IMPORTANTE: NO refrescar durante la hidratación. En el primer arranque de la
    // app nativa (cookie aún ausente) un router.refresh() inmediato interrumpía el
    // montaje y dejaba los botones sin responder hasta reabrir la app (el scroll
    // nativo seguía). Diferimos el refresh hasta que la página esté cargada e idle,
    // ya con la interacción enganchada; ahí el refresh es una revalidación normal.
    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      router.refresh();
    };
    const schedule = () => {
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
      if (ric) ric(run, { timeout: 2000 });
      else setTimeout(run, 800);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => { done = true; };
  }, [active, router]);
  return null;
}
