const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const c = await p.ingredient.count({ where: { nameEn: { not: null } } });
  const t = await p.ingredient.count();
  console.log("Translated:", c, "of", t);
  const u = await p.ingredient.findMany({ where: { nameEn: null }, select: { name: true } });
  if (u.length) console.log("Untranslated:", u.map(i => i.name).join(", "));
  await p.$disconnect();
})();
