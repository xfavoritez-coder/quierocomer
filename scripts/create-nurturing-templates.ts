import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const SID = process.env.TWILIO_ACCOUNT_SID!;
const TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const auth = "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64");

async function createAndSubmit(friendlyName: string, body: string, variables: Record<string, string>) {
  console.log(`\n=== Creating: ${friendlyName} ===`);
  console.log(`Body: ${body}\n`);

  const createRes = await fetch("https://content.twilio.com/v1/Content", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      friendly_name: friendlyName,
      language: "es",
      variables,
      types: { "twilio/text": { body } },
    }),
  });
  const template = await createRes.json();

  if (!template.sid) {
    console.log("Error creating:", JSON.stringify(template));
    return null;
  }
  console.log(`Created: ${template.sid}`);

  // Submit for Meta approval
  const approvalRes = await fetch(`https://content.twilio.com/v1/Content/${template.sid}/ApprovalRequests/whatsapp`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ name: friendlyName, category: "UTILITY" }),
  });
  const approval = await approvalRes.json();
  console.log(`Approval submitted: ${approval.status || JSON.stringify(approval)}`);

  return template.sid;
}

async function main() {
  // Template 1: Carta lista, no la revisó
  const sid1 = await createAndSubmit(
    "camila_carta_no_revisada",
    "Hola {{1}}, soy Camila de QuieroComer 👋 Te escribo por la carta de {{2}}, ya está lista pero vi que aún no la revisas. ¿Tienes alguna duda o algo en que te pueda ayudar?",
    { "1": "nombre", "2": "restaurante" },
  );

  // Template 2: Vio carta pero no terminó onboarding
  const sid2 = await createAndSubmit(
    "camila_onboarding_incompleto",
    "Hola {{1}}, soy Camila de QuieroComer 👋 Te escribo por la carta de {{2}}, estuve viendo que no terminaste la presentación. ¿Algo no te gustó o tienes alguna duda? Me encantaría saber para poder ayudarte.",
    { "1": "nombre", "2": "restaurante" },
  );

  // Template 3: Activó pero no volvió a usar
  const sid3 = await createAndSubmit(
    "camila_no_volvio",
    "Hola {{1}}, soy Camila de QuieroComer 👋 Te escribo por la carta de {{2}}, vi que la activaste y está lista pero no la continuaste usando. ¿Habrá algo que no te gustó o tienes alguna duda? Cualquier cosa es bienvenida, nos encantaría saber.",
    { "1": "nombre", "2": "restaurante" },
  );

  console.log("\n=== RESUMEN ===");
  console.log(`camila_carta_no_revisada:     ${sid1 || "FAILED"}`);
  console.log(`camila_onboarding_incompleto: ${sid2 || "FAILED"}`);
  console.log(`camila_no_volvio:             ${sid3 || "FAILED"}`);
  console.log("\nLos templates necesitan aprobación de Meta (24-48h).");
  console.log("Guarda los SIDs para configurarlos en el cron de nurturing.");
}

main().catch(console.error);
