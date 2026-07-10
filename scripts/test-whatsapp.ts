import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  const SID = process.env.TWILIO_ACCOUNT_SID!;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN!;
  const FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
  const TEMPLATE = "HX73cbf24831adf5448d0e4eef6cb84f41";

  console.log("SID:", SID.slice(0, 6) + "...");
  console.log("FROM:", FROM);

  const params = new URLSearchParams({
    From: FROM,
    To: "whatsapp:+56982067333",
    ContentSid: TEMPLATE,
    ContentVariables: JSON.stringify({ "1": "Test", "2": "Restaurante Demo", "3": "https://quierocomer.com/qr/horus" }),
  });

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const data = await res.json();
  console.log("HTTP:", res.status);
  console.log("SID:", data.sid || "none");
  console.log("Status:", data.status);
  if (data.error_code) console.log("Error:", data.error_code, data.error_message);
}
main();
