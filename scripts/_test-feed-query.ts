import { prisma } from '../src/lib/prisma'
import { normalizeCategory, isExcludedCategory } from '../app/a/lib/categories'

async function main() {
  const dishes = await prisma.dish.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      photos: { isEmpty: false },
      price: { gt: 0 },
      restaurant: { isActive: true, isDemo: false },
    },
    select: {
      id: true,
      name: true,
      price: true,
      discountPrice: true,
      photos: true,
      dishDiet: true,
      isSpicy: true,
      isGlutenFree: true,
      isLactoseFree: true,
      flavorTags: true,
      category: { select: { name: true, dishType: true } },
      restaurant: { select: { id: true, name: true, slug: true } },
    },
    take: 5000,
  })

  // Filtrar bebidas
  const filtered = dishes.filter(d => !isExcludedCategory(d.category.name) && d.category.dishType !== 'drink')

  const cats = [...new Set(filtered.map(d => normalizeCategory(d.category.name)))].sort()
  const rests = [...new Set(filtered.map(d => d.restaurant.name))].sort()

  console.log('=== FEED QUERY TEST ===')
  console.log('Total platos (con foto, sin bebidas):', filtered.length)
  console.log('Restaurantes:', rests.length)
  rests.forEach(r => console.log('  -', r))
  console.log('Categorías normalizadas:', cats.length)
  cats.forEach(c => console.log('  -', c))

  console.log('\nPrimeros 5 platos:')
  filtered.slice(0, 5).forEach(d => {
    console.log(`  ${d.name} | $${d.price} | ${d.restaurant.name} | ${normalizeCategory(d.category.name)} | foto: ${d.photos[0]?.substring(0, 50)}...`)
  })

  const ofertas = filtered.filter(d => d.discountPrice != null && d.discountPrice < d.price)
  console.log('\nEn oferta:', ofertas.length)

  const veganos = filtered.filter(d => d.dishDiet === 'VEGAN').length
  const vegetarianos = filtered.filter(d => d.dishDiet === 'VEGETARIAN').length
  console.log('Veganos:', veganos, '| Vegetarianos:', vegetarianos)

  // Categorías sin normalizar (las que caen como nombre original)
  const unmapped = filtered
    .map(d => d.category.name)
    .filter(name => !Object.keys(require('../app/a/lib/categories').CATEGORY_MAP).includes(name))
  const unmappedUnique = [...new Set(unmapped)].sort()
  if (unmappedUnique.length > 0) {
    console.log('\nCategorías SIN mapear (usan nombre original):')
    unmappedUnique.forEach(c => {
      const count = unmapped.filter(u => u === c).length
      console.log(`  - "${c}" (${count} platos)`)
    })
  }

  await prisma.$disconnect()
}

main()
