import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const lead = await p.lead.findFirst({
    where: { localName: { contains: "yume", mode: "insensitive" }, cartaType: "PHOTO" },
    select: { id: true, cartaFileUrl: true, errorLog: true },
  });
  if (lead) {
    console.log("ID:", lead.id);
    console.log("Full URL:", lead.cartaFileUrl);
    console.log("Error:", lead.errorLog);
  }
  await p.$disconnect();
}
main();
