import crypto from "crypto";
import forge from "node-forge";
import JSZip from "jszip";
import { loadImage, createCanvas } from "@napi-rs/canvas";
import { parseRewards } from "@/lib/loyalty";

/**
 * Generación y firma de tarjetas Apple Wallet (.pkpass).
 *
 * Env vars requeridas:
 *   APPLE_PASS_TYPE_ID       — ej. pass.com.quierocomer.loyalty
 *   APPLE_TEAM_ID            — Team ID (10 caracteres)
 *   APPLE_PASS_CERT_BASE64   — certificado del Pass Type ID (PEM en base64)
 *   APPLE_PASS_KEY_BASE64    — llave privada (PEM en base64)
 */

// Certificado intermedio WWDR G4 de Apple (público) — necesario en la cadena de firma.
const WWDR_G4_PEM = `-----BEGIN CERTIFICATE-----
MIIEVTCCAz2gAwIBAgIUE9x3lVJx5T3GMujM/+Uh88zFztIwDQYJKoZIhvcNAQEL
BQAwYjELMAkGA1UEBhMCVVMxEzARBgNVBAoTCkFwcGxlIEluYy4xJjAkBgNVBAsT
HUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRYwFAYDVQQDEw1BcHBsZSBS
b290IENBMB4XDTIwMTIxNjE5MzYwNFoXDTMwMTIxMDAwMDAwMFowdTFEMEIGA1UE
Aww7QXBwbGUgV29ybGR3aWRlIERldmVsb3BlciBSZWxhdGlvbnMgQ2VydGlmaWNh
dGlvbiBBdXRob3JpdHkxCzAJBgNVBAsMAkc0MRMwEQYDVQQKDApBcHBsZSBJbmMu
MQswCQYDVQQGEwJVUzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBANAf
eKp6JzKwRl/nF3bYoJ0OKY6tPTKlxGs3yeRBkWq3eXFdDDQEYHX3rkOPR8SGHgjo
v9Y5Ui8eZ/xx8YJtPH4GUnadLLzVQ+mxtLxAOnhRXVGhJeG+bJGdayFZGEHVD41t
QSo5SiHgkJ9OE0/QjJoyuNdqkh4laqQyziIZhQVg3AJK8lrrd3kCfcCXVGySjnYB
5kaP5eYq+6KwrRitbTOFOCOL6oqW7Z+uZk+jDEAnbZXQYojZQykn/e2kv1MukBVl
PNkuYmQzHWxq3Y4hqqRfFcYw7V/mjDaSlLfcOQIA+2SM1AyB8j/VNJeHdSbCb64D
YyEMe9QbsWLFApy9/a8CAwEAAaOB7zCB7DASBgNVHRMBAf8ECDAGAQH/AgEAMB8G
A1UdIwQYMBaAFCvQaUeUdgn+9GuNLkCm90dNfwheMEQGCCsGAQUFBwEBBDgwNjA0
BggrBgEFBQcwAYYoaHR0cDovL29jc3AuYXBwbGUuY29tL29jc3AwMy1hcHBsZXJv
b3RjYTAuBgNVHR8EJzAlMCOgIaAfhh1odHRwOi8vY3JsLmFwcGxlLmNvbS9yb290
LmNybDAdBgNVHQ4EFgQUW9n6HeeaGgujmXYiUIY+kchbd6gwDgYDVR0PAQH/BAQD
AgEGMBAGCiqGSIb3Y2QGAgEEAgUAMA0GCSqGSIb3DQEBCwUAA4IBAQA/Vj2e5bbD
eeZFIGi9v3OLLBKeAuOugCKMBB7DUshwgKj7zqew1UJEggOCTwb8O0kU+9h0UoWv
p50h5wESA5/NQFjQAde/MoMrU1goPO6cn1R2PWQnxn6NHThNLa6B5rmluJyJlPef
x4elUWY0GzlxOSTjh2fvpbFoe4zuPfeutnvi0v/fYcZqdUmVIkSoBPyUuAsuORFJ
EtHlgepZAE9bPFo22noicwkJac3AfOriJP6YRLj477JxPxpd1F1+M02cHSS+APCQ
A1iZQT0xWmJArzmoUUOSqwSonMJNsUvSq3xKX+udO7xPiEAGE/+QF4oIRynoYpgp
pU8RBWk6z/Kf
-----END CERTIFICATE-----`;

