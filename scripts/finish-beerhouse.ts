import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const slug = "beer-house-atacama";

  // Mark onboarding as done (was already done before reprocess)
  await p.restaurant.updateMany({
    where: { slug },
    data: { demoOnboardingDone: true },
  });
  console.log("Onboarding restored as done");

  await p.$disconnect();
}
main();
