"use client";
import { useEffect, useState } from "react";

// Carga el SDK de Google Maps (places + geometry) una sola vez por página.
let loadingPromise: Promise<void> | null = null;

export function loadGoogleMaps(key: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const w = window as unknown as { google?: { maps?: { places?: unknown; importLibrary?: (n: string) => Promise<unknown> } }; [k: string]: unknown };
  if (w.google?.maps?.places) return Promise.resolve();
  if (loadingPromise) return loadingPromise;
  loadingPromise = new Promise<void>((resolve, reject) => {
    const cb = "__qcGmapsReady";
    // El callback se dispara cuando la API base está lista; luego cargamos las
    // librerías con importLibrary para garantizar que `places`/`geometry` existan.
    w[cb] = async () => {
      try {
        const im = w.google!.maps!.importLibrary!;
        await im("places");
        await im("geometry");
        resolve();
      } catch (e) { loadingPromise = null; reject(e); }
    };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places,geometry&loading=async&callback=${cb}`;
    s.async = true;
    s.onerror = () => { loadingPromise = null; reject(new Error("No se pudo cargar Google Maps")); };
    document.head.appendChild(s);
  });
  return loadingPromise;
}

/** Devuelve true cuando el SDK de Google Maps está listo (o null key → nunca). */
export function useGoogleMaps(key: string | null | undefined): boolean {
  const [ready, setReady] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const w = window as unknown as { google?: { maps?: { places?: unknown } } };
    return !!w.google?.maps?.places;
  });
  useEffect(() => {
    if (!key || ready) return;
    let alive = true;
    loadGoogleMaps(key).then(() => { if (alive) setReady(true); }).catch(() => {});
    return () => { alive = false; };
  }, [key, ready]);
  return ready;
}
