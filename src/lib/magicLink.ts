import crypto from "crypto";

const SECRET = process.env.MAGIC_LINK_SECRET || "fallback-dev-secret-change-in-prod";
const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

export function createPanelMagicToken(ownerId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ id: ownerId, exp: Date.now() + EXPIRY_MS })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyPanelMagicToken(token: string): { id: string } | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot < 0) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
    if (sig !== expected) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!data.id || !data.exp || Date.now() > data.exp) return null;
    return { id: data.id };
  } catch {
    return null;
  }
}
