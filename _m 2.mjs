import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const r = await p.restaurant.findFirst({ where:{slug:"hand-roll"}, select:{id:true} });
await p.restaurant.update({ where:{id:r.id}, data:{ orderingMode:"panel" } });
console.log("hand-roll orderingMode -> panel");
await p.$disconnect();
