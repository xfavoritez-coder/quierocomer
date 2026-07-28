import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, authErrorResponse } from "@/lib/adminAuth";
import { getMemberForOwner } from "@/lib/loyalty";
import { isGoogleWalletConfigured, updateGooglePoints } from "@/lib/wallet/google";

// POST /api/loyalty/members/:id/reset
// Reinicia la tarjeta del cliente: sellos a 0, niveles canjeados a vacío,
// e incrementa el contador de tarjetas completadas.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const member = await getMemberForOwner(req, id);

    const wasComplete = member.stamps >= member.program.stampGoal;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.loyaltyTransaction.create({
        data: { memberId: id, type: "STAMP_REMOVE", amount: member.stamps, note: "Reinicio de tarjeta" },
      });
      return tx.loyaltyMember.update({
        where: { id },
        data: {
          stamps: 0,
          redeemedTiers: [],
          ...(wasComplete && { completedCards: { increment: 1 } }),
        },
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

    if (member.googleObjectId && isGoogleWalletConfigured()) {
      try {
        await updateGooglePoints({ id: updated.id, name: updated.name, stamps: updated.stamps, redeemedTiers: updated.redeemedTiers }, member.program);
      } catch (err) {
        console.error("[Loyalty reset] fallo al sincronizar Google Wallet:", err);
      }
    }

    return NextResponse.json({ member: updated });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[Loyalty reset POST]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
