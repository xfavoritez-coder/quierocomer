import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, authErrorResponse } from "@/lib/adminAuth";
import { getMemberForOwner } from "@/lib/loyalty";

// POST /api/loyalty/members/:id/redeem
// Canjea una recompensa ganada disponible (rewardsRedeemed++). Registra en el ledger.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const member = await getMemberForOwner(req, id);

    const available = member.rewardsEarned - member.rewardsRedeemed;
    if (available <= 0) {
      return NextResponse.json({ error: "El cliente no tiene recompensas disponibles" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.loyaltyTransaction.create({
        data: { memberId: id, type: "REWARD_REDEEM", amount: 1, note: member.program.rewardText },
      });
      return tx.loyaltyMember.update({
        where: { id },
        data: { rewardsRedeemed: { increment: 1 } },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          stamps: true,
          rewardsEarned: true,
          rewardsRedeemed: true,
          enrolledAt: true,
          lastStampAt: true,
        },
      });
    });

    return NextResponse.json({ member: updated });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[Loyalty redeem POST]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
