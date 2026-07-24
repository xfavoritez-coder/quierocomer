import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { sendAdminEmail, planExpiringSoonEmailHtml } from "@/lib/email/sendAdminEmail";
import { buildAutoLoginUrl } from "@/lib/email/autoLoginUrl";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;
  if (!secret || !cronSecret || secret !== cronSecret) {
    const authErr = checkAdminAuth(req);
    if (authErr) return authErr;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const to = body.to || "favoritez@gmail.com";
    const restaurantName = body.restaurantName || "Guff Sushi";
    const planLabel = body.planLabel || "Gold";
    const ownerId = body.ownerId || "test-owner-id";
    const paymentMethod: "transfer" | "online" = body.paymentMethod || "transfer";

    const expiryDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      .toLocaleDateString("es-CL", { day: "numeric", month: "long" });

    const panelLink = buildAutoLoginUrl(BASE_URL, ownerId) + "&redirect=/panel/mi-restaurante";

    const html = planExpiringSoonEmailHtml({
      restaurantName,
      planLabel,
      expiryDate,
      panelLink,
      paymentMethod,
    });

    await sendAdminEmail({
      to,
      subject: `${restaurantName} · Tu plan ${planLabel} vence en 2 días`,
      html,
      purpose: "expiry_in_2_days_test",
    });

    return NextResponse.json({ ok: true, sentTo: to, paymentMethod, expiryDate });
  } catch (e: any) {
    console.error("[test-expiring-soon-email]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
