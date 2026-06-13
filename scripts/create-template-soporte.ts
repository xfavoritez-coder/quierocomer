import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

async function main() {
  const SID = process.env.TWILIO_ACCOUNT_SID!;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN!;

  if (!SID || !TOKEN) { console.error("Missing TWILIO credentials"); return; }

  // Create template for support follow-up
  const createRes = await fetch("https://content.twilio.com/v1/Content", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      friendly_name: "soporte_contacto_v1",
      language: "es",
      variables: { "1": "nombre" },
      types: {
        "twilio/text": {
          body: "Hola {{1}} 👋\n\nRecibimos tu mensaje en QuieroComer y queremos ayudarte.\n\n¿En qué podemos asistirte? Puedes contarnos por aquí directamente.\n\nEquipo QuieroComer"
        }
      }
    }),
  });
  const template = await createRes.json();
  console.log("Template created:", template.sid);
  console.log("Status:", createRes.status);

  if (!template.sid) { console.log("Error:", template); return; }

  // Submit for WhatsApp approval
  const approvalRes = await fetch(`https://content.twilio.com/v1/Content/${template.sid}/ApprovalRequests/whatsapp`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "soporte_contacto_v1", category: "UTILITY" }),
  });
  const approval = await approvalRes.json();
  console.log("Approval status:", approvalRes.status);
  console.log("Approval:", JSON.stringify(approval));
  console.log("\n=> Template SID:", template.sid);
  console.log("=> Add this SID to the support contact route");
}
main();
