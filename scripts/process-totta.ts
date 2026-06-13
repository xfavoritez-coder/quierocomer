import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { processLead } from "../src/lib/extractors/pipeline";

async function main() {
  console.log("Processing La Totta...");
  const result = await processLead("cmpu7bkb4000ijr04b22qx37d");
  console.log("Done!", result);
}
main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
