import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("qr_user_id")?.value;
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json();

  // Standard user field updates
  const user = await prisma.qRUser.update({
    where: { id: userId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.birthDate !== undefined && { birthDate: body.birthDate ? new Date(body.birthDate) : null }),
      ...(body.dietType !== undefined && { dietType: body.dietType }),
      ...(body.restrictions !== undefined && { restrictions: body.restrictions }),
      ...(body.dislikes !== undefined && { dislikes: body.dislikes }),
    },
  });

  // Ingredient feedback: confirm (+20 boost) or reject (remove + add to dislikes)
  if (body.confirmedIngredients?.length || body.rejectedIngredients?.length) {
    const guest = await prisma.guestProfile.findFirst({
      where: { linkedQrUserId: userId },
      select: { id: true, favoriteIngredients: true },
      orderBy: { lastSeenAt: "desc" },
    });

    if (guest) {
      const favs = (guest.favoriteIngredients as Record<string, number>) || {};

      // Boost confirmed ingredients
      if (body.confirmedIngredients?.length) {
        for (const ing of body.confirmedIngredients) {
          if (favs[ing] !== undefined) favs[ing] += 20;
        }
      }

      // Remove rejected ingredients from favorites
      if (body.rejectedIngredients?.length) {
        for (const ing of body.rejectedIngredients) {
          delete favs[ing];
        }
        // Add rejected to dislikes (deduplicated)
        const currentDislikes = user.dislikes || [];
        const newDislikes = [...new Set([...currentDislikes, ...body.rejectedIngredients])];
        await prisma.qRUser.update({
          where: { id: userId },
          data: { dislikes: newDislikes },
        });
      }

      await prisma.guestProfile.update({
        where: { id: guest.id },
        data: { favoriteIngredients: favs },
      });
    }
  }

  return NextResponse.json({ user });
}
