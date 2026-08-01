"use client";

import { useEffect } from "react";

/**
 * Componente invisible que solicita la ubicación del miembro al cargar la página.
 * Si está dentro del radio del local (y no se le notificó en las últimas 4h),
 * el servidor envía un push → changeMessage → banner que auto-desaparece.
 * No muestra nada en pantalla.
 */
export default function GeoCheck({ memberId, authToken }: { memberId: string; authToken: string }) {
  useEffect(() => {
    if (!navigator?.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetch("/api/loyalty/geo-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            memberId,
            authToken,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        }).catch(() => {});
      },
      () => {
        // Permiso denegado o error → silencioso, no interrumpir la UX
      },
      {
        timeout: 8000,
        maximumAge: 5 * 60 * 1000, // aceptar caché de hasta 5 min
        enableHighAccuracy: false,   // batería: precisión normal es suficiente para 100-1000 m
      },
    );
  }, [memberId, authToken]);

  return null;
}
