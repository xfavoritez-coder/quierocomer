import { prisma } from "@/lib/prisma";
import { getPlatformSetting, setPlatformSetting } from "@/lib/platformSettings";

/** Datos bancarios globales a los que los restaurantes transfieren para recargar saldo. */
export interface WalletBank {
  bankName?: string;
  accountType?: string;
  accountNumber?: string;
  rut?: string;
  holder?: string;
  email?: string;
  instructions?: string;
}

const BANK_KEY = "delivery_wallet_bank";

export async function getWalletBank(): Promise<WalletBank> {
  const raw = await getPlatformSetting(BANK_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw) as WalletBank; } catch { return {}; }
}

export async function setWalletBank(bank: WalletBank): Promise<void> {
  await setPlatformSetting(BANK_KEY, JSON.stringify(bank || {}));
}

export async function getBalance(restaurantId: string): Promise<number> {
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { deliveryBalance: true } });
  return r?.deliveryBalance ?? 0;
}

export async function listTxns(restaurantId: string, limit = 50) {
  return prisma.deliveryWalletTxn.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Cobra `amount` (CLP) del saldo del restaurante de forma atómica.
 * Devuelve { ok:false, insufficient:true } si no alcanza. Registra el movimiento.
 */
export async function chargeWallet(
  restaurantId: string,
  amount: number,
  opts: { type?: string; description?: string; orderId?: string; createdBy?: string } = {},
): Promise<{ ok: boolean; insufficient?: boolean; balance: number }> {
  const amt = Math.max(0, Math.round(amount || 0));
  if (amt === 0) return { ok: true, balance: await getBalance(restaurantId) };
  // Decremento condicional: solo pasa si el saldo alcanza.
  const res = await prisma.restaurant.updateMany({
    where: { id: restaurantId, deliveryBalance: { gte: amt } },
    data: { deliveryBalance: { decrement: amt } },
  });
  if (res.count === 0) return { ok: false, insufficient: true, balance: await getBalance(restaurantId) };
  const balance = await getBalance(restaurantId);
  await prisma.deliveryWalletTxn.create({
    data: { restaurantId, amount: -amt, type: opts.type || "charge", description: opts.description || null, orderId: opts.orderId || null, balanceAfter: balance, createdBy: opts.createdBy || null },
  });
  return { ok: true, balance };
}

/** Recarga `amount` (CLP) al saldo del restaurante (desde el admin). */
export async function topUpWallet(
  restaurantId: string,
  amount: number,
  opts: { type?: string; description?: string; createdBy?: string } = {},
): Promise<{ ok: boolean; balance: number }> {
  const amt = Math.round(amount || 0);
  if (!amt) return { ok: false, balance: await getBalance(restaurantId) };
  const r = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { deliveryBalance: { increment: amt } },
    select: { deliveryBalance: true },
  });
  await prisma.deliveryWalletTxn.create({
    data: { restaurantId, amount: amt, type: opts.type || (amt >= 0 ? "topup" : "adjust"), description: opts.description || null, balanceAfter: r.deliveryBalance, createdBy: opts.createdBy || null },
  });
  return { ok: true, balance: r.deliveryBalance };
}

/** Reembolsa un cargo (ej: courier cancelado) devolviendo el saldo. */
export async function refundWallet(
  restaurantId: string,
  amount: number,
  opts: { description?: string; orderId?: string; createdBy?: string } = {},
): Promise<void> {
  const amt = Math.max(0, Math.round(amount || 0));
  if (!amt) return;
  const r = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { deliveryBalance: { increment: amt } },
    select: { deliveryBalance: true },
  });
  await prisma.deliveryWalletTxn.create({
    data: { restaurantId, amount: amt, type: "refund", description: opts.description || null, orderId: opts.orderId || null, balanceAfter: r.deliveryBalance, createdBy: opts.createdBy || null },
  });
}
