import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  const total = await p.dish.count({ where: { isActive: true, deletedAt: null } })
  const withPhoto = await p.dish.count({ where: { isActive: true, deletedAt: null, photos: { isEmpty: false } } })
  const withPhotoPrice = await p.dish.count({ where: { isActive: true, deletedAt: null, photos: { isEmpty: false }, price: { gt: 0 } } })
  const rests = await p.restaurant.count({ where: { isActive: true, isDemo: false } })

  const grouped = await p.dish.groupBy({
    by: ['restaurantId'],
    where: { isActive: true, deletedAt: null, photos: { isEmpty: false }, price: { gt: 0 }, restaurant: { isActive: true, isDemo: false } },
    _count: true
  })

  const wFlavors = await p.dish.count({ where: { isActive: true, deletedAt: null, photos: { isEmpty: false }, flavorTags: { isEmpty: false } } })
  const diets = await p.dish.groupBy({ by: ['dishDiet'], where: { isActive: true, deletedAt: null, photos: { isEmpty: false } }, _count: true })
  const onSale = await p.dish.count({ where: { isActive: true, deletedAt: null, photos: { isEmpty: false }, discountPrice: { not: null } } })
  const wIng = await p.dish.count({ where: { isActive: true, deletedAt: null, photos: { isEmpty: false }, dishIngredients: { some: {} } } })
  const rats = await p.dishRating.count()
  const favs = await p.dishFavorite.count()

  const cats = await p.category.groupBy({
    by: ['name'],
    where: { isActive: true, dishes: { some: { isActive: true, deletedAt: null, photos: { isEmpty: false } } } },
    _count: true,
    orderBy: { _count: { name: 'desc' } },
    take: 40
  })

  // Sample dishes
  const samples = await p.dish.findMany({
    where: { isActive: true, deletedAt: null, photos: { isEmpty: false }, price: { gt: 0 }, restaurant: { isActive: true, isDemo: false } },
    select: { name: true, price: true, photos: true, flavorTags: true, dishDiet: true, category: { select: { name: true } }, restaurant: { select: { name: true } } },
    take: 5,
    orderBy: { createdAt: 'desc' }
  })

  const counts = grouped.map(r => r._count).sort((a: number, b: number) => b - a)

  console.log('=== ESTADÍSTICAS PARA EL FEED ===')
  console.log('Platos activos total:', total)
  console.log('Con foto:', withPhoto)
  console.log('Con foto + precio > 0:', withPhotoPrice)
  console.log('Restaurantes activos (no demo):', rests)
  console.log('Restaurantes con platos con foto:', grouped.length)
  console.log('Platos por restaurante (top 15):', counts.slice(0, 15).join(', '))
  console.log('Con flavorTags:', wFlavors)
  console.log('Dietas:', JSON.stringify(diets))
  console.log('En oferta:', onSale)
  console.log('Con ingredientes:', wIng)
  console.log('Ratings:', rats)
  console.log('Favoritos:', favs)
  console.log('\n=== CATEGORÍAS ===')
  cats.forEach((c: any) => console.log(`  ${c.name}: ${c._count}`))
  console.log('\n=== MUESTRA DE PLATOS ===')
  samples.forEach((d: any) => console.log(`  ${d.name} - $${d.price} - ${d.restaurant.name} - ${d.category.name} - fotos:${d.photos.length} - sabores:${d.flavorTags.join(',') || 'ninguno'}`))

  await p.$disconnect()
}

main()
