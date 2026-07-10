import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  const SID = process.env.TWILIO_ACCOUNT_SID!;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN!;

  // Create template
  const createRes = await fetch("https://content.twilio.com/v1/Content", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      friendly_name: "carta_necesita_ayuda_v2",
      language: "es",
      variables: { "1": "nombre" },
      types: {
        "twilio/text": {
          body: "Hola {{1}}\n\nNo pudimos procesar tu carta desde el link que nos compartiste.\n\nPuedes subir fotos de tu carta o el PDF directamente aqui:\nhttps://quierocomer.com/subircarta\n\nCualquier duda estamos para ayudarte.\nQuieroComer.cl"
        }
      }
    }),
  });
  const template = await createRes.json();
  console.log("Template SID:", template.sid);
  console.log("Status:", createRes.status);

  if (!template.sid) { console.log("Error:", template); return; }

  // Submit for approval
  const approvalRes = await fetch(`https://content.twilio.com/v1/Content/${template.sid}/ApprovalRequests/whatsapp`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "carta_necesita_ayuda_v2", category: "UTILITY" }),
  });
  const approval = await approvalRes.json();
  console.log("Approval status:", approval.status);
  console.log("Full SID:", template.sid);
}
main();
