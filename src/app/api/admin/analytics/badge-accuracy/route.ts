import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";

/**
 * Badge accuracy stub — Toteat integration removed.
 * Returns empty data structure so the frontend handles it gracefully.
 */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  return NextResponse.json({ hasData: false });
}
