import { NextRequest, NextResponse } from "next/server";
import { classifyDishes, type DishTaxonomyInput } from "@/lib/taxonomy-classify";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const dishes: DishTaxonomyInput[] = body.dishes;

    if (!dishes || dishes.length === 0) {
      return NextResponse.json({ error: "No dishes provided" }, { status: 400 });
    }

    const classifications = await classifyDishes(dishes);
    return NextResponse.json(classifications);
  } catch (e: any) {
    console.error("[classify]", e);
    return NextResponse.json({ error: e.message ?? "Internal error" }, { status: 500 });
  }
}
