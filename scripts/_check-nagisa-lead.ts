import * as dotenv from "dotenv";
dotenv.config({ path: ".env.prod" });
import { prisma } from "../src/lib/prisma";

async function main() {
  const lead = await prisma.lead.findFirst({
    where: { generatedSlug: "nagisa-sushi-delivery" },
    select: { id: true, generatedSlug: true, panelVisitedAt: true, cartaStatus: true, email: true },
  });
  console.log(lead);
  await prisma.$disconnect();
}
main();
