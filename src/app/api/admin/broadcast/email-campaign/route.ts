import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export const maxDuration = 120;

const CAMPAIGN_PURPOSE = "pedidos_online_email";
const BATCH_SIZE = 90;

/**
 * POST /api/admin/broadcast/email-campaign
 * Sends the pedidos_online email to the next batch of owners not yet reached.
 * Uses emailLog (purpose = "pedidos_online_email") to track who was already sent.
 * Auth: ?key=SEED_SECRET or admin cookie.
 *
 * Body: { dry?: boolean }  — dry: returns list without sending
 *
 * Cron: runs daily at 14:00 UTC (10:00 Chile) until all owners are reached.
 */
export async function POST(req: NextRequest) {
  const seedSecret = process.env.SEED_SECRET;
  const queryKey = req.nextUrl.searchParams.get("key");
  const adminToken = req.cookies.get("admin_token")?.value;
  const adminId = req.cookies.get("admin_id")?.value;
  const hasAdminAuth = !!(adminToken && adminId);
  const hasSeedAuth = !!(seedSecret && queryKey === seedSecret);
  if (!hasAdminAuth && !hasSeedAuth) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const dry = !!body.dry;

  // 1. Get all owners that have a restaurant (non-demo, non-exempt optional)
  const allOwners = await prisma.restaurantOwner.findMany({
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  const owners = allOwners.filter((o): o is typeof o & { email: string } =>
    o.email !== null && o.email.trim() !== ""
  );

  // 2. Filter out already-sent
  const alreadySent = await prisma.emailLog.findMany({
    where: { purpose: CAMPAIGN_PURPOSE },
    select: { to: true },
  });
  const sentEmails = new Set(alreadySent.map((l) => l.to.toLowerCase()));

  const pending = owners.filter(
    (o) => o.email && !sentEmails.has(o.email.toLowerCase())
  );

  const batch = pending.slice(0, BATCH_SIZE);

  if (dry) {
    return NextResponse.json({
      dry: true,
      total: owners.length,
      sent: sentEmails.size,
      pending: pending.length,
      batchSize: batch.length,
      batch: batch.map((o) => ({ email: o.email, name: o.name })),
    });
  }

  if (batch.length === 0) {
    return NextResponse.json({ ok: true, message: "Todos los owners ya recibieron el correo.", sent: 0, remaining: 0 });
  }

  // 3. Load email HTML
  const htmlTemplate = fs.readFileSync(
    path.join(process.cwd(), "public", "preview-email-pedidos-online.html"),
    "utf8"
  );

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: "Missing RESEND_API_KEY" }, { status: 500 });
  }

  const FROM = process.env.FROM_EMAIL
    ? `QuieroComer <${process.env.FROM_EMAIL}>`
    : "QuieroComer <hola@quierocomer.cl>";

  let sent = 0;
  const errors: string[] = [];

  for (const owner of batch) {
    if (!owner.email) continue;
    const html = htmlTemplate.replace(/\{\{email\}\}/g, encodeURIComponent(owner.email));

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM,
          to: [owner.email],
          subject: "Nueva función: recibe pedidos online con tu nueva página",
          html,
        }),
      });

      if (res.ok) {
        // Log to emailLog
        await prisma.emailLog.create({
          data: { to: owner.email, subject: "pedidos_online_email", purpose: CAMPAIGN_PURPOSE, status: "sent" },
        });
        sent++;
      } else {
        const err = await res.json().catch(() => ({}));
        errors.push(`${owner.email}: ${JSON.stringify(err)}`);
      }
    } catch (e) {
      errors.push(`${owner.email}: ${e instanceof Error ? e.message : "unknown"}`);
    }

    // 100ms throttle to stay within Resend rate limits
    await new Promise((r) => setTimeout(r, 100));
  }

  return NextResponse.json({
    ok: true,
    sent,
    remaining: pending.length - sent,
    total: owners.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
