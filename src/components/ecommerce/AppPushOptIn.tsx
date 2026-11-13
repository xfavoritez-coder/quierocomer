"use client";
import { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";

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

// Utilidades de color de marca.
function parseHex(hex: string): [number, number, number] {
  let h = (hex || "").replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h || "6366f1", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function tint(hex: string, a: number): string { const [r, g, b] = parseHex(hex); return `rgba(${r},${g},${b},${a})`; }
function readableOn(hex: string): string { const [r, g, b] = parseHex(hex); return (0.299 * r + 0.587 * g + 0.114 * b) > 170 ? "#1a1a1a" : "#ffffff"; }

export default function AppPushOptIn({ restaurantId, brandColor = "#6366f1" }: { restaurantId: string; brandColor?: string }) {
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
  const onBrand = readableOn(brandColor);
  return (
    <div style={{ position: "fixed", left: 12, right: 12, bottom: "calc(12px + env(safe-area-inset-bottom, 0px))", zIndex: 9999, maxWidth: 480, margin: "0 auto",
      background: "#ffffff", color: "#1a1a1a", borderRadius: 18, boxShadow: "0 14px 44px rgba(0,0,0,0.22)", padding: 16,
      borderTop: `3px solid ${brandColor}`, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <button onClick={ahoraNo} aria-label="Cerrar" style={{ position: "absolute", top: 10, right: 10, width: 28, height: 28, borderRadius: 8, border: "none", background: "transparent", color: "#9aa0ab", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <X size={17} />
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: tint(brandColor, 0.12), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Bell size={22} color={brandColor} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Activa las notificaciones</div>
          <div style={{ fontSize: 13, color: "#60656e", lineHeight: 1.4 }}>Entérate de promos y ofertas exclusivas de la app antes que nadie.</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={ahoraNo} disabled={busy} style={{ flex: 1, padding: "11px", borderRadius: 11, border: "1px solid #e4e6ea", background: "transparent", color: "#60656e", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Ahora no</button>
        <button onClick={activar} disabled={busy} style={{ flex: 2, padding: "11px", borderRadius: 11, border: "none", background: brandColor, color: onBrand, fontWeight: 800, fontSize: 14, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 }}>{busy ? "Activando…" : "Activar"}</button>
      </div>
    </div>
  );
}
