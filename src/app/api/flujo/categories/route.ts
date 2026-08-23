import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedDefaultCategories } from "@/lib/defaultFinancialCategories";

const HORUS_ID = "cmo31qnls0000k004o6ry1wgq";

export async function GET() {
  // Auto-seed si no hay categorías aún
  const count = await prisma.financialCategory.count({ where: { restaurantId: HORUS_ID } });
  if (count === 0) await seedDefaultCategories(prisma, HORUS_ID);

  const categories = await prisma.financialCategory.findMany({
    where: { restaurantId: HORUS_ID, isActive: true },
    orderBy: [{ type: "asc" }, { group: "asc" }, { position: "asc" }],
  });
  return NextResponse.json(categories);
}
