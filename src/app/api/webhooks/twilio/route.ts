import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { generateWhatsAppReply } from "@/lib/ai/whatsappAgent";

export const maxDuration = 15;

/**
 * Twilio WhatsApp webhook — receives incoming messages, responds with AI agent.
 * Saves all messages to WhatsAppMessage table.
 */
export async function POST(req: NextRequest) {
  const TWIML_OK = new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    { headers: { "Content-Type": "text/xml" } },
  );

  try {
    const formData = await req.formData();
    const from = formData.get("From")?.toString() || "";
    const body = formData.get("Body")?.toString() || "";
    const profileName = formData.get("ProfileName")?.toString() || "";
    const messageSid = formData.get("MessageSid")?.toString() || undefined;

    const phone = from.replace("whatsapp:", "").trim();
    if (!phone || !body.trim()) return TWIML_OK;

    console.log(`[WA Webhook] From ${phone} (${profileName}): ${body.slice(0, 80)}`);

    // 1. Find linked lead/restaurant by phone
    let leadId: string | undefined;
    let restaurantId: string | undefined;
    let context: any = {};

    const lead = await prisma.lead.findFirst({
      where: { whatsapp: { contains: phone.replace("+", "") } },
      orderBy: { createdAt: "desc" },
      select: { id: true, localName: true, ownerName: true, generatedSlug: true },
    });

    if (lead) {
      leadId = lead.id;
      if (lead.generatedSlug) {
        const rest = await prisma.restaurant.findFirst({
          where: { slug: lead.generatedSlug },
          select: { id: true, name: true, plan: true, slug: true, isDemo: true, isActive: true, _count: { select: { dishes: true } } },
        });
        if (rest) {
          restaurantId = rest.id;
          context = {
            restaurantName: rest.name, plan: rest.plan, slug: rest.slug,
            dishCount: rest._count.dishes, ownerName: lead.ownerName,
            isActive: rest.isActive, isDemo: rest.isDemo,
          };
        }
      }
      if (!context.restaurantName) {
        context = { restaurantName: lead.localName, ownerName: lead.ownerName };
      }
    }

    // 2. Save inbound message
    await (prisma as any).whatsAppMessage.create({
      data: {
        phone, direction: "INBOUND", body: body.trim(),
        leadId, restaurantId, twilioSid: messageSid,
        profileName: profileName || null, status: "received",
      },
    }).catch((e: any) => console.error("[WA Webhook] Save inbound failed:", e));

    // 3. Get conversation history
    const history = await (prisma as any).whatsAppMessage.findMany({
      where: { phone },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { direction: true, body: true },
    });
    const conversationHistory = history.slice(-10).map((m: any) => ({
      role: (m.direction === "INBOUND" ? "user" : "assistant") as "user" | "assistant",
      content: m.body,
    }));

    // 4. Generate AI reply
    const reply = await generateWhatsAppReply(body.trim(), conversationHistory, context);

    // 5. Send reply via Twilio
    let replySid: string | null = null;
    try {
      const SID = process.env.TWILIO_ACCOUNT_SID;
      const TOKEN = process.env.TWILIO_AUTH_TOKEN;
      const FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

      if (SID && TOKEN) {
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
          method: "POST",
          headers: {
            "Authorization": "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ From: FROM, To: from, Body: reply }),
          signal: AbortSignal.timeout(10000),
        });
        const data = await res.json();
        replySid = data.sid || null;
        if (!res.ok) console.error("[WA Webhook] Twilio reply error:", data.message);
      }
    } catch (e) {
      console.error("[WA Webhook] Send reply failed:", e);
    }

    // 6. Save outbound message
    await (prisma as any).whatsAppMessage.create({
      data: {
        phone, direction: "OUTBOUND", body: reply,
        leadId, restaurantId, twilioSid: replySid || undefined,
        status: replySid ? "sent" : "failed",
      },
    }).catch((e: any) => console.error("[WA Webhook] Save outbound failed:", e));

    // 7. Email notification (non-blocking)
    const fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev";
    resend.emails.send({
      from: `QuieroComer WA <${fromEmail}>`,
      to: "favoritez@gmail.com",
      subject: `💬 ${profileName || phone}: ${body.slice(0, 40)}`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:500px;padding:20px">
        <p style="margin:0 0 4px;color:#888;font-size:13px"><strong>${profileName}</strong> (${phone})${context.restaurantName ? ` · ${context.restaurantName}` : ""}</p>
        <div style="background:#f5f5f5;border-radius:12px;padding:14px;margin:8px 0;font-size:15px">${body}</div>
        <div style="background:#d1fae5;border-radius:12px;padding:14px;margin:8px 0;font-size:14px;color:#065f46"><strong>🤖 IA:</strong> ${reply}</div>
      </div>`,
    }).catch(() => {});

    return TWIML_OK;
  } catch (error) {
    console.error("[WA Webhook]", error);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { "Content-Type": "text/xml" } },
    );
  }
}
