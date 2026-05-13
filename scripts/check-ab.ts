import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const action = process.argv[2];
  if (action === "off") {
    await prisma.abExperiment.update({ where: { slug: "landing-hero" }, data: { isActive: false } });
    console.log("Deactivated");
    await prisma.$disconnect();
    return;
  }
  if (action === "on") {
    await prisma.abExperiment.update({ where: { slug: "landing-hero" }, data: { isActive: true } });
    console.log("Activated");
    await prisma.$disconnect();
    return;
  }

  const exp = await prisma.abExperiment.findUnique({
    where: { slug: "landing-hero" },
    include: { variants: true },
  });
  if (exp) {
    console.log(`${exp.name}: ${exp.variants.length} variants (active: ${exp.isActive})`);
    exp.variants.forEach((v) => console.log(`  [${v.slot}] ${v.text}`));
  } else {
    console.log("NOT FOUND — seeding...");
    await prisma.abExperiment.create({
      data: {
        slug: "landing-hero",
        name: "Landing Page Hero",
        isActive: true,
        variants: {
          create: [
            { slot: "title", text: "Tu carta puede vender mucho más" },
            { slot: "title", text: "¿Cómo se vería tu carta si vendiera sola?" },
            { slot: "title", text: "Tu carta no es el problema. Cómo la muestras, sí." },
            { slot: "subtitle", text: "Transformamos tu carta actual en una experiencia visual que despierta antojo y aumenta tus ventas" },
            { slot: "subtitle", text: "Descúbrelo gratis en segundos" },
            { slot: "subtitle", text: "Te mostramos gratis cómo se vería mejorada" },
            { slot: "cta", text: "Sube tu carta · 60 segundos →" },
            { slot: "cta", text: "Transforma tu carta →" },
            { slot: "cta", text: "Ver cómo queda →" },
          ],
        },
      },
    });
    console.log("Seeded!");
  }
  await prisma.$disconnect();
}
main();
