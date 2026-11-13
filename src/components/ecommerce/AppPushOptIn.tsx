"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Banner de OPT-IN de notificaciones (solo dentro de la app). Para crecer la
 * audiencia de push promocional: a quien AÚN NO se le pidió permiso (estado
 * "prompt"), se le ofrece activarlo. Al aceptar, pide el permiso del sistema y
 * registra el token en /api/ecommerce/app-device. Se recuerda el descarte 14 días.
 * Si el permiso ya está concedido o denegado, no muestra nada (AppPushRegister
 * se encarga del registro cuando está concedido).
 */
const DISMISS_KEY = "qc_push_optin_dismissed_at";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

export default function AppPushOptIn({ restaurantId }: { restaurantId: string }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const pushRef = useRef<any>(null);
  const platformRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    (async () => {
      try {
        const c: any = (window as any).Capacitor;
        if (!c?.isNativePlatform?.()) return;
        const Push = c?.Plugins?.PushNotifications;
        const platform = c?.getPlatform?.();
        if (!Push || (platform !== "ios" && platform !== "android")) return;
        // Descartado hace poco → no insistir.
        try {
          const at = Number(localStorage.getItem(DISMISS_KEY) || "0");
          if (at && Date.now() - at < SNOOZE_MS) return;
        } catch { /* noop */ }
        const perm = await Push.checkPermissions?.().catch(() => null);
        if (!perm || perm.receive !== "prompt") return; // solo si aún no se pidió
        pushRef.current = Push;
        platformRef.current = platform;
        // Pequeño retardo: que vean primero el menú.
        timerRef.current = setTimeout(() => setShow(true), 2800);
      } catch { /* noop */ }
    })();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [restaurantId]);

  async function activar() {
    const Push = pushRef.current;
    const platform = platformRef.current;
    if (!Push) { setShow(false); return; }
    setBusy(true);
    try {
      const perm = await Push.requestPermissions().catch(() => null);
      if (perm?.receive === "granted") {
        await Push.addListener("registration", (t: { value: string }) => {
          if (!t?.value) return;
          fetch("/api/ecommerce/app-device", {
            method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
            body: JSON.stringify({ restaurantId, platform, token: t.value }),
          }).catch(() => {});
        });
        await Push.register();
      }
    } catch { /* noop */ }
    finally {
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* noop */ }
      setBusy(false); setShow(false);
    }
  }

  function ahoraNo() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* noop */ }
    setShow(false);
  }

  if (!show) return null;
  return (
    <div style={{ position: "fixed", left: 12, right: 12, bottom: "calc(12px + env(safe-area-inset-bottom, 0px))", zIndex: 9999, maxWidth: 480, margin: "0 auto",
      background: "#1f2430", color: "#fff", borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,0.35)", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ fontSize: 26, lineHeight: 1 }}>🔔</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Activa las notificaciones</div>
          <div style={{ fontSize: 13, color: "#c7cbd4", lineHeight: 1.4 }}>Entérate de promos y ofertas exclusivas de la app antes que nadie.</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={ahoraNo} disabled={busy} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", background: "transparent", color: "#c7cbd4", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Ahora no</button>
        <button onClick={activar} disabled={busy} style={{ flex: 2, padding: "10px", borderRadius: 10, border: "none", background: "#6366f1", color: "#fff", fontWeight: 800, fontSize: 14, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 }}>{busy ? "Activando…" : "Activar"}</button>
      </div>
    </div>
  );
}
