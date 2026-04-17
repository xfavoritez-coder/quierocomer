import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { localName, contactName, phone, email } = await request.json();

    if (!localName || !contactName || !phone || !email) {
      return NextResponse.json({ error: "Todos los campos son obligatorios" }, { status: 400 });
    }

    // Try Resend
    const resendKey = process.env.RESEND_API_KEY;
    let emailSent = false;

    if (resendKey) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: process.env.FROM_EMAIL || "QuieroComer <noreply@quierocomer.cl>",
            to: "favoritez@gmail.com",
            subject: `🍽 Nueva solicitud de demo — ${localName}`,
            html: `
              <div style="font-family:sans-serif;max-width:500px">
                <h2 style="color:#F4A623">Nueva solicitud de demo</h2>
                <table style="width:100%;border-collapse:collapse">
                  <tr><td style="padding:8px 0;color:#999;width:100px">Local</td><td style="padding:8px 0;font-weight:bold">${localName}</td></tr>
                  <tr><td style="padding:8px 0;color:#999">Contacto</td><td style="padding:8px 0;font-weight:bold">${contactName}</td></tr>
                  <tr><td style="padding:8px 0;color:#999">Teléfono</td><td style="padding:8px 0;font-weight:bold">${phone}</td></tr>
                  <tr><td style="padding:8px 0;color:#999">Email</td><td style="padding:8px 0;font-weight:bold">${email}</td></tr>
                  <tr><td style="padding:8px 0;color:#999">Fecha</td><td style="padding:8px 0">${new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" })}</td></tr>
                </table>
              </div>
            `,
          }),
        });
        if (res.ok) emailSent = true;
        else console.error("Resend error:", await res.text());
      } catch (e) {
        console.error("Resend fetch error:", e);
      }
    }

    // Always log to console as backup
    console.log("📋 DEMO REQUEST:", { localName, contactName, phone, email, emailSent });

    return NextResponse.json({ ok: true, emailSent });
  } catch (error) {
    console.error("Demo request error:", error);
    return NextResponse.json({ error: "Error al enviar" }, { status: 500 });
  }
}
