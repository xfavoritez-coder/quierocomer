import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { processLead } from "../src/lib/extractors/pipeline";

async function main() {
  console.log("Processing Youseppe...");
  const result = await processLead("cmptab49s0016if04w9nskby1");
  console.log("Done!", result);
}
main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
