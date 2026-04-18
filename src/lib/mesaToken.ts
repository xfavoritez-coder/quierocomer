/**
 * Mesa token — controls waiter button visibility.
 *
 * When a customer scans a table QR (/qr/[slug]/mesa/[tableId]),
 * a cookie is set that expires in 3 hours. The waiter button
 * only shows if this cookie exists and hasn't expired.
 */

const COOKIE_PREFIX = "mesa_token_";
const DEFAULT_HOURS = 3;
const DEMO_HOURS = 1;

interface MesaToken {
  tableId: string;
  restaurantId: string;
  expiresAt: number;
  isDemo: boolean;
}

export function setMesaToken(restaurantId: string, tableId: string, isDemo = false) {
  if (typeof document === "undefined") return;
  const hours = isDemo ? DEMO_HOURS : DEFAULT_HOURS;
  const token: MesaToken = {
    tableId,
    restaurantId,
    expiresAt: Date.now() + hours * 60 * 60 * 1000,
    isDemo,
  };
  document.cookie = `${COOKIE_PREFIX}${restaurantId}=${encodeURIComponent(JSON.stringify(token))};path=/;max-age=${hours * 3600};SameSite=Lax`;
}

export function getMesaToken(restaurantId: string): MesaToken | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`${COOKIE_PREFIX}${restaurantId}=([^;]*)`));
  if (!match) return null;

  try {
    const token: MesaToken = JSON.parse(decodeURIComponent(match[1]));
    if (token.expiresAt < Date.now()) {
      // Expired — clean up
      document.cookie = `${COOKIE_PREFIX}${restaurantId}=;path=/;max-age=0`;
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function hasMesaToken(restaurantId: string): boolean {
  return getMesaToken(restaurantId) !== null;
}
