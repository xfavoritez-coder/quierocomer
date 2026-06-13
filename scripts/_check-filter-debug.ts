import { prisma } from '../src/lib/prisma'
import { normalizeCategory, isExcludedCategory, inferMealTime } from '../src/app/a/lib/categories'

async function main() {
  const dishes = await prisma.dish.findMany({
    where: { isActive: true, deletedAt: null, photos: { isEmpty: false }, price: { gt: 0 }, restaurant: { isActive: true, isDemo: false } },
    select: { id: true, name: true, category: { select: { name: true, dishType: true } } },
    take: 5000,
  })

  // Simulate what FeedApp does
  const feedDishes = dishes
    .filter(d => !isExcludedCategory(d.category.name))
    .map(d => ({
      name: d.name,
      categoriaTipo: d.category.dishType,
      categoriaNorm: normalizeCategory(d.category.name),
      mealTime: inferMealTime(normalizeCategory(d.category.name)),
      catOriginal: d.category.name,
    }))

  console.log('Total feed dishes:', feedDishes.length)

  // Group by categoriaTipo
  const byType: Record<string, number> = {}
  feedDishes.forEach(d => { byType[d.categoriaTipo] = (byType[d.categoriaTipo] || 0) + 1 })
  console.log('By categoriaTipo:', byType)

  // Simulate filter: dishTypes = {entry}, meal = desayuno
  const entryDesayuno = feedDishes.filter(d => d.categoriaTipo === 'entry' && (d.categoriaTipo === 'dessert' || d.categoriaTipo === 'drink' || d.categoriaTipo === 'coffee' || d.mealTime === 'desayuno'))
  console.log('\nEntry + desayuno (with fix):', entryDesayuno.length)

  // Simulate filter: dishTypes = {entry}, meal = almuerzo_cena
  const entryAlmuerzo = feedDishes.filter(d => d.categoriaTipo === 'entry' && (d.categoriaTipo === 'dessert' || d.categoriaTipo === 'drink' || d.categoriaTipo === 'coffee' || d.mealTime === 'almuerzo_cena'))
  console.log('Entry + almuerzo_cena (with fix):', entryAlmuerzo.length)

  // Simulate filter: dishTypes = {dessert}, meal = desayuno
  const dessertDesayuno = feedDishes.filter(d => d.categoriaTipo === 'dessert' && (d.categoriaTipo === 'dessert' || d.categoriaTipo === 'drink' || d.categoriaTipo === 'coffee' || d.mealTime === 'desayuno'))
  console.log('Dessert + desayuno (with fix):', dessertDesayuno.length)

  // What are entry dishes mealTime?
  const entryMeals: Record<string, number> = {}
  feedDishes.filter(d => d.categoriaTipo === 'entry').forEach(d => { entryMeals[d.mealTime] = (entryMeals[d.mealTime] || 0) + 1 })
  console.log('\nEntry dishes mealTime:', entryMeals)

  // Sample entry dishes
  console.log('\nSample entry dishes:')
  feedDishes.filter(d => d.categoriaTipo === 'entry').slice(0, 5).forEach(d =>
    console.log(`  ${d.name} | tipo:${d.categoriaTipo} | norm:${d.categoriaNorm} | meal:${d.mealTime} | cat:${d.catOriginal}`))

  await prisma.$disconnect()
}
main()
