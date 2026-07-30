import crypto from "crypto";
import { parseRewards } from "@/lib/loyalty";
import { prisma } from "@/lib/prisma";

/**
 * Integración con Google Wallet (sin dependencias externas: firma con `crypto`).
 *
 * Env vars requeridas:
 *   GOOGLE_WALLET_ISSUER_ID     — el Issuer ID (número) de la Wallet Console
 *   GOOGLE_WALLET_SA_EMAIL      — client_email de la service account
 *   GOOGLE_WALLET_SA_PRIVATE_KEY — private_key de la service account (PEM, con \n)
 */

const WALLET_API = "https://walletobjects.googleapis.com/walletobjects/v1";
const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";
const DEFAULT_LOGO = "https://quierocomer.com/logo.png";

/**
 * Recorta una imagen de Supabase a un banner ancho (para el heroImage de Google Wallet,
 * que si no sale muy alto y alarga el pase). Usa la transformación de imágenes de Supabase.
 * URLs que no son de Supabase se devuelven sin cambios.
 */
function wideBanner(url: string): string {
  if (!url.includes("/storage/v1/object/public/")) return url;
  const base = url.split("?")[0].replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
  return `${base}?width=1032&height=336&resize=cover&quality=80`;
}

function config() {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  const saEmail = process.env.GOOGLE_WALLET_SA_EMAIL;
  const privateKey = (process.env.GOOGLE_WALLET_SA_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!issuerId || !saEmail || !privateKey) return null;
  return { issuerId, saEmail, privateKey };
}

/** ¿Está configurado Google Wallet en este entorno? */
export function isGoogleWalletConfigured(): boolean {
  return config() !== null;
}

