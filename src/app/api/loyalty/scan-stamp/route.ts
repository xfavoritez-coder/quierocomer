import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseRewards } from "@/lib/loyalty";
import { isGoogleWalletConfigured, updateGooglePoints } from "@/lib/wallet/google";
import { notifyAppleDevices } from "@/lib/wallet/apns";

// POST /api/loyalty/scan-stamp  body: { memberId, token, slug }
export async function POST(req: NextRequest) {
  try {
    const { memberId, token, slug } = await req.json();
    if (!memberId || !token || !slug) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!restaurant) return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });

    const program = await prisma.loyaltyProgram.findUnique({
      where: { restaurantId: restaurant.id },
      select: { scanToken: true, scanEnabled: true, stampGoal: true, rewards: true },
    });

    if (!program?.scanToken || program.scanToken !== token) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }
    if (!program.scanEnabled) {
      return NextResponse.json({ error: "El escáner está desactivado" }, { status: 403 });
    }

    const member = await prisma.loyaltyMember.findUnique({
      where: { id: memberId },
      include: { program: { select: { restaurantId: true } } },
    });

    if (!member) return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
    if (member.restaurantId !== restaurant.id) return NextResponse.json({ error: "Miembro no pertenece a este local" }, { status: 403 });

    const goal = program.stampGoal;
    const rewards = parseRewards(program.rewards);

    if (member.stamps >= goal) {
      return NextResponse.json({ error: "La tarjeta está completa. Reiníciala para empezar una nueva." }, { status: 400 });
    }

    const stamps = member.stamps + 1;
    const earnedTiers: { stamp: number; reward: string }[] = [];
    for (const t of rewards) {
      if (t.stamp === stamps) earnedTiers.push(t);
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.loyaltyTransaction.create({
        data: { memberId, type: "STAMP_ADD", amount: 1 },
      });
      for (const t of earnedTiers) {
        await tx.loyaltyTransaction.create({
          data: { memberId, type: "REWARD_EARN", amount: 1, note: `Sello ${t.stamp}: ${t.reward}` },
        });
      }
      return tx.loyaltyMember.update({
        where: { id: memberId },
        data: { stamps, lastStampAt: new Date() },
        select: { id: true, name: true, stamps: true, redeemedTiers: true, googleObjectId: true },
      });
    });

    // Wallet updates (best-effort)
    if (updated.googleObjectId && isGoogleWalletConfigured()) {
      try {
        await updateGooglePoints(
          { id: updated.id, name: updated.name, stamps: updated.stamps, redeemedTiers: updated.redeemedTiers },
          { ...program, rewards: parseRewards(program.rewards) } as any,
        );
      } catch {}
    }
    await notifyAppleDevices(memberId);

    return NextResponse.json({ member: updated, earnedTiers, goal, cardFull: stamps >= goal });
  } catch (e) {
    console.error("[scan-stamp]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
