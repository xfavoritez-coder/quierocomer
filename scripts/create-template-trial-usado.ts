import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const SID = process.env.TWILIO_ACCOUNT_SID!;
const TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const auth = "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64");

async function main() {
  console.log("=== Creating: camila_trial_usado ===");

  const createRes = await fetch("https://content.twilio.com/v1/Content", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      friendly_name: "camila_trial_usado",
      language: "es",
      variables: { "1": "nombre", "2": "restaurante" },
      types: {
        "twilio/text": {
          body: "Hola {{1}}, soy Camila de QuieroComer 👋 Vi que estuviste usando la carta de {{2}} durante tus días de Premium. ¿Qué te pareció? Si tienes alguna duda sobre los planes o necesitas ayuda con algo me escribes."
        }
      }
    }),
  });
  const template = await createRes.json();

  if (!template.sid) { console.log("Error:", JSON.stringify(template)); return; }
  console.log(`Created: ${template.sid}`);

  const approvalRes = await fetch(`https://content.twilio.com/v1/Content/${template.sid}/ApprovalRequests/whatsapp`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "camila_trial_usado", category: "UTILITY" }),
  });
  const approval = await approvalRes.json();
  console.log(`Approval: ${approval.status || JSON.stringify(approval)}`);
  console.log(`\nSID: ${template.sid}`);
}

main().catch(console.error);
