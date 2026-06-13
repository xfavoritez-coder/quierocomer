import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

async function main() {
  const SID = process.env.TWILIO_ACCOUNT_SID!;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN!;
  const auth = "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64");

  // Delete old template
  console.log("Deleting old template...");
  const del = await fetch("https://content.twilio.com/v1/Content/HXdb8e461a43a60ba9b75f9064605364cc", {
    method: "DELETE",
    headers: { Authorization: auth },
  });
  console.log("Delete status:", del.status);

  // Create new template
  console.log("\nCreating new template...");
  const createRes = await fetch("https://content.twilio.com/v1/Content", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      friendly_name: "soporte_contacto_v2",
      language: "es",
      variables: { "1": "nombre" },
      types: {
        "twilio/text": {
          body: "Hola {{1}}, te habla Camila de QuieroComer 😊\n\nRecibimos tu mensaje sobre nuestro servicio de carta QR inteligente.\n\n¿En qué te puedo ayudar?"
        }
      }
    }),
  });
  const template = await createRes.json();
  console.log("Template SID:", template.sid);
  console.log("Status:", createRes.status);
  if (!template.sid) { console.log("Error:", template); return; }

  // Submit for approval
  console.log("\nSubmitting for approval...");
  const approvalRes = await fetch(`https://content.twilio.com/v1/Content/${template.sid}/ApprovalRequests/whatsapp`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "soporte_contacto_v2", category: "UTILITY" }),
  });
  const approval = await approvalRes.json();
  console.log("Approval:", approval.status, approvalRes.status);
  console.log("\n=> NEW SID:", template.sid);
}
main();
