import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// One-time migration endpoint for showcase feature
// Delete after use
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-secret");
  if (secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results: string[] = [];

  // Add isShowcase to Restaurant
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "isShowcase" BOOLEAN NOT NULL DEFAULT false`
    );
    results.push("isShowcase added to Restaurant");
  } catch (e: any) {
    results.push(`isShowcase error: ${e.message}`);
  }

  // Make price nullable in Dish
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Dish" ALTER COLUMN price DROP NOT NULL`
    );
    results.push("price made nullable in Dish");
  } catch (e: any) {
    results.push(`price error: ${e.message}`);
  }

  // Regenerate Prisma client
  return NextResponse.json({ results });
}
