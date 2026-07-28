import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, authErrorResponse } from "@/lib/adminAuth";
import { getMemberForOwner, parseRewards } from "@/lib/loyalty";
import { isGoogleWalletConfigured, updateGooglePoints } from "@/lib/wallet/google";

// POST /api/loyalty/members/:id/stamp   body: { delta: 1 | -1 }
// Suma o resta un sello (0..stampGoal). Al alcanzar el número de sello de un
// nivel de recompensa, lo registra como ganado en el ledger.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const delta = body.delta === -1 ? -1 : 1;

    const member = await getMemberForOwner(req, id);
    const goal = member.program.stampGoal;
    const rewards = parseRewards(member.program.rewards);

    let stamps = member.stamps;
    let redeemedTiers = [...member.redeemedTiers];
    const earnedTiers: { stamp: number; reward: string }[] = [];

    if (delta === 1) {
      if (stamps >= goal) {
        return NextResponse.json(
          { error: "La tarjeta está completa. Reiníciala para empezar una nueva." },
          { status: 400 },
        );
      }
      stamps += 1;
      // Niveles que se alcanzan justo en este sello
      for (const t of rewards) {
        if (t.stamp === stamps) earnedTiers.push(t);
      }
    } else {
      if (stamps <= 0) {
        return NextResponse.json({ error: "El cliente no tiene sellos que quitar" }, { status: 400 });
      }
      stamps -= 1;
      // Al bajar, un nivel por encima del sello actual deja de estar disponible/canjeado
      redeemedTiers = redeemedTiers.filter((s) => s <= stamps);
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.loyaltyTransaction.create({
        data: { memberId: id, type: delta === 1 ? "STAMP_ADD" : "STAMP_REMOVE", amount: 1 },
      });
      for (const t of earnedTiers) {
        await tx.loyaltyTransaction.create({
          data: { memberId: id, type: "REWARD_EARN", amount: 1, note: `Sello ${t.stamp}: ${t.reward}` },
        });
      }
      return tx.loyaltyMember.update({
        where: { id },
        data: {
          stamps,
          redeemedTiers,
          ...(delta === 1 && { lastStampAt: new Date() }),
        },
        select: memberSelect,
      });
    });

    // Actualiza la tarjeta ya guardada en el wallet (best-effort, no bloquea).
    if (member.googleObjectId && isGoogleWalletConfigured()) {
      try {
        await updateGooglePoints({ id: updated.id, name: updated.name, stamps: updated.stamps, redeemedTiers: updated.redeemedTiers }, member.program);
      } catch (err) {
        console.error("[Loyalty stamp] fallo al sincronizar Google Wallet:", err);
      }
    }

    return NextResponse.json({
      member: updated,
      earnedTiers,
      cardFull: stamps >= goal,
    });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[Loyalty stamp POST]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

const memberSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  stamps: true,
  redeemedTiers: true,
  completedCards: true,
  enrolledAt: true,
  lastStampAt: true,
} as const;
