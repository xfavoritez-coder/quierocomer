import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
await p.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "ecommerceAccompaniments" JSONB`);
console.log("columna ecommerceAccompaniments agregada");
await p.$disconnect();
