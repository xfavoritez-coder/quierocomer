"use client";
import { useEffect, useRef } from "react";

/**
 * Registra el token de push del dispositivo (APNs/FCM) al abrir la app, para
 * poder enviar notificaciones (promos). Solo corre dentro de la app nativa
 * (Capacitor) y SOLO si el permiso de notificaciones YA está concedido — no
 * muestra prompt en el arranque (el permiso se pide en el flujo de pedido).
 * El mismo plugin que usan las notificaciones de estado de pedido.
 */
export default function AppPushRegister({ restaurantId }: { restaurantId: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !restaurantId) return;
    done.current = true;
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        const c: any = (window as any).Capacitor;
        if (!c?.isNativePlatform?.()) return; // solo en la app
        const Push = c?.Plugins?.PushNotifications;
        const platform = c?.getPlatform?.(); // "ios" | "android"
        if (!Push || (platform !== "ios" && platform !== "android")) return;
        // No pedir permiso en el arranque: solo registrar si ya está concedido.
        const perm = await Push.checkPermissions?.().catch(() => null);
        if (!perm || perm.receive !== "granted") return;
        const handle = await Push.addListener("registration", (t: { value: string }) => {
          if (!t?.value) return;
          fetch("/api/ecommerce/app-device", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            keepalive: true,
            body: JSON.stringify({ restaurantId, platform, token: t.value }),
          }).catch(() => {});
        });
        cleanup = () => { try { handle?.remove?.(); } catch { /* noop */ } };
        await Push.register();
      } catch { /* noop */ }
    })();
    return () => { cleanup?.(); };
  }, [restaurantId]);
  return null;
}
