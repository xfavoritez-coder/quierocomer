import { NextRequest, NextResponse } from "next/server";
import { sendAdminEmail, demoExpiredEmailHtml } from "@/lib/email/sendAdminEmail";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (key !== process.env.SEED_SECRET) return NextResponse.json({ error: "No" }, { status: 401 });

  const html = demoExpiredEmailHtml({
    ownerName: "Jaime",
    restaurantName: "Club de Campo San Fernando",
    slug: "varas-oportus",
    panelUrl: "https://quierocomer.com/panel",
  });

  await sendAdminEmail({
    to: "favoritez@gmail.com",
    subject: "Tu periodo de prueba de Club de Campo San Fernando ha finalizado",
    purpose: "demo_expired_test",
    html,
  });

  return NextResponse.json({ ok: true, sent: "favoritez@gmail.com" });
}
