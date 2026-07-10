/**
 * Envía emails de prueba: activación y renovación de plan.
 * Usage: npx tsx scripts/test-plan-activated-email.ts favoritez@gmail.com
 */
import { Resend } from "resend";
import { planActivatedEmailHtml, monthlyRenewalEmailHtml } from "../src/lib/email/sendAdminEmail";

const RESEND_KEY = "re_ajzpTw1K_mwoBrBZkhsf8K9EQp9crTKV9";
const FROM = "QuieroComer <noreply@quierocomer.com>";
const to = process.argv[2] || "favoritez@gmail.com";
const type = process.argv[3] || "renewal"; // "activation" | "renewal"

async function main() {
  const resend = new Resend(RESEND_KEY);

  if (type === "activation") {
    const html = planActivatedEmailHtml(
      "Sebastián", "Entre Pisco y Pebre", "Premium",
      "$53.431 CLP", "1 de agosto de 2026", "$53.431 CLP",
      "https://quierocomer.com/panel", "https://quierocomer.com/qr/entre-pisco-y-pebre",
    );
    const { error } = await resend.emails.send({ from: FROM, to, subject: "Entre Pisco y Pebre · Plan Premium activado", html });
    if (error) { console.error(error); process.exit(1); }
    console.log(`✅ Email ACTIVACIÓN enviado a ${to}`);
  } else {
    const html = monthlyRenewalEmailHtml(
      "Sebastián", "Entre Pisco y Pebre", "Premium",
      "$53.431 CLP", "1 de agosto de 2026",
      "https://quierocomer.com/panel", "https://quierocomer.com/qr/entre-pisco-y-pebre",
    );
    const { error } = await resend.emails.send({ from: FROM, to, subject: "Entre Pisco y Pebre · Plan Premium renovado", html });
    if (error) { console.error(error); process.exit(1); }
    console.log(`✅ Email RENOVACIÓN enviado a ${to}`);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
