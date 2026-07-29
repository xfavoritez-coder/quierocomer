import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, authErrorResponse } from "@/lib/adminAuth";
import { getMemberForOwner } from "@/lib/loyalty";
import { notifyAppleDevices } from "@/lib/wallet/apns";
import { isGoogleWalletConfigured, expireGoogleObject } from "@/lib/wallet/google";

export const runtime = "nodejs";

// DELETE /api/loyalty/members/:id  → revoca el pase (anula Apple, expira Google, lo saca de la lista)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const member = await getMemberForOwner(req, id);

    // Marcar revocado (esto anula el pase de Apple en la próxima actualización)
    await prisma.loyaltyMember.update({ where: { id }, data: { revoked: true } });

    // Apple: notificar para que el teléfono baje el pase anulado (voided)
    await notifyAppleDevices(id);

    // Google: expirar el objeto
    if (member.googleObjectId && isGoogleWalletConfigured()) {
      try {
        await expireGoogleObject(member.googleObjectId);
      } catch (e) {
        console.error("[Loyalty delete] Google expire:", e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[Loyalty member DELETE]", e);
    return NextResponse.json({ error: "Error al revocar" }, { status: 500 });
  }
}
