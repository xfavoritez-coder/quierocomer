import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const soja = await prisma.allergen.findFirst({ where: { name: "soja" } });
  const soya = await prisma.allergen.findFirst({ where: { name: "soya" } });

  if (!soja && soya) {
    console.log("noop: ya está como 'soya'");
    return;
  }
  if (!soja && !soya) {
    console.log("noop: no existe ni 'soja' ni 'soya'");
    return;
  }

  if (soja && !soya) {
    await prisma.allergen.update({ where: { id: soja.id }, data: { name: "soya" } });
    console.log("renamed: soja → soya");
    return;
  }

  if (soja && soya) {
    const sojaIngs = await prisma.allergen.findUnique({
      where: { id: soja.id },
      include: { ingredients: { select: { id: true } } },
    });
    if (sojaIngs && sojaIngs.ingredients.length > 0) {
      await prisma.allergen.update({
        where: { id: soya.id },
        data: { ingredients: { connect: sojaIngs.ingredients.map((i) => ({ id: i.id })) } },
      });
      console.log(`merged: ${sojaIngs.ingredients.length} ingredientes movidos de soja a soya`);
    }
    await prisma.allergen.delete({ where: { id: soja.id } });
    console.log("merged: alergeno 'soja' eliminado, todo unificado a 'soya'");
    return;
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
