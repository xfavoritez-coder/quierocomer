"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Forces scroll to top on every route change within /subircarta.
 * Lives in the layout so it persists across page navigations.
 * Uses an aggressive multi-strategy approach because Next.js App Router
 * restores scroll position AFTER component effects run.
 */
export default function ScrollToTop() {
  const pathname = usePathname();
  const prev = useRef(pathname);

  useEffect(() => {
    if (pathname === prev.current) return;
    prev.current = pathname;

    // Disable scroll restoration
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";

    // Immediate
    window.scrollTo(0, 0);

    // After Next.js hydration/paint — covers the case where Next.js
    // restores scroll position after our initial scrollTo
    const raf1 = requestAnimationFrame(() => window.scrollTo(0, 0));
    const raf2 = requestAnimationFrame(() =>
      requestAnimationFrame(() => window.scrollTo(0, 0))
    );

    // Nuclear option: poll for 500ms to catch any late scroll restoration
    const start = Date.now();
    const interval = setInterval(() => {
      if (window.scrollY > 0) window.scrollTo(0, 0);
      if (Date.now() - start > 500) clearInterval(interval);
    }, 16);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearInterval(interval);
    };
  }, [pathname]);

  return null;
}
