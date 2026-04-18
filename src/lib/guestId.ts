/**
 * Persistent guest identity — survives tab closes and browser restarts.
 * Uses localStorage as primary store + cookie as backup (365 days).
 * Name: quierocomer_guest_id
 */

const GUEST_KEY = "quierocomer_guest_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

let _cached: string | null = null;

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;
}

export function getGuestId(): string {
  if (_cached) return _cached;
  if (typeof window === "undefined") return "";

  // Try localStorage first
  let id = localStorage.getItem(GUEST_KEY);

  // Fallback to cookie
  if (!id) id = getCookie(GUEST_KEY);

  // Migrate from old sessionStorage key if present
  if (!id) {
    id = sessionStorage.getItem("qr_session_id");
  }

  // Generate new ID
  if (!id) {
    id = crypto.randomUUID();
  }

  // Persist everywhere
  localStorage.setItem(GUEST_KEY, id);
  setCookie(GUEST_KEY, id);
  _cached = id;
  return id;
}

/**
 * Also expose a sessionId (unique per tab) for backwards compatibility.
 * This is useful for distinguishing multiple tabs from the same guest.
 */
export function getSessionId(): string {
  let id = sessionStorage.getItem("qr_session_id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("qr_session_id", id);
  }
  return id;
}
