import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { compileProfile } from "@/lib/qr/utils/compileProfile";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const restaurantId = searchParams.get("restaurantId");
  const guestId = searchParams.get("guestId");

  if (!restaurantId) {
    return NextResponse.json({ profile: null });
  }

  const cookieStore = await cookies();
  const qrUserId = cookieStore.get("qr_user_id")?.value || null;

  if (!qrUserId && !guestId) {
    return NextResponse.json({ profile: null });
  }

  const profile = await compileProfile(qrUserId, guestId, restaurantId);
  return NextResponse.json({ profile });
}
