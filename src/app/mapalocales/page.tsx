import { prisma } from '@/lib/prisma'
import MapaLocalesClient from './MapaLocalesClient'

export const metadata = {
  title: 'Mapa de locales — QuieroComer',
}

export const revalidate = 300

export type RestauranteMapaData = {
  id: string
  name: string
  slug: string
  address: string | null
  lat: number
  lng: number
  logoUrl: string | null
  dishCount: number
}

export type ProspectoMapaData = {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  mapsUrl: string | null
  rating: number | null
  reviews: number | null
  cartaUrl: string | null
  provider: string | null
}

async function getRestaurantesActivos(): Promise<RestauranteMapaData[]> {
  const restaurantes = await prisma.restaurant.findMany({
    where: {
      isActive: true,
      isDemo: false,
      lat: { not: null },
      lng: { not: null },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      address: true,
      lat: true,
      lng: true,
      logoUrl: true,
      _count: {
        select: {
          dishes: {
            where: { isActive: true, deletedAt: null },
          },
        },
      },
    },
  })

  return restaurantes
    .filter((r) => r.lat != null && r.lng != null)
    .map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      address: r.address,
      lat: r.lat as number,
      lng: r.lng as number,
      logoUrl: r.logoUrl,
      dishCount: r._count.dishes,
    }))
}

async function getProspectos(): Promise<ProspectoMapaData[]> {
  const rows = await prisma.mapaProspecto.findMany({
    where: { lat: { not: null }, lng: { not: null }, importedSlug: null, dismissed: false },
    select: { id: true, name: true, address: true, lat: true, lng: true, mapsUrl: true, rating: true, reviews: true, cartaUrl: true, provider: true },
  })
  return rows
    .filter(r => r.lat != null && r.lng != null)
    .map(r => ({
      id: r.id,
      name: r.name,
      address: r.address ?? '',
      lat: r.lat as number,
      lng: r.lng as number,
      mapsUrl: r.mapsUrl,
      rating: r.rating,
      reviews: r.reviews,
      cartaUrl: r.cartaUrl ?? null,
      provider: r.provider ?? null,
    }))
}

export default async function MapaLocalesPage() {
  const [restaurantes, prospectos] = await Promise.all([getRestaurantesActivos(), getProspectos()])

  return (
    <div className="min-h-dvh bg-[#0e0e0e] text-white">
      <div className="px-4 pt-6 pb-3">
        <h1 className="text-xl font-semibold">Mapa de locales activos</h1>
        <p className="text-sm text-white/50 mt-1">
          {restaurantes.length} local{restaurantes.length !== 1 ? 'es' : ''} en el feed
          {prospectos.length > 0 && ` · ${prospectos.length} prospectos`}
        </p>
      </div>
      <MapaLocalesClient restaurantes={restaurantes} prospectos={prospectos} />
    </div>
  )
}