// ── Firma JWT RS256 (sin librerías) ──
function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function signJwtRS256(payload: Record<string, unknown>, privateKey: string): string {
  const header = { alg: "RS256", typ: "JWT" };
  const encHeader = base64url(JSON.stringify(header));
  const encPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encHeader}.${encPayload}`;
  const signature = crypto.createSign("RSA-SHA256").update(signingInput).sign(privateKey);
  return `${signingInput}.${base64url(signature)}`;
}

// ── Access token (cache en memoria) ──
let tokenCache: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  const cfg = config();
  if (!cfg) throw new Error("Google Wallet no está configurado");

  if (tokenCache && Date.now() < tokenCache.exp - 60_000) return tokenCache.token;

  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwtRS256(
    {
      iss: cfg.saEmail,
      scope: SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    },
    cfg.privateKey,
  );

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`Token Google Wallet falló: ${res.status} ${await res.text()}`);
  const data = await res.json();
  tokenCache = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function walletApi(method: string, path: string, body?: unknown): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${WALLET_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── IDs (deben empezar con el issuerId y ser alfanuméricos) ──
export function googleClassId(programId: string): string {
  return `${config()!.issuerId}.qc_prog_${programId}`;
}
export function googleObjectId(memberId: string): string {
  return `${config()!.issuerId}.qc_mem_${memberId}`;
}

interface ProgramLike {
  id: string;
  restaurantId?: string;
  name: string;
  stampGoal: number;
  stampIcon: string;
  rewards: unknown;
  cardColorHex: string;
  bgImageUrl: string | null;
  logoUrl: string | null;
  description: string | null;
  geoEnabled?: boolean;
}

// ── Clase de fidelidad (plantilla por programa/restaurante) ──
export async function upsertLoyaltyClass(program: ProgramLike, restaurantName: string, restaurantLogo?: string | null) {
  const classId = googleClassId(program.id);
  const rewards = parseRewards(program.rewards);
  const icon = program.stampIcon === "logo" ? "•" : program.stampIcon;
  const rewardsText = rewards.map((r) => `${r.stamp} ${icon} → ${r.reward}`).join("\n") || "—";

  // Geo-notificaciones: geofence en la clase (Google avisa cuando el cliente está cerca)
  let locations: { latitude: number; longitude: number }[] | undefined;
  if (program.geoEnabled && program.restaurantId) {
    const rest = await prisma.restaurant.findUnique({
      where: { id: program.restaurantId },
      select: { lat: true, lng: true },
    });
    if (rest?.lat != null && rest?.lng != null) {
      locations = [{ latitude: rest.lat, longitude: rest.lng }];
    }
  }

  const body: Record<string, unknown> = {
    id: classId,
    issuerName: restaurantName || "QuieroComer",
    programName: program.name,
    reviewStatus: "UNDER_REVIEW",
    hexBackgroundColor: program.cardColorHex,
    programLogo: { sourceUri: { uri: program.logoUrl || restaurantLogo || DEFAULT_LOGO } },
    // La imagen "hero" es el banner de la tarjeta (recortado ancho para no alargar el pase).
    ...(program.bgImageUrl && { heroImage: { sourceUri: { uri: wideBanner(program.bgImageUrl) } } }),
    ...(locations && { locations }),
    textModulesData: [
      { id: "recompensas", header: "Recompensas", body: rewardsText },
      ...(program.description ? [{ id: "condiciones", header: "Condiciones", body: program.description }] : []),
    ],
  };

  const post = await walletApi("POST", "/loyaltyClass", body);
  if (post.status === 409) {
    // ya existe → actualizar
    const patch = await walletApi("PATCH", `/loyaltyClass/${classId}`, body);
    if (!patch.ok) throw new Error(`upsertLoyaltyClass PATCH ${patch.status}: ${await patch.text()}`);
  } else if (!post.ok) {
    throw new Error(`upsertLoyaltyClass POST ${post.status}: ${await post.text()}`);
  }
  return classId;
}

interface MemberLike {
  id: string;
  name: string | null;
  stamps: number;
  redeemedTiers?: number[];
}

/**
 * Campo dinámico según el estado del cliente:
 *  - Si tiene recompensa(s) ganada(s) sin canjear → "¡Puedes canjear! X"
 *  - Si no → "Próxima recompensa: Y a los N sellos"
 */
function rewardStatus(member: MemberLike, program: ProgramLike): { label: string; value: string } {
  const rewards = parseRewards(program.rewards);
  // "Puedes canjear" solo cuando está justo en un nivel de recompensa (cumplió el requisito)
  const atTier = rewards.find((r) => r.stamp === member.stamps);
  if (atTier) return { label: "🎁 ¡Puedes canjear!", value: atTier.reward };
  const next = rewards.find((r) => r.stamp > member.stamps);
  if (next) {
    const faltan = next.stamp - member.stamps;
    return { label: `Te falta${faltan > 1 ? "n" : ""} ${faltan} sello${faltan > 1 ? "s" : ""} para`, value: next.reward };
  }
  return { label: "Recompensas", value: rewards.length ? "¡Todas alcanzadas!" : "—" };
}

function pointsBody(member: MemberLike, program: ProgramLike) {
  const status = rewardStatus(member, program);
  return {
    loyaltyPoints: {
      label: "Sellos",
      balance: { string: `${member.stamps}/${program.stampGoal}` },
    },
    secondaryLoyaltyPoints: {
      label: status.label,
      balance: { string: status.value },
    },
  };
}

// ── Objeto de fidelidad (tarjeta de un miembro) ──
export async function upsertLoyaltyObject(member: MemberLike, program: ProgramLike, restaurantName: string) {
  const objectId = googleObjectId(member.id);
  const classId = googleClassId(program.id);

  const body = {
    id: objectId,
    classId,
    state: "ACTIVE",
    accountName: member.name || "Cliente",
    accountId: member.id,
    hexBackgroundColor: program.cardColorHex,
    ...pointsBody(member, program),
    barcode: { type: "QR_CODE", value: member.id, alternateText: (member.name || "").slice(0, 20) },
  };

  const post = await walletApi("POST", "/loyaltyObject", body);
  if (post.status === 409) {
    const patch = await walletApi("PATCH", `/loyaltyObject/${objectId}`, body);
    if (!patch.ok) throw new Error(`upsertLoyaltyObject PATCH ${patch.status}: ${await patch.text()}`);
  } else if (!post.ok) {
    throw new Error(`upsertLoyaltyObject POST ${post.status}: ${await post.text()}`);
  }
  return objectId;
}

/** Expira (revoca) el pase de Google del miembro. */
export async function expireGoogleObject(objectId: string): Promise<void> {
  if (!isGoogleWalletConfigured()) return;
  const patch = await walletApi("PATCH", `/loyaltyObject/${objectId}`, { state: "EXPIRED" });
  if (!patch.ok && patch.status !== 404) {
    throw new Error(`expireGoogleObject ${patch.status}: ${await patch.text()}`);
  }
}

/** Solo actualiza los sellos (para reflejar cambios en la tarjeta ya guardada). */
export async function updateGooglePoints(member: MemberLike, program: ProgramLike) {
  const objectId = googleObjectId(member.id);
  const patch = await walletApi("PATCH", `/loyaltyObject/${objectId}`, pointsBody(member, program));
  if (!patch.ok) throw new Error(`updateGooglePoints ${patch.status}: ${await patch.text()}`);
}

/**
 * Envía un mensaje/notificación a TODOS los que tienen la tarjeta de este programa
 * (se agrega a la clase → llega a todos los objetos). Devuelve true si se envió.
 */
export async function sendGoogleClassMessage(programId: string, header: string, body: string): Promise<boolean> {
  if (!isGoogleWalletConfigured()) return false;
  const classId = googleClassId(programId);
  const res = await walletApi("POST", `/loyaltyClass/${classId}/addMessage`, {
    message: { id: `msg_${Date.now()}`, header: header.slice(0, 100), body: body.slice(0, 2000) },
  });
  if (res.status === 404) return false; // la clase aún no existe (sin tarjetas Google)
  if (!res.ok) throw new Error(`sendGoogleClassMessage ${res.status}: ${await res.text()}`);
  return true;
}

/**
 * Envía un mensaje/notificación a UN objeto (tarjeta de un miembro). Más confiable
 * para disparar la notificación en Android que hacerlo a la clase. Devuelve true si OK.
 */
export async function sendGoogleObjectMessage(objectId: string, header: string, body: string): Promise<boolean> {
  if (!isGoogleWalletConfigured()) return false;
  const res = await walletApi("POST", `/loyaltyObject/${objectId}/addMessage`, {
    message: { id: `msg_${Date.now()}`, header: header.slice(0, 100), body: body.slice(0, 2000) },
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`sendGoogleObjectMessage ${res.status}: ${await res.text()}`);
  return true;
}

/** Genera el link "Guardar en Google Wallet" (JWT firmado). */
export function generateSaveUrl(objectId: string): string {
  const cfg = config();
  if (!cfg) throw new Error("Google Wallet no está configurado");
  const claims = {
    iss: cfg.saEmail,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    payload: { loyaltyObjects: [{ id: objectId }] },
  };
  const jwt = signJwtRS256(claims, cfg.privateKey);
  return `https://pay.google.com/gp/v/save/${jwt}`;
}
