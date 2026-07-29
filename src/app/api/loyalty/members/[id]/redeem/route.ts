import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, authErrorResponse } from "@/lib/adminAuth";
import { getMemberForOwner, parseRewards } from "@/lib/loyalty";
import { isGoogleWalletConfigured, updateGooglePoints } from "@/lib/wallet/google";
import { notifyAppleDevices } from "@/lib/wallet/apns";

// POST /api/loyalty/members/:id/redeem   body: { stamp: number }
// Canjea la recompensa de un nivel ya ganado (stamp <= sellos actuales) y no canjeado.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const stamp = Math.round(Number(body.stamp));

    const member = await getMemberForOwner(req, id);
    const rewards = parseRewards(member.program.rewards);

    const tier = rewards.find((t) => t.stamp === stamp);
    if (!tier) return NextResponse.json({ error: "Ese nivel de recompensa no existe" }, { status: 400 });
    if (member.stamps < stamp) {
      return NextResponse.json({ error: "El cliente aún no alcanza ese nivel" }, { status: 400 });
    }
    if (member.redeemedTiers.includes(stamp)) {
      return NextResponse.json({ error: "Esa recompensa ya fue canjeada" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.loyaltyTransaction.create({
        data: { memberId: id, type: "REWARD_REDEEM", amount: 1, note: `Sello ${tier.stamp}: ${tier.reward}` },
      });
      return tx.loyaltyMember.update({
        where: { id },
        data: { redeemedTiers: { push: stamp } },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          stamps: true,
          redeemedTiers: true,
          completedCards: true,
          enrolledAt: true,
          lastStampAt: true,
        },
      });
    });

    // Refresca la tarjeta en ambos wallets (best-effort)
    if (member.googleObjectId && isGoogleWalletConfigured()) {
      try {
        await updateGooglePoints({ id: updated.id, name: updated.name, stamps: updated.stamps, redeemedTiers: updated.redeemedTiers }, member.program);
      } catch (err) {
        console.error("[Loyalty redeem] fallo al sincronizar Google Wallet:", err);
      }
    }
    await notifyAppleDevices(id);

    return NextResponse.json({ member: updated });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[Loyalty redeem POST]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
