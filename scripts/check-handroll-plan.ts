import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
p.restaurant.findFirst({ where: { slug: "hand-roll" }, select: { plan: true, name: true, cartaTheme: true } }).then((r) => {
  console.log(JSON.stringify(r, null, 2));
  p.$disconnect();
});
