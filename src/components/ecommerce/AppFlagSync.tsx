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
    router.refresh();
  }, [active, router]);
  return null;
}
