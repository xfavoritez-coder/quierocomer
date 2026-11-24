// Cupón que llega por link (?coupon=CODE, p. ej. desde el email de recuperación).
// Se guarda al entrar a la tienda y el checkout lo aplica automáticamente.
const KEY = "qc-pending-coupon";
const TTL_MS = 7 * 86400000;

export function capturePendingCouponFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const code = new URLSearchParams(window.location.search).get("coupon")?.trim().toUpperCase();
    if (!code || !/^[A-Z0-9_-]{3,40}$/.test(code)) return null;
    localStorage.setItem(KEY, JSON.stringify({ code, ts: Date.now() }));
    return code;
  } catch { return null; }
}

export function readPendingCoupon(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as { code?: string; ts?: number };
    if (!d.code || !d.ts || Date.now() - d.ts > TTL_MS) { localStorage.removeItem(KEY); return null; }
    return d.code;
  } catch { return null; }
}

export function clearPendingCoupon(): void {
  try { localStorage.removeItem(KEY); } catch {}
}
