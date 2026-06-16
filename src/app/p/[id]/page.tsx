import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/slugify'

type Props = { params: Promise<{ id: string }> }

export default async function DishPage({ params }: Props) {
  const { id } = await params
  const dish = await prisma.dish.findUnique({
    where: { id },
    select: { name: true, restaurant: { select: { slug: true } } },
  })

  if (!dish) redirect('/')
  redirect(`/${dish.restaurant.slug}/${slugify(dish.name)}`)
}
