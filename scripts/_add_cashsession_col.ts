import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const stmts = [
    `ALTER TABLE "PosOrder" ADD COLUMN IF NOT EXISTS "cashSessionId" TEXT`,
    `CREATE INDEX IF NOT EXISTS "PosOrder_cashSessionId_idx" ON "PosOrder"("cashSessionId")`,
  ];
  for (const s of stmts) {
    try { await prisma.$executeRawUnsafe(s); console.log("OK  " + s.slice(0, 60)); }
    catch (e) { console.log("ERR " + s.slice(0, 60) + " :: " + (e instanceof Error ? e.message.split("\n")[0] : e)); }
  }
  const col = await prisma.$queryRawUnsafe<any[]>(
    `SELECT column_name FROM information_schema.columns WHERE table_name='PosOrder' AND column_name='cashSessionId'`);
  console.log("Columna presente:", col.length > 0);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
