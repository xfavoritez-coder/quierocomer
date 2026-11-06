"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isInApp } from "@/lib/ecommerce/isInApp";

/**
 * Mantiene la cookie `qc_app` en sincronía con si el storefront corre dentro de
 * la app nativa (WebView de Capacitor). El servidor lee esa cookie para decidir
 * si muestra los platos marcados como appOnly (exclusivos de la app).
 *
 * - Dentro de la app y la cookie aún no está → solo la setea. Los platos appOnly
 *   aparecerán en la primera navegación (o en la próxima apertura), cuando el
 *   servidor ya reciba la cookie. NO se llama router.refresh() acá: en el primer
 *   arranque de la app un refresh durante/justo tras la hidratación interrumpía
 *   el montaje de la WebView y dejaba TODOS los botones sin responder (el scroll
 *   nativo seguía) hasta cerrar y reabrir la app. Diferirlo tampoco bastaba: el
 *   refresh en sí rompe la interactividad en esa WebView. Por eso se omite.
 * - En la web normal con la cookie puesta (caso raro) → la limpia y refresca, así
 *   nunca se filtran productos solo-app a un navegador web. En un navegador real
 *   el refresh es inocuo (el bug es exclusivo de la WebView de Capacitor).
 *
 * `active` = lo que el servidor creyó en este render (cookie presente).
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
    } catch {
      return;
    }
    // Solo refrescamos en la dirección web (limpiar), nunca dentro de la app.
    if (!inApp) router.refresh();
  }, [active, router]);
  return null;
}
