import { MercadoPagoConfig, PreApproval } from "mercadopago";

async function main() {
  const config = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! });
  const client = new PreApproval(config);
  
  // Search for subscriptions with our restaurant as external reference
  const result = await client.search({
    options: {
      external_reference: "cmpmkozub0000l504pod0da21",
    },
  });
  
  console.log("Suscripciones encontradas:", result.results?.length);
  for (const sub of result.results || []) {
    console.log({
      id: sub.id,
      status: sub.status,
      payer_email: sub.payer_email,
      reason: sub.reason,
      external_reference: sub.external_reference,
      next_payment_date: sub.next_payment_date,
      auto_recurring: sub.auto_recurring,
    });
  }
}

main().catch(console.error);
