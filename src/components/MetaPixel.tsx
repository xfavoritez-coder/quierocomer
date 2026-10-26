"use client";
import { useEffect } from "react";

// Meta Pixel (Facebook) SOLO para el marketing de QuieroComer (quierocomer.com).
// No se carga en las tiendas de ecommerce de los locales (dominios propios ni
// rutas /ecommerce/…), para no rastrear a los clientes de los locales.
const PIXEL_ID = "1532906358481871";

export default function MetaPixel() {
  useEffect(() => {
    try {
      const h = window.location.hostname;
      const path = window.location.pathname;
      const isMain = h === "quierocomer.com" || h === "www.quierocomer.com" || h.endsWith(".vercel.app") || h === "localhost" || h === "127.0.0.1";
      // No cargar en tiendas (dominio propio) ni en el storefront del dominio principal.
      if (!isMain || path.startsWith("/ecommerce/")) return;
      const w = window as unknown as { fbq?: (...args: unknown[]) => void; _fbq?: unknown };
      if (w.fbq) return;
      /* eslint-disable */
      (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
        if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
        t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      /* eslint-enable */
      w.fbq!("init", PIXEL_ID);
      w.fbq!("track", "PageView");
    } catch { /* noop */ }
  }, []);
  return null;
}
