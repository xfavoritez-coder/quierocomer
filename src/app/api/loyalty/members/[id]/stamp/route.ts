import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, authErrorResponse } from "@/lib/adminAuth";
import { getMemberForOwner } from "@/lib/loyalty";

// POST /api/loyalty/members/:id/stamp   body: { delta: 1 | -1 }
// Suma o resta un sello. Al alcanzar los sellos requeridos, completa una
// recompensa (rewardsEarned++) y reinicia el contador. Registra todo en el ledger.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const delta = body.delta === -1 ? -1 : 1; // por defecto +1

    const member = await getMemberForOwner(req, id);
    const required = member.program.stampsRequired;

    let stamps = member.stamps;
    let rewardsEarned = member.rewardsEarned;
    let rewardCompleted = false;

    if (delta === 1) {
      stamps += 1;
      if (stamps >= required) {
        rewardsEarned += 1;
        stamps -= required; // arrastra el excedente (normalmente 0)
        rewardCompleted = true;
      }
    } else {
      // Quitar sello (corrección). No baja de 0.
      if (stamps <= 0) {
        return NextResponse.json({ error: "El cliente no tiene sellos que quitar" }, { status: 400 });
      }
      stamps -= 1;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Ledger
      await tx.loyaltyTransaction.create({
        data: { memberId: id, type: delta === 1 ? "STAMP_ADD" : "STAMP_REMOVE", amount: 1 },
      });
      if (rewardCompleted) {
        await tx.loyaltyTransaction.create({
          data: { memberId: id, type: "REWARD_EARN", amount: 1, note: member.program.rewardText },
        });
      }
      // Estado del miembro
      return tx.loyaltyMember.update({
        where: { id },
        data: {
          stamps,
          rewardsEarned,
          ...(delta === 1 && { lastStampAt: new Date() }),
        },
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

    return NextResponse.json({ member: updated, rewardCompleted, stampsRequired: required });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403 || e.status === 404) return authErrorResponse(e);
    console.error("[Loyalty stamp POST]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
