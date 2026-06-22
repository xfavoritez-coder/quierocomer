import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
config({ path: '.env.local' })

const prisma = new PrismaClient()

async function main() {
  const r = await prisma.restaurant.findFirst({
    where: { name: { contains: 'alleria', mode: 'insensitive' } },
    include: {
      categories: {
        include: { dishes: true },
        orderBy: { position: 'asc' }
      },
      owner: { select: { id: true, email: true, name: true } }
    }
  })
  if (!r) { console.log('NO ENCONTRADO'); return }
  console.log('RESTAURANT:', JSON.stringify({
    id: r.id, name: r.name, slug: r.slug, email: r.email,
    phone: r.phone, address: r.address, city: r.city,
    logoUrl: r.logoUrl, coverUrl: r.coverUrl,
    primaryColor: r.primaryColor, secondaryColor: r.secondaryColor,
    billingExempt: r.billingExempt, planType: r.planType,
    cartaProvider: r.cartaProvider, website: r.website,
    instagramUrl: r.instagramUrl, whatsapp: r.whatsapp,
    ownerId: r.ownerId,
    owner: r.owner,
    categoriesCount: r.categories.length,
    dishesCount: r.categories.reduce((s, c) => s + c.dishes.length, 0),
  }, null, 2))
  console.log('\nCATEGORIES:')
  for (const c of r.categories) {
    console.log(` [${c.id}] "${c.name}" (pos:${c.position}) — ${c.dishes.length} dishes`)
    for (const d of c.dishes.slice(0,2)) {
      console.log(`   dish: "${d.name}" price:${d.price} active:${d.isActive}`)
    }
    if (c.dishes.length > 2) console.log(`   ... and ${c.dishes.length - 2} more`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
