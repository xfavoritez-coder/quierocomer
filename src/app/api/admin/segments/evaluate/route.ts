import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { evaluateSegment } from "@/lib/segments/evaluator";

/** Evaluate rules without saving — for live preview */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_token")?.value) return NextResponse.json({ error: "Not auth" }, { status: 401 });

  const { restaurantId, rules } = await req.json();
  if (!restaurantId || !rules) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const result = await evaluateSegment(restaurantId, rules);
  return NextResponse.json(result);
}
