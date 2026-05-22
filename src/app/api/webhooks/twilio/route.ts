import { NextRequest, NextResponse } from "next/server";
import { resend } from "@/lib/resend";

/**
 * Twilio WhatsApp webhook — receives incoming messages from restaurant owners.
 * Sends email notification to admin and responds with auto-reply.
 * Configure in Twilio: Messaging → WhatsApp Senders → Webhook URL
 * URL: https://quierocomer.cl/api/webhooks/twilio
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const from = formData.get("From")?.toString() || "";
    const body = formData.get("Body")?.toString() || "";
    const profileName = formData.get("ProfileName")?.toString() || "";
    const numMedia = parseInt(formData.get("NumMedia")?.toString() || "0", 10);

    const phone = from.replace("whatsapp:", "");
    console.log(`[Twilio Webhook] Message from ${phone} (${profileName}): ${body.slice(0, 100)}`);

    // Send email notification
    const fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev";
    await resend.emails.send({
      from: `QuieroComer WhatsApp <${fromEmail}>`,
      to: "favoritez@gmail.com",
      subject: `💬 WhatsApp de ${profileName || phone}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:500px;padding:20px">
          <h3 style="margin:0 0 8px;color:#22c55e">Mensaje de WhatsApp</h3>
          <p style="margin:0 0 4px;color:#888;font-size:13px"><strong>De:</strong> ${profileName} (${phone})</p>
          <div style="background:#f5f5f5;border-radius:12px;padding:16px;margin:12px 0;font-size:15px;line-height:1.5">
            ${body || "(sin texto)"}
            ${numMedia > 0 ? `<br><em style="color:#888">${numMedia} archivo(s) adjunto(s)</em>` : ""}
          </div>
          <p style="color:#888;font-size:12px;margin:0">Responde desde <a href="https://console.twilio.com" style="color:#3b82f6">Twilio Console</a></p>
        </div>
      `,
    }).catch((err) => console.error("[Twilio Webhook] Email notification failed:", err));

    // Respond with TwiML (empty response = no auto-reply)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { "Content-Type": "text/xml" } },
    );
  } catch (error) {
    console.error("[Twilio Webhook]", error);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { "Content-Type": "text/xml" } },
    );
  }
}
