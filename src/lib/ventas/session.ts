import crypto from "crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Sesión de vendedores de /ventas: cookie httpOnly firmada con HMAC (no se puede
// fabricar a mano). Login sin contraseña: enlace de un solo uso enviado al correo.

export const VENTAS_COOKIE = "qc_ventas";
export const SESSION_DAYS = 30;
export const LOGIN_LINK_MINUTES = 15;

function secret(): string {
  const s = process.env.VENTAS_SESSION_SECRET || process.env.MAGIC_LINK_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("Falta VENTAS_SESSION_SECRET");
  return "dev-only-ventas-secret";
}

/** HMAC con el secreto de Ventas (también lo usa el enlace de registro). */
export const hmac = (data: string) => crypto.createHmac("sha256", `ventas:${secret()}`).update(data).digest("base64url");

export function signSession(sellerId: string): string {
  const payload = Buffer.from(JSON.stringify({ sid: sellerId, exp: Date.now() + SESSION_DAYS * 86400000 })).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

export function verifySession(token: string | undefined | null): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(hmac(payload));
  if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { sid?: string; exp?: number };
    if (!data.sid || !data.exp || Date.now() > data.exp) return null;
    return data.sid;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 86400,
};

export type CurrentSeller = { id: string; email: string; name: string; role: "ADMIN" | "SELLER" };

async function loadSeller(sellerId: string | null): Promise<CurrentSeller | null> {
  if (!sellerId) return null;
  const s = await prisma.seller.findUnique({ where: { id: sellerId }, select: { id: true, email: true, name: true, role: true, active: true } });
  if (!s || !s.active) return null;
  return { id: s.id, email: s.email, name: s.name, role: s.role };
}

/** Vendedor de la sesión actual (Server Components / layouts). */
export async function getCurrentSeller(): Promise<CurrentSeller | null> {
  const store = await cookies();
  return loadSeller(verifySession(store.get(VENTAS_COOKIE)?.value));
}

/** Vendedor de la sesión actual (Route Handlers). */
export async function getSellerFromRequest(req: NextRequest): Promise<CurrentSeller | null> {
  return loadSeller(verifySession(req.cookies.get(VENTAS_COOKIE)?.value));
}

/** Token de un solo uso para el enlace de login: se guarda solo su hash. */
export function newLoginToken(): { token: string; hash: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, hash: hashLoginToken(token), expiresAt: new Date(Date.now() + LOGIN_LINK_MINUTES * 60000) };
}

export const hashLoginToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
