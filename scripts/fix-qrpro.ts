import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  await p.menuProvider.update({
    where: { id: "cmpgzrfbv0003ju04jagkcny6" },
    data: {
      extractionConfig: {
        useJina: true,
        maxContentChars: 40000,
      },
    },
  });
  console.log("Updated QRPro: useJina=true (Jina compresses 800KB HTML → 36KB markdown)");

  console.log("Done.");
  await p.$disconnect();
}
main();
