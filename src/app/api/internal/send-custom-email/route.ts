import { NextRequest, NextResponse } from "next/server";
import { sendAdminEmail } from "@/lib/email/sendAdminEmail";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/internal/send-custom-email
 * Send a custom email and optionally activate a restaurant.
 * Body: { to, subject, html, activateSlug? }
 */
export async function POST(req: NextRequest) {
  const { to, subject, html, activateSlug } = await req.json();
  if (!to || !subject || !html) return NextResponse.json({ error: "to, subject, html required" }, { status: 400 });

  await sendAdminEmail({ to, subject, html, purpose: "custom" });

  if (activateSlug) {
    await prisma.restaurant.updateMany({ where: { slug: activateSlug }, data: { isDemo: false } });
    await prisma.lead.updateMany({ where: { generatedSlug: activateSlug, activatedAt: null }, data: { activatedAt: new Date(), activated: true } });
  }

  return NextResponse.json({ ok: true, to });
}
