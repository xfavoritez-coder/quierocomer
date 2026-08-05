import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseRewards } from "@/lib/loyalty";
import { isGoogleWalletConfigured, updateGooglePoints } from "@/lib/wallet/google";
import { notifyAppleDevices } from "@/lib/wallet/apns";

// POST /api/loyalty/scan-redeem  body: { memberId, stamp, token, slug }
export async function POST(req: NextRequest) {
  try {
    const { memberId, stamp: stampRaw, token, slug } = await req.json();
    const stamp = Math.round(Number(stampRaw));
    if (!memberId || !token || !slug || !stamp) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!restaurant) return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });

    const program = await prisma.loyaltyProgram.findUnique({
      where: { restaurantId: restaurant.id },
      select: { scanToken: true, scanEnabled: true, rewards: true },
    });

    if (!program?.scanToken || program.scanToken !== token) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }
    if (!program.scanEnabled) {
      return NextResponse.json({ error: "El escáner está desactivado" }, { status: 403 });
    }

    const member = await prisma.loyaltyMember.findUnique({
      where: { id: memberId },
      select: { id: true, name: true, stamps: true, redeemedTiers: true, restaurantId: true, googleObjectId: true },
    });

    if (!member) return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
    if (member.restaurantId !== restaurant.id) return NextResponse.json({ error: "Miembro no pertenece a este local" }, { status: 403 });

    const rewards = parseRewards(program.rewards);
    const tier = rewards.find((t) => t.stamp === stamp);
    if (!tier) return NextResponse.json({ error: "Ese nivel de recompensa no existe" }, { status: 400 });
    if (member.stamps < stamp) return NextResponse.json({ error: "El cliente aún no alcanza ese nivel" }, { status: 400 });
    if (member.redeemedTiers.includes(stamp)) return NextResponse.json({ error: "Esa recompensa ya fue canjeada" }, { status: 400 });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.loyaltyTransaction.create({
        data: { memberId, type: "REWARD_REDEEM", amount: 1, note: `Sello ${tier.stamp}: ${tier.reward}` },
      });
      return tx.loyaltyMember.update({
        where: { id: memberId },
        data: { redeemedTiers: { push: stamp } },
        select: { id: true, name: true, stamps: true, redeemedTiers: true, googleObjectId: true },
      });
    });

    if (updated.googleObjectId && isGoogleWalletConfigured()) {
      try {
        await updateGooglePoints(
          { id: updated.id, name: updated.name, stamps: updated.stamps, redeemedTiers: updated.redeemedTiers },
          { ...program, rewards: parseRewards(program.rewards) } as any,
        );
      } catch {}
    }
    await notifyAppleDevices(memberId);

    return NextResponse.json({ member: updated, reward: tier.reward });
  } catch (e) {
    console.error("[scan-redeem]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
