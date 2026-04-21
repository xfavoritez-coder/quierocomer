import { NextRequest, NextResponse } from "next/server";
import { evaluateSegment } from "@/lib/segments/evaluator";
import {
  checkAdminAuth,
  assertOwnsRestaurant,
  authErrorResponse,
} from "@/lib/adminAuth";

/** Evaluate rules without saving — for live preview */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { restaurantId, rules } = await req.json();
    if (!restaurantId || !rules) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    await assertOwnsRestaurant(req, restaurantId);

    const result = await evaluateSegment(restaurantId, rules);
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.status === 403) return authErrorResponse(e);
    console.error("Segment evaluate error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
