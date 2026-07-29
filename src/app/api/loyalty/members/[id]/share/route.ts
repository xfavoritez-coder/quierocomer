import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, authErrorResponse } from "@/lib/adminAuth";
import { getMemberForOwner } from "@/lib/loyalty";

// GET /api/loyalty/members/:id/share → link público para que el cliente instale su pase.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const member = await getMemberForOwner(req, id);
    const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin;
    const url = `${base}/fidelidad/pase/${member.id}?t=${member.authToken}`;
    return NextResponse.json({ url });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[Loyalty share]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
