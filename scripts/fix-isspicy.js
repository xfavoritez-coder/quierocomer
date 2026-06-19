/**
 * fix-isspicy.js
 * Recomputa isSpicy para todos los platos que actualmente tienen isSpicy: true.
 *
 * Lógica:
 *  1. Si category.dishType es 'dessert' o 'drink' → false
 *  2. Si nombre o descripción contiene patron de picante → true
 *  3. Cualquier otro caso → false
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL,
    },
  },
});

// Patrones que indican picante (aplicados sobre nombre + descripción en minúsculas)
const SPICY_PATTERNS = [
  /spicy/i,
  /salsa spicy/i,
  /\bají\b/i,
  /\bpicante\b/i,
  /\bchipotle\b/i,
  /\bjalapeño\b/i,
  /\bsriracha\b/i,
  /\bdiabla\b/i,
  /\bmacha\b/i,
  // "hot" solo si NO es "hot dog"
  /\bhot\b(?!\s*dog)/i,
  /\bchorizo\b/i,
  /\bcurry\b/i,
  /\bbufalo\b/i,
  /\bbúfalo\b/i,
  /kimchi/i,
  /\bpeppercorn\b/i,
];

// Tipos de plato que nunca son picantes
const NON_SPICY_DISH_TYPES = ['dessert', 'drink'];

function matchesSpicyPattern(text) {
  if (!text) return false;
  return SPICY_PATTERNS.some((re) => re.test(text));
}

async function main() {
  console.log('Cargando platos con isSpicy: true...');

  const dishes = await prisma.dish.findMany({
    where: {
      isSpicy: true,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      description: true,
      category: {
        select: {
          dishType: true,
        },
      },
    },
  });

  console.log(`Total platos con isSpicy: true → ${dishes.length}`);

  const keepTrue = [];
  const setFalse = [];

  for (const dish of dishes) {
    const dishType = dish.category?.dishType ?? 'food';

    // Regla 1: postres y bebidas nunca son picantes
    if (NON_SPICY_DISH_TYPES.includes(dishType)) {
      setFalse.push({ id: dish.id, name: dish.name, reason: `dishType=${dishType}` });
      continue;
    }

    // Regla 2: buscar patrones en nombre + descripción
    const combined = `${dish.name} ${dish.description ?? ''}`;
    if (matchesSpicyPattern(combined)) {
      keepTrue.push({ id: dish.id, name: dish.name });
    } else {
      setFalse.push({ id: dish.id, name: dish.name, reason: 'sin patrón picante' });
    }
  }

  console.log(`\n  Permanecen en true : ${keepTrue.length}`);
  console.log(`  Se ponen en false  : ${setFalse.length}`);

  // Mostrar muestra de los que quedan en true
  console.log('\n--- Muestra de los que quedan en true (primeros 20) ---');
  keepTrue.slice(0, 20).forEach((d) => console.log(`  [true]  ${d.name}`));

  // Mostrar muestra de los que pasan a false
  console.log('\n--- Muestra de los que pasan a false (primeros 20) ---');
  setFalse.slice(0, 20).forEach((d) => console.log(`  [false] ${d.name} (${d.reason})`));

  if (setFalse.length === 0) {
    console.log('\nNada que actualizar.');
    return;
  }

  // Update en lotes de 500
  const ids = setFalse.map((d) => d.id);
  const BATCH = 500;
  let updated = 0;

  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const result = await prisma.dish.updateMany({
      where: { id: { in: batch } },
      data: { isSpicy: false },
    });
    updated += result.count;
    console.log(`  Lote ${Math.floor(i / BATCH) + 1}: actualizados ${result.count} platos`);
  }

  console.log(`\nActualizacion completada. Total puestos en false: ${updated}`);
  console.log(`Total que permanecen en true: ${keepTrue.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
