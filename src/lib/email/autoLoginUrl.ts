import crypto from "crypto";

const SECRET = process.env.AUTO_LOGIN_SECRET || "qc-auto-login-secret-2026";

/** Generate a signed auto-login URL for an owner */
export function buildAutoLoginUrl(baseUrl: string, ownerId: string): string {
  const t = Date.now().toString();
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(`${ownerId}:${t}`)
    .digest("hex")
    .slice(0, 16);
  return `${baseUrl}/api/panel/auto-login?oid=${ownerId}&sig=${sig}&t=${t}`;
}
