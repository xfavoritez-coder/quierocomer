import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import { getPlatformSetting, setPlatformSetting } from "@/lib/platformSettings";
import { getWalletBank, setWalletBank, type WalletBank } from "@/lib/ecommerce/deliveryWallet";

export const runtime = "nodejs";

/**
 * Ajustes globales de plataforma (API keys de integraciones). Solo superadmin.
 * GET → { googleApiKey }
 * PUT { googleApiKey } → guarda
 */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const googleApiKey = (await getPlatformSetting("google_api_key")) || "";
  const deliveryWalletBank = await getWalletBank();
  return NextResponse.json({ googleApiKey, deliveryWalletBank });
}

export async function PUT(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (body?.googleApiKey !== undefined) {
    await setPlatformSetting("google_api_key", String(body.googleApiKey || "").trim() || null);
  }
  if (body?.deliveryWalletBank !== undefined && body.deliveryWalletBank && typeof body.deliveryWalletBank === "object") {
    const b = body.deliveryWalletBank as Record<string, unknown>;
    const clean = (v: unknown) => String(v || "").trim();
    const bank: WalletBank = {
      bankName: clean(b.bankName), accountType: clean(b.accountType), accountNumber: clean(b.accountNumber),
      rut: clean(b.rut), holder: clean(b.holder), email: clean(b.email), instructions: clean(b.instructions),
    };
    await setWalletBank(bank);
  }
  return NextResponse.json({ ok: true });
}
