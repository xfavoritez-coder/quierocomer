import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  const SID = process.env.TWILIO_ACCOUNT_SID!;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN!;

  for (const sid of ["SMa6d9d7428d4056f18e76b2b708effa2a", "SM2acc7482bc1fa765749d7c66bd23ee4e"]) {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages/${sid}.json`, {
      headers: { "Authorization": "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64") },
    });
    const d = await res.json();
    console.log(`${d.to} | status: ${d.status} | error: ${d.error_code || "none"} | ${d.error_message || ""}`);
  }
}
main();
