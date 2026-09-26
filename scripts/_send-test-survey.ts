import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

async function main() {
  const r = await prisma.restaurant.findFirst({
    where: { name: { contains: "haruna", mode: "insensitive" } },
    select: { id: true, name: true, logoUrl: true, cartaAccentColor: true },
  });
  if (!r) { console.log("No encontrado"); await prisma.$disconnect(); return; }
  console.log("Enviando desde:", r.name);

  const accent = r.cartaAccentColor || "#22c55e";
  const link = `https://quierocomer.com/encuesta/preview_${r.id}`;
  const greeting = "Hola Francisco,";
  const intro = "Nos encantaría conocer tu opinión. Califica tu experiencia del 1 al 5.";

  const html = `
    <div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#222;font-size:15px;line-height:1.6;max-width:520px;margin:0 auto;padding:24px 20px">
      <p style="margin:0 0 14px">Hola Francisco,</p>
      <p style="margin:0 0 16px">Gracias por tu pedido en <strong>${esc(r.name)}</strong>. Nos encantaría conocer tu opinión. Califica tu experiencia del 1 al 5.</p>
      <p style="margin:0 0 18px"><a href="${esc(link)}" style="display:inline-block;padding:12px 28px;background:#16a34a;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px">Dejar mi opinión</a></p>
      <p style="margin:0 0 4px;color:#888;font-size:13px">Si el enlace no funciona, cópialo en tu navegador:</p>
      <p style="margin:0 0 20px;color:#888;font-size:13px;word-break:break-all">${esc(link)}</p>
      <p style="margin:22px 0 0;color:#aaa;font-size:12px;border-top:1px solid #eee;padding-top:14px">${esc(r.name)} · vía QuieroComer</p>
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: "QuieroComer <noreply@quierocomer.cl>",
      to: "favoritez@gmail.com",
      subject: `${r.name} · ¿Cómo estuvo tu pedido?`,
      html,
    }),
  });
  const data = await res.json();
  console.log(res.ok ? "✅ Enviado" : "❌ Error", data);
  await prisma.$disconnect();
}
main();