function config() {
  const passTypeId = process.env.APPLE_PASS_TYPE_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const certB64 = process.env.APPLE_PASS_CERT_BASE64;
  const keyB64 = process.env.APPLE_PASS_KEY_BASE64;
  if (!passTypeId || !teamId || !certB64 || !keyB64) return null;
  return {
    passTypeId,
    teamId,
    certPem: Buffer.from(certB64, "base64").toString("utf8"),
    keyPem: Buffer.from(keyB64, "base64").toString("utf8"),
  };
}

export function isAppleWalletConfigured(): boolean {
  return config() !== null;
}

function hexToRgb(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "rgb(17, 17, 17)";
  const n = parseInt(m[1], 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6;
}

// URL del PNG del emoji (Twemoji) para dibujarlo en la imagen — funciona igual en Linux/Vercel.
function twemojiUrl(icon: string): string | null {
  const cps = [...icon].map((c) => c.codePointAt(0)!).filter((cp) => cp !== 0xfe0f && cp !== 0x200d);
  if (!cps.length) return null;
  const name = cps.map((cp) => cp.toString(16)).join("-");
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${name}.png`;
}

async function loadEmoji(icon: string) {
  const url = twemojiUrl(icon);
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await loadImage(Buffer.from(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

interface ProgramLike {
  id: string;
  name: string;
  stampGoal: number;
  stampIcon: string;
  rewards: unknown;
  cardColorHex: string;
  stampColorHex: string;
  bgImageUrl: string | null;
  logoUrl: string | null;
  description: string | null;
  pushMessage?: string | null;
  showGiftBadge?: boolean;
}
interface MemberLike {
  id: string;
  name: string | null;
  stamps: number;
  redeemedTiers?: number[];
  authToken?: string;
  revoked?: boolean;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";

// Etiqueta (arriba) + valor con el nombre de la recompensa (abajo). Va en 2 columnas.
function rewardStatus(member: MemberLike, program: ProgramLike): { label: string; value: string } {
  const rewards = parseRewards(program.rewards);
  // "Puedes canjear" solo cuando está justo en un nivel de recompensa
  const atTier = rewards.find((r) => r.stamp === member.stamps);
  if (atTier) return { label: "🎁 ¡Puedes canjear!", value: atTier.reward };
  const next = rewards.find((r) => r.stamp > member.stamps);
  if (next) {
    const faltan = next.stamp - member.stamps;
    return { label: `Te falta${faltan > 1 ? "n" : ""} ${faltan} sello${faltan > 1 ? "s" : ""} para`, value: next.reward };
  }
  return { label: "Recompensas", value: rewards.length ? "¡Todas alcanzadas!" : "—" };
}

// ── Strip image: la grilla de sellos sobre la foto/color (lo que hace lucir la tarjeta) ──
async function stripImage(program: ProgramLike, member: MemberLike, scale: number, logoSrc: string | null): Promise<Buffer> {
  const W = 375 * scale;
  const H = 123 * scale;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Fondo: foto del plato (cover) + overlay oscuro, o el color de la tarjeta
  if (program.bgImageUrl) {
    try {
      const res = await fetch(program.bgImageUrl);
      const img = await loadImage(Buffer.from(await res.arrayBuffer()));
      const s = Math.max(W / img.width, H / img.height);
      const w = img.width * s;
      const h = img.height * s;
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      ctx.fillStyle = "rgba(0,0,0,0.62)";
      ctx.fillRect(0, 0, W, H);
    } catch {
      ctx.fillStyle = program.cardColorHex;
      ctx.fillRect(0, 0, W, H);
    }
  } else {
    ctx.fillStyle = program.cardColorHex;
    ctx.fillRect(0, 0, W, H);
  }

  // Grilla de sellos — círculos grandes con poca separación, centrada
  const goal = Math.max(1, program.stampGoal);
  const cols = goal <= 5 ? goal : Math.ceil(goal / 2);
  const rows = Math.ceil(goal / cols);
  const gapRatio = 0.16; // separación = 16% del diámetro
  const padX = 14 * scale;
  const padY = 12 * scale;
  const d = Math.min(
    (H - 2 * padY) / (rows + (rows - 1) * gapRatio),
    (W - 2 * padX) / (cols + (cols - 1) * gapRatio),
  );
  const r = d / 2;
  const step = d + gapRatio * d;
  const gridW = cols * d + (cols - 1) * gapRatio * d;
  const gridH = rows * d + (rows - 1) * gapRatio * d;
  const startX = (W - gridW) / 2;
  const startY = (H - gridH) / 2;

  // Icono del sello: logo del restaurante o emoji (una sola descarga)
  const useLogo = program.stampIcon === "logo" && !!logoSrc;
  let emoji = null;
  if (useLogo) {
    try {
      const res = await fetch(logoSrc!);
      emoji = await loadImage(Buffer.from(await res.arrayBuffer()));
    } catch {
      emoji = null;
    }
  } else {
    emoji = await loadEmoji(program.stampIcon || "");
  }
  const gift = program.showGiftBadge !== false ? await loadEmoji("🎁") : null;
  const glyphSize = useLogo ? r * 1.5 : r * 1.35;
  const tierStamps = new Set(parseRewards(program.rewards).map((t) => t.stamp));

  for (let i = 0; i < goal; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = startX + col * step + d / 2;
    const cy = startY + row * step + d / 2;
    const filled = i < member.stamps;
    const isTier = tierStamps.has(i + 1);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (filled) {
      ctx.fillStyle = program.stampColorHex;
      ctx.fill();
    } else {
      ctx.lineWidth = 1 * scale;
      // Casillas con recompensa en dorado tenue; las demás casi imperceptibles
      ctx.strokeStyle = isTier ? "rgba(244,166,35,0.55)" : "rgba(255,255,255,0.18)";
      ctx.stroke();
    }

    // Icono dentro del círculo (los vacíos muy tenues)
    ctx.globalAlpha = filled ? 1 : 0.23;
    if (emoji) {
      ctx.drawImage(emoji, cx - glyphSize / 2, cy - glyphSize / 2, glyphSize, glyphSize);
    } else {
      ctx.fillStyle = filled ? (isLight(program.stampColorHex) ? "#111" : "#fff") : "rgba(255,255,255,0.9)";
      ctx.font = `${r * 1.05}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(program.stampIcon && program.stampIcon !== "logo" ? program.stampIcon : "★", cx, cy + r * 0.05);
    }
    ctx.globalAlpha = 1;

    // Casilla de recompensa: regalo 🎁 en la esquina superior derecha (sin círculo, más grande)
    if (isTier && gift && program.showGiftBadge !== false) {
      const bs = r * 0.5;
      const bx = cx + r * 0.62;
      const by = cy - r * 0.62;
      // Misma opacidad que el sello: tenue si aún no está timbrado
      ctx.save();
      ctx.globalAlpha = filled ? 1 : 0.23;
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 4 * scale;
      ctx.drawImage(gift, bx - bs / 2, by - bs / 2, bs, bs);
      ctx.restore();
    }
  }

  return canvas.toBuffer("image/png");
}

