import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";

/**
 * One-shot migration: renombra el alergeno "soja" a "soya" en toda la DB.
 * - Si existe "soja": lo renombra a "soya" (links de ingredientes se mantienen).
 * - Si existen "soja" Y "soya" duplicados: mueve los ingredientes de "soja" a "soya" y borra "soja".
 * - Si solo existe "soya" o ninguno: no-op.
 *
 * Idempotente. Llamar una sola vez (o varias, no rompe nada).
 */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const soja = await prisma.allergen.findFirst({ where: { name: "soja" } });
  const soya = await prisma.allergen.findFirst({ where: { name: "soya" } });

  if (!soja && soya) {
    return NextResponse.json({ ok: true, action: "noop", message: "Ya está como 'soya'" });
  }
  if (!soja && !soya) {
    return NextResponse.json({ ok: true, action: "noop", message: "No existe ni 'soja' ni 'soya'" });
  }

  if (soja && !soya) {
    // Caso simple: solo rename
    await prisma.allergen.update({ where: { id: soja.id }, data: { name: "soya" } });
    return NextResponse.json({ ok: true, action: "renamed", from: "soja", to: "soya" });
  }

  // Caso con ambos: merge ingredientes de soja → soya y borrar soja
  if (soja && soya) {
    const sojaIngs = await prisma.allergen.findUnique({
      where: { id: soja.id },
      include: { ingredients: { select: { id: true } } },
    });
    if (sojaIngs && sojaIngs.ingredients.length > 0) {
      await prisma.allergen.update({
        where: { id: soya.id },
        data: { ingredients: { connect: sojaIngs.ingredients.map(i => ({ id: i.id })) } },
      });
    }
    await prisma.allergen.delete({ where: { id: soja.id } });
    return NextResponse.json({ ok: true, action: "merged", movedIngredients: sojaIngs?.ingredients.length ?? 0 });
  }

  return NextResponse.json({ ok: false, message: "estado inesperado" }, { status: 500 });
}
