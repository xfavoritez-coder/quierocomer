import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const logs = await prisma.cronLog.findMany({
    where: { jobName: { startsWith: "meta-ads" } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { jobName: true, status: true, details: true, error: true, createdAt: true, durationMs: true },
  });
  console.log(JSON.stringify(logs, null, 2));
  await prisma.$disconnect();
}
main().catch(console.error);
