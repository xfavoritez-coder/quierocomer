import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateWhatsAppReplyWithInsight, compareCartaWithDishes } from "@/lib/ai/whatsappAgent";

export const maxDuration = 25;

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
      select: { id: true, localName: true, ownerName: true, generatedSlug: true, cartaUrl: true, cartaFileUrl: true, cartaType: true, email: true },
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
          // Count sessions in last 7 days to determine if truly active (clients using the QR)
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const recentSessions = await prisma.session.count({
            where: { restaurantId: rest.id, startedAt: { gte: sevenDaysAgo } },
          });
          context = {
            restaurantName: rest.name, plan: rest.plan, slug: rest.slug,
            dishCount: rest._count.dishes, ownerName: lead.ownerName,
            isActive: rest.isActive, isDemo: rest.isDemo,
            recentSessions,
            cartaOriginalUrl: lead.cartaFileUrl || lead.cartaUrl || undefined,
            cartaType: lead.cartaType,
            ownerEmail: lead.email,
          };
        }
      }
      if (!context.restaurantName) {
        context = {
          restaurantName: lead.localName, ownerName: lead.ownerName,
          cartaOriginalUrl: lead.cartaFileUrl || lead.cartaUrl || undefined,
          cartaType: lead.cartaType,
          ownerEmail: lead.email,
        };
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
      select: { direction: true, body: true, createdAt: true },
    });

    // 3b. Detect duplicate messages — skip if same body as previous inbound within 2 min
    const recentInbounds = history.filter((m: any) => m.direction === "INBOUND");
    if (recentInbounds.length >= 2) {
      const prev = recentInbounds[recentInbounds.length - 2];
      const curr = recentInbounds[recentInbounds.length - 1];
      const timeDiff = new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime();
      if (prev.body.trim().toLowerCase() === curr.body.trim().toLowerCase() && timeDiff < 120_000) {
        console.log(`[WA Webhook] Duplicate message detected from ${phone}, skipping AI reply`);
        return TWIML_OK;
      }
    }

    const conversationHistory = history.slice(-10).map((m: any) => ({
      role: (m.direction === "INBOUND" ? "user" : "assistant") as "user" | "assistant",
      content: m.body,
    }));

    // 4. Load bot knowledge base
    let knowledgeEntries: { topic: string; content: string }[] = [];
    try {
      const kRecord = await (prisma as any).statEvent.findFirst({
        where: { eventType: "BOT_KNOWLEDGE" },
        orderBy: { createdAt: "desc" },
        select: { metadata: true },
      });
      const entries = (kRecord?.metadata as any)?.entries || [];
      knowledgeEntries = entries.filter((e: any) => e.enabled !== false);
    } catch {}

    // 4b. Vision comparison — when user complains about prices/dishes being wrong
    const bodyLower = body.toLowerCase();
    const complainsAboutExtraction = /precio.*(mal|diferent|incorrecto|no es|cambi)|plato.*(mal|falt|diferent|no est)|imagen|no son los mismos|mire la imagen|mira la imagen|lo que subi/i.test(bodyLower);
    if (complainsAboutExtraction && context.cartaOriginalUrl && context.cartaType !== "LINK" && restaurantId) {
      try {
        const dishes = await prisma.dish.findMany({
          where: { restaurantId },
          select: { name: true, price: true, category: { select: { name: true } } },
          orderBy: { position: "asc" },
          take: 80,
        });
        const dishList = dishes.map((d: any) => ({ name: d.name, price: d.price, category: d.category?.name || "Sin categoría" }));
        const comparison = await compareCartaWithDishes(context.cartaOriginalUrl, dishList);
        if (comparison) {
          knowledgeEntries.push({
            topic: "Comparacion carta original vs platos extraidos",
            content: `Revisamos la carta original que subio el dueño y la comparamos con lo que extrajimos. Resultado:\n${comparison}\n\nUsa esta info para responder con datos concretos sobre que esta diferente.`,
          });
          console.log(`[WA Webhook] Vision comparison done for ${phone}`);
        }
      } catch (e) {
        console.error("[WA Webhook] Vision comparison failed:", e);
      }
    }

    // 5. Generate AI reply (with insight extraction for sales mode)
    const { reply: rawReply, insight } = await generateWhatsAppReplyWithInsight(body.trim(), conversationHistory, context, knowledgeEntries);

    // 5a. Handle escalation flag
    const shouldEscalate = rawReply.includes("[ESCALATE]");
    const reply = rawReply.replace(/\[ESCALATE\]/gi, "").trim();

    // 5b. Save insight to lead events if present
    if (insight && leadId) {
      prisma.lead.findUnique({ where: { id: leadId }, select: { events: true } }).then(async (l) => {
        if (!l) return;
        const events = Array.isArray(l.events) ? (l.events as any[]) : [];
        events.push({ ts: new Date().toISOString(), action: "agent_insight", insight, inboundMsg: body.trim().slice(0, 100) });
        await prisma.lead.update({ where: { id: leadId }, data: { events: events as any } });
        console.log(`[WA Agent] Insight saved for lead ${leadId}: ${insight}`);
      }).catch(() => {});
    }

    // 6. Send reply via Twilio
    let replySid: string | null = null;
    try {
      const SID = process.env.TWILIO_ACCOUNT_SID;
      const TOKEN = process.env.TWILIO_AUTH_TOKEN;
      const FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+56962183197";

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

    // Escalation: notify owner via WhatsApp when AI detects frustrated customer
    if (shouldEscalate) {
      const SID = process.env.TWILIO_ACCOUNT_SID;
      const TOKEN = process.env.TWILIO_AUTH_TOKEN;
      const FROM_WA = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+56962183197";
      const OWNER_PHONE = "whatsapp:+56999946208";
      if (SID && TOKEN) {
        const alertMsg = `⚠️ Cliente necesita ayuda humana\n\nRestaurante: ${context.restaurantName || "Desconocido"}\nTeléfono: ${phone}\nÚltimo mensaje: ${body.trim().slice(0, 200)}\n\nhttps://quierocomer.cl/admin/whatsapp`;
        fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
          method: "POST",
          headers: {
            "Authorization": "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ From: FROM_WA, To: OWNER_PHONE, Body: alertMsg }),
        }).catch(() => {});
      }
    }

    return TWIML_OK;
  } catch (error) {
    console.error("[WA Webhook]", error);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { "Content-Type": "text/xml" } },
    );
  }
}
