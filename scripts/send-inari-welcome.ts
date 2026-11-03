import { Resend } from "resend";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.prod" });
import { activationWelcomeEmailHtml } from "../src/app/api/preview-email/activation/route";

const resend = new Resend(process.env.RESEND_API_KEY);
const BASE_URL = "https://quierocomer.com";

const html = activationWelcomeEmailHtml({
  ownerName: "María José",
  restaurantName: "Inari Sushi",
  panelLink: `${BASE_URL}/api/panel/demo-auth?slug=inari-sushi`,
  qrLink: `${BASE_URL}/qr/inari-sushi`,
  credentials: { email: "proveedores@inari.cl", password: "inarisushi2026" },
  planLabel: "Premium",
});

async function send() {
  const { data, error } = await resend.emails.send({
    from: "QuieroComer <hola@quierocomer.cl>",
    to: "proveedores@inari.cl",
    subject: "María José, tu carta digital está lista",
    html,
  });
  if (error) { console.error(error); process.exit(1); }
  console.log("Sent:", data?.id);
}
send();
