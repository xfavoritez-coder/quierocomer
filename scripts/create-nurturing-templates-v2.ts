const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;

if (!SID || !TOKEN) {
  console.error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN");
  process.exit(1);
}

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
  const sid1 = await createAndSubmit(
    "camila_carta_no_revisada_v2",
    "Hola {{1}}, soy Camila de QuieroComer. Hace unos días subiste la carta de {{2}} y ya está lista. ¿Necesitas ayuda o tuviste algún problema?",
    { "1": "nombre", "2": "restaurante" },
  );

  const sid2 = await createAndSubmit(
    "camila_no_volvio_v2",
    "Hola {{1}}, soy Camila de QuieroComer. Vi que activaste la carta de {{2}} pero no la seguiste usando. ¿Paso algo o necesitas ayuda con algo?",
    { "1": "nombre", "2": "restaurante" },
  );

  const sid3 = await createAndSubmit(
    "camila_trial_usado_v2",
    "Hola {{1}}, soy Camila de QuieroComer. Tu prueba de Premium en {{2}} terminó y volvió al plan gratis. Si tienes dudas sobre los planes para no perder algunas funciones, me dices y te ayudo con gusto.",
    { "1": "nombre", "2": "restaurante" },
  );

  console.log("\n=== RESUMEN ===");
  console.log(`camila_carta_no_revisada_v2:  ${sid1 || "FAILED"}`);
  console.log(`camila_no_volvio_v2:          ${sid2 || "FAILED"}`);
  console.log(`camila_trial_usado_v2:        ${sid3 || "FAILED"}`);
  console.log("\nLos templates necesitan aprobación de Meta (24-48h).");
  console.log("Cuando estén aprobados, actualiza los SIDs en nurturing/route.ts y send-message/route.ts");
}

main().catch(console.error);