// ── Imágenes: normaliza a PNG del tamaño pedido (contain sobre el color de la tarjeta) ──
async function logoPng(url: string | null, size: number, bg: string): Promise<Buffer> {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  if (url) {
    try {
      const res = await fetch(url);
      const img = await loadImage(Buffer.from(await res.arrayBuffer()));
      const scale = Math.min(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      return canvas.toBuffer("image/png");
    } catch {
      // cae al placeholder
    }
  }
  // Placeholder: fondo + primera letra
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = isLight(bg) ? "#111" : "#fff";
  ctx.font = `bold ${size * 0.5}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("★", size / 2, size / 2);
  return canvas.toBuffer("image/png");
}

// ── Firma PKCS#7 detached del manifest.json ──
function signManifest(manifest: Buffer, certPem: string, keyPem: string): Buffer {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifest.toString("binary"));
  p7.addCertificate(forge.pki.certificateFromPem(certPem));
  p7.addCertificate(forge.pki.certificateFromPem(WWDR_G4_PEM));
  p7.addSigner({
    key: forge.pki.privateKeyFromPem(keyPem),
    certificate: forge.pki.certificateFromPem(certPem),
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date().toISOString() },
    ],
  });
  p7.sign({ detached: true });
  return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), "binary");
}

/** Genera el buffer .pkpass firmado para un miembro. */
export async function buildPkpass(member: MemberLike, program: ProgramLike, restaurantName: string, restaurantLogo?: string | null): Promise<Buffer> {
  const cfg = config();
  if (!cfg) throw new Error("Apple Wallet no está configurado");

  const rewards = parseRewards(program.rewards);
  const bg = program.cardColorHex;
  const logoSrc = program.logoUrl || restaurantLogo || null;
  const status = rewardStatus(member, program);

  const pass = {
    formatVersion: 1,
    passTypeIdentifier: cfg.passTypeId,
    teamIdentifier: cfg.teamId,
    organizationName: restaurantName,
    serialNumber: member.id,
    description: program.name,
    logoText: restaurantName,
    ...(member.revoked && { voided: true }),
    foregroundColor: isLight(bg) ? "rgb(17,17,17)" : "rgb(255,255,255)",
    backgroundColor: hexToRgb(bg),
    labelColor: isLight(bg) ? "rgb(80,80,80)" : "rgb(220,220,220)",
    barcodes: [{ format: "PKBarcodeFormatQR", message: member.id, messageEncoding: "iso-8859-1" }],
    // Servicio de actualización (APNs) — permite que el pase se refresque solo
    ...(member.authToken && {
      webServiceURL: `${BASE_URL}/api/loyalty/wallet/apple`,
      authenticationToken: member.authToken,
    }),
    storeCard: {
      // Dos columnas: recompensa (izq) y cliente (der)
      headerFields: [{ key: "sellos", label: "SELLOS", value: `${member.stamps}/${program.stampGoal}` }],
      secondaryFields: [{ key: "next", label: status.label, value: status.value }],
      auxiliaryFields: [{ key: "member", label: "Cliente", value: member.name || "Cliente" }],
      backFields: [
        // Campo de novedades: su changeMessage dispara la notificación push al cambiar
        { key: "novedad", label: "Novedades", value: program.pushMessage || "Te avisaremos de promos y novedades aquí.", changeMessage: "%@" },
        { key: "rewards", label: "Recompensas", value: rewards.map((r) => `${r.stamp} ${program.stampIcon === "logo" ? "•" : program.stampIcon} → ${r.reward}`).join("\n") || "—" },
        ...(program.description ? [{ key: "cond", label: "Condiciones", value: program.description }] : []),
      ],
    },
  };

  // Archivos del pase
  const files: Record<string, Buffer> = {
    "pass.json": Buffer.from(JSON.stringify(pass)),
    "icon.png": await logoPng(logoSrc, 58, bg),
    "icon@2x.png": await logoPng(logoSrc, 116, bg),
    "logo.png": await logoPng(logoSrc, 50, bg),
    "logo@2x.png": await logoPng(logoSrc, 100, bg),
    "strip.png": await stripImage(program, member, 1, logoSrc),
    "strip@2x.png": await stripImage(program, member, 2, logoSrc),
    "strip@3x.png": await stripImage(program, member, 3, logoSrc),
  };

  // manifest.json (SHA1 de cada archivo)
  const manifest: Record<string, string> = {};
  for (const [name, buf] of Object.entries(files)) {
    manifest[name] = crypto.createHash("sha1").update(buf).digest("hex");
  }
  const manifestBuf = Buffer.from(JSON.stringify(manifest));

  // Empaquetar .pkpass (zip)
  const zip = new JSZip();
  for (const [name, buf] of Object.entries(files)) zip.file(name, buf);
  zip.file("manifest.json", manifestBuf);
  zip.file("signature", signManifest(manifestBuf, cfg.certPem, cfg.keyPem));

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
