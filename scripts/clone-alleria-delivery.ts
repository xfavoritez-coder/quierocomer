import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import bcrypt from 'bcryptjs'
config({ path: '.env.local' })

const prisma = new PrismaClient()

async function main() {
  // 1. Load source restaurant
  const src = await prisma.restaurant.findFirst({
    where: { slug: 'alleria-pizza' },
    include: {
      categories: {
        include: { dishes: true },
        orderBy: { position: 'asc' }
      }
    }
  })
  if (!src) { console.error('alleria-pizza not found'); return }
  console.log(`Source: "${src.name}" — ${src.categories.length} categories, ${src.categories.reduce((s,c) => s+c.dishes.length,0)} dishes`)

  // 2. Check if alleria-delivery already exists
  const existing = await prisma.restaurant.findFirst({ where: { slug: 'alleria-delivery' } })
  if (existing) { console.error('alleria-delivery already exists! Aborting.'); return }

  // 3. Create new restaurant
  const delivery = await prisma.restaurant.create({
    data: {
      slug: 'alleria-delivery',
      name: 'Alleria Delivery',
      description: src.description ?? undefined,
      logoUrl: src.logoUrl ?? undefined,
      bannerUrl: src.bannerUrl ?? undefined,
      phone: src.phone ?? undefined,
      address: src.address ?? undefined,
      website: src.website ?? undefined,
      websiteIsOrderUrl: src.websiteIsOrderUrl,
      cartaProvider: src.cartaProvider ?? undefined,
      whatsapp: src.whatsapp ?? undefined,
      instagram: src.instagram ?? undefined,
      scheduleJson: src.scheduleJson ?? undefined,
      cartaTheme: src.cartaTheme,
      isActive: true,
      ownerId: src.ownerId ?? undefined,
      billingExempt: true,
      defaultView: src.defaultView ?? undefined,
      dietType: src.dietType,
      enabledLangs: src.enabledLangs,
      plan: 'PREMIUM',
      allPhotosReferential: src.allPhotosReferential,
    }
  })
  console.log(`Created restaurant: "${delivery.name}" (${delivery.id})`)

  // 4. Clone categories + dishes
  let totalDishes = 0
  for (const cat of src.categories) {
    const newCat = await prisma.category.create({
      data: {
        restaurantId: delivery.id,
        name: cat.name,
        description: cat.description ?? undefined,
        position: cat.position,
        isActive: cat.isActive,
        dishType: cat.dishType,
        normOverride: cat.normOverride ?? undefined,
        cuisineTag: cat.cuisineTag ?? undefined,
      }
    })

    for (const dish of cat.dishes) {
      await prisma.dish.create({
        data: {
          restaurantId: delivery.id,
          categoryId: newCat.id,
          name: dish.name,
          description: dish.description ?? undefined,
          price: dish.price,
          discountPrice: dish.discountPrice ?? undefined,
          photos: dish.photos,
          tags: dish.tags,
          isHero: dish.isHero,
          isActive: dish.isActive,
          ingredients: dish.ingredients ?? undefined,
          allergens: dish.allergens ?? undefined,
          position: dish.position,
          dishDiet: dish.dishDiet,
          isSpicy: dish.isSpicy,
          flavorTags: dish.flavorTags,
          txDishType: dish.txDishType,
          txCuisine: dish.txCuisine,
          txMealSlot: dish.txMealSlot,
          txIngredient: dish.txIngredient,
          txEstilo: dish.txEstilo,
          isFeaturedAuto: dish.isFeaturedAuto,
          isHighMargin: dish.isHighMargin,
          isPhotoReferential: dish.isPhotoReferential,
          isGlutenFree: dish.isGlutenFree,
          isLactoseFree: dish.isLactoseFree,
          isSoyFree: dish.isSoyFree,
          hiddenFromFeed: dish.hiddenFromFeed,
          leafOverride: dish.leafOverride ?? undefined,
        }
      })
      totalDishes++
    }
    console.log(`  Category "${newCat.name}" — ${cat.dishes.length} dishes cloned`)
  }
  console.log(`Total dishes cloned: ${totalDishes}`)

  // 5. Create TeamMember with password "alleria-delivery" for access to this restaurant
  const passwordHash = await bcrypt.hash('alleria-delivery', 10)
  const ownerEmail = 'gomezlowry@gmail.com'

  // Check if team member already exists (shouldn't, new restaurant)
  const existingMember = await prisma.teamMember.findFirst({
    where: { restaurantId: delivery.id, email: ownerEmail }
  })
  if (!existingMember) {
    await prisma.teamMember.create({
      data: {
        restaurantId: delivery.id,
        email: ownerEmail,
        name: 'Alleria Delivery',
        role: 'ADMIN',
        status: 'ACTIVE',
        passwordHash,
      }
    })
    console.log(`TeamMember created: ${ownerEmail} / alleria-delivery → ADMIN on "${delivery.name}"`)
  } else {
    console.log('TeamMember already exists, skipping')
  }

  console.log('\n✓ Done! Access: https://quierocomer.com/panel/login')
  console.log('  Email: gomezlowry@gmail.com')
  console.log('  Password: alleria-delivery')
  console.log(`  Panel URL: https://quierocomer.com/panel/${delivery.slug}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
