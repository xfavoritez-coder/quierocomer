import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { sendAdminEmail, graceExpiryWarningEmailHtml } from "@/lib/email/sendAdminEmail";
import { buildAutoLoginUrl } from "@/lib/email/autoLoginUrl";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json().catch(() => ({}));
    const to = body.to || "favoritez@gmail.com";
    const restaurantName = body.restaurantName || "Guff Sushi";
    const planLabel = body.planLabel || "Gold";
    const ownerId = body.ownerId || "test-owner-id";
    const paymentMethod: "transfer" | "online" = body.paymentMethod || "online";

    const now = new Date();
    const expiryDate = now.toLocaleDateString("es-CL", { day: "numeric", month: "long" });

    const panelLink = buildAutoLoginUrl(BASE_URL, ownerId) + "&redirect=/panel/mi-restaurante";

    const html = graceExpiryWarningEmailHtml({
      restaurantName,
      planLabel,
      expiryDate,
      panelLink,
      paymentMethod,
    });

    await sendAdminEmail({
      to,
      subject: `⚠️ ${restaurantName} · Tu carta QR se desactiva mañana`,
      html,
      purpose: "grace_expiry_warning_test",
    });

    return NextResponse.json({ ok: true, sentTo: to, paymentMethod });
  } catch (e: any) {
    console.error("[test-grace-email]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
