import crypto from "crypto";
import type { NextResponse } from "next/server";

/**
 * Sesiones firmadas (HMAC-SHA256).
 *
 * Reemplaza las cookies sueltas admin_token/admin_id/admin_role y
 * panel_token/panel_id/panel_role/panel_demo_slug, que nunca se validaban y
 * podían fabricarse a mano. Cada sesión vive en UNA cookie httpOnly:
 *
 *   qc_admin_session  → sesión del superadmin (/admin)
 *   qc_panel_session  → sesión del panel (dueño, team member "tm_<id>", demo)
 *
 * Formato:  base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload))
 *
 * El secreto viene de SESSION_SECRET. En producción, si falta (o es muy corto),
 * no se emite ni se acepta ninguna sesión (falla cerrado).
 */

export type SessionKind = "admin" | "panel";

export interface SessionPayload {
  v: 1;
  kind: SessionKind;
  /** admin: "superadmin" · panel: ownerId | "tm_<teamMemberId>" | "demo" */
  id: string;
  role: string;
  /** Solo sesiones demo sin dueño: slug del local demo. */
  demoSlug?: string;
  /** Sesión creada vía demo-auth (aunque el local tenga dueño). */
  demo?: boolean;
  /** Emitida en (segundos epoch). */
  iat: number;
  /** Expira en (segundos epoch). */
  exp: number;
}

export const ADMIN_SESSION_COOKIE = "qc_admin_session";
export const PANEL_SESSION_COOKIE = "qc_panel_session";

const COOKIE_NAME: Record<SessionKind, string> = {
  admin: ADMIN_SESSION_COOKIE,
  panel: PANEL_SESSION_COOKIE,
};

/** Cookies antiguas (sin firma). Ya no se leen; se borran al loguear/desloguear. */
const LEGACY_COOKIES: Record<SessionKind, string[]> = {
  admin: ["admin_token", "admin_id", "admin_role"],
  panel: ["panel_token", "panel_id", "panel_role", "panel_demo_slug"],
};

const IS_PROD = process.env.NODE_ENV === "production";
const DEV_FALLBACK_SECRET = "qc-dev-only-session-secret-NO-USAR-EN-PRODUCCION";
let warnedMissingSecret = false;

function getSecret(): string | null {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (IS_PROD) {
    if (!warnedMissingSecret) {
      console.error("[session] SESSION_SECRET falta o tiene < 32 caracteres: se rechazan todas las sesiones.");
      warnedMissingSecret = true;
    }
    return null;
  }
  if (!warnedMissingSecret) {
    console.warn("[session] SESSION_SECRET no configurado: usando secreto de desarrollo.");
    warnedMissingSecret = true;
  }
  return DEV_FALLBACK_SECRET;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function sign(data: string, secret: string): Buffer {
  return crypto.createHmac("sha256", secret).update(data).digest();
}

/** Serializa y firma una sesión. Lanza error si no hay secreto en producción. */
export function encodeSession(payload: SessionPayload): string {
  const secret = getSecret();
  if (!secret) throw new Error("SESSION_SECRET no configurado");
  const body = b64url(JSON.stringify(payload));
  return `${body}.${b64url(sign(body, secret))}`;
}

/** Verifica firma (tiempo constante), estructura y expiración. */
export function decodeSession(token: string | undefined | null, kind: SessionKind): SessionPayload | null {
  if (!token || token.length > 4096) return null;
  const secret = getSecret();
  if (!secret) return null;

  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return null;
  const body = token.slice(0, dot);
  const sigPart = token.slice(dot + 1);

  let given: Buffer;
  try {
    given = Buffer.from(sigPart, "base64url");
  } catch {
    return null;
  }
  const expected = sign(body, secret);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;

  let p: SessionPayload;
  try {
    p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!p || p.v !== 1 || p.kind !== kind) return null;
  if (typeof p.id !== "string" || !p.id || typeof p.role !== "string") return null;
  if (typeof p.exp !== "number" || p.exp * 1000 <= Date.now()) return null;
  if (p.demoSlug !== undefined && typeof p.demoSlug !== "string") return null;
  return p;
}

/** Cualquier cosa con `.get(name)` → NextRequest.cookies o `await cookies()`. */
export interface CookieReader {
  get(name: string): { value: string } | undefined;
}

type ReqLike = { cookies: CookieReader };

function toReader(src: ReqLike | CookieReader): CookieReader {
  return "cookies" in src ? src.cookies : src;
}

export function readSession(src: ReqLike | CookieReader, kind: SessionKind): SessionPayload | null {
  return decodeSession(toReader(src).get(COOKIE_NAME[kind])?.value, kind);
}

export function readAdminSession(src: ReqLike | CookieReader): SessionPayload | null {
  return readSession(src, "admin");
}

export function readPanelSession(src: ReqLike | CookieReader): SessionPayload | null {
  return readSession(src, "panel");
}

/** ID verificado del panel: ownerId, "tm_<id>" o "demo". null si no hay sesión válida. */
export function getPanelId(src: ReqLike | CookieReader): string | null {
  return readPanelSession(src)?.id ?? null;
}

/**
 * Emite la cookie de sesión firmada y borra las cookies antiguas sin firma.
 * Lanza error si no se puede firmar (falta SESSION_SECRET en producción).
 */
export function setSessionCookie(
  response: NextResponse,
  data: { kind: SessionKind; id: string; role: string; demoSlug?: string; demo?: boolean },
  maxAgeSeconds: number,
): void {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    v: 1,
    kind: data.kind,
    id: data.id,
    role: data.role,
    iat: now,
    exp: now + maxAgeSeconds,
  };
  if (data.demoSlug) payload.demoSlug = data.demoSlug;
  if (data.demo) payload.demo = true;

  response.cookies.set(COOKIE_NAME[data.kind], encodeSession(payload), {
    path: "/",
    maxAge: maxAgeSeconds,
    sameSite: "lax",
    secure: IS_PROD,
    httpOnly: true,
  });
  for (const name of LEGACY_COOKIES[data.kind]) response.cookies.delete(name);
}

export function clearSessionCookie(response: NextResponse, kind: SessionKind): void {
  response.cookies.delete(COOKIE_NAME[kind]);
  for (const name of LEGACY_COOKIES[kind]) response.cookies.delete(name);
}
