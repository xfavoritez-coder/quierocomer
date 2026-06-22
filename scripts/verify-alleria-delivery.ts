import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
config({ path: '.env.local' })

const prisma = new PrismaClient()

async function main() {
  const r = await prisma.restaurant.findFirst({
    where: { slug: 'alleria-delivery' },
    include: {
      categories: { include: { dishes: true }, orderBy: { position: 'asc' } },
    }
  })
  if (!r) { console.log('NOT FOUND'); return }
  console.log('Restaurant:', r.name, r.slug, '| billingExempt:', r.billingExempt, '| plan:', r.plan, '| ownerId:', r.ownerId)
  const totalDishes = r.categories.reduce((s,c) => s+c.dishes.length, 0)
  console.log('Categories:', r.categories.length, '| Dishes:', totalDishes)
  for (const c of r.categories) {
    console.log(` "${c.name}" — ${c.dishes.length} dishes`)
  }

  const member = await prisma.teamMember.findFirst({ where: { restaurantId: r.id } })
  console.log('\nTeamMember:', member ? `${member.email} / ${member.role} / ${member.status}` : 'NONE')
}

main().catch(console.error).finally(() => prisma.$disconnect())
