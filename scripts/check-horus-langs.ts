import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const r = await p.restaurant.findFirst({
    where: { name: { contains: "horus", mode: "insensitive" } },
    select: { name: true, plan: true, enabledLangs: true, subscriptionStatus: true, defaultView: true },
  });
  console.log(JSON.stringify(r, null, 2));
  await p.$disconnect();
}
main();
