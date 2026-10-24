import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import { getBalance, listTxns, topUpWallet } from "@/lib/ecommerce/deliveryWallet";

export const runtime = "nodejs";

/** GET → { balance, txns } del saldo de delivery de un local. Solo superadmin. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  const { id } = await params;
  const [balance, txns] = await Promise.all([getBalance(id), listTxns(id, 60)]);
  return NextResponse.json({ balance, txns });
}

/** POST { amount, note? } → recarga (o ajusta) el saldo del local. Solo superadmin.
 *  amount en CLP; puede ser negativo para un ajuste a la baja. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const amount = Math.round(Number(body?.amount) || 0);
  const note = (body?.note || "").toString().trim().slice(0, 200) || null;
  if (!amount) return NextResponse.json({ error: "Monto inválido" }, { status: 400 });

  const res = await topUpWallet(id, amount, {
    type: amount >= 0 ? "topup" : "adjust",
    description: note || (amount >= 0 ? "Recarga manual (admin)" : "Ajuste manual (admin)"),
    createdBy: "admin",
  });
  return NextResponse.json({ ok: true, balance: res.balance });
}
