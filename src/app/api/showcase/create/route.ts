import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 50);
}

export async function POST(req: NextRequest) {
  try {
  const { restaurant: restaurantData, dishes: dishesData } = await req.json();

  // Generate unique slug
  let baseSlug = slugify(restaurantData.name);
  let slug = baseSlug;
  let attempt = 0;
  while (await prisma.restaurant.findUnique({ where: { slug } })) {
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }

  const restaurant = await prisma.restaurant.create({
    data: {
      name: restaurantData.name,
      slug,
      address: restaurantData.address,
      lat: restaurantData.lat,
      lng: restaurantData.lng,
      googleMapsUrl: restaurantData.googleMapsUrl ?? "",
      googleRating: restaurantData.googleRating ?? null,
      googleRatingCount: restaurantData.googleRatingCount ?? null,
      website: restaurantData.website ?? null,
      instagram: restaurantData.instagram ?? null,
      isDemo: false,
      isActive: true,
      isShowcase: true,
      plan: "FREE",
      cartaTheme: "BASIC",
    },
  });

  const category = await prisma.category.create({
    data: {
      restaurantId: restaurant.id,
      name: "Platos",
      position: 0,
      dishType: "food",
      isActive: true,
    },
  });

  for (let i = 0; i < dishesData.length; i++) {
    const d = dishesData[i];
    await prisma.dish.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: category.id,
        name: d.name.trim(),
        description: d.description || null,
        price: 0, // showcase: precio desconocido, se muestra como "sin precio"
        photos: d.photoUrl ? [d.photoUrl] : [],
        position: i,
        isActive: true,
        dishDiet: "OMNIVORE",
        txDishType: [],
        txIngredient: [],
        txCuisine: [],
        txMealSlot: [],
        txEstilo: [],
      },
    });
  }

  // Invalidar cache del feed para que aparezca de inmediato
  revalidateTag("feed-dishes", { expire: 0 });

  // Vincular con MapaProspecto: marcar como importado para que el pin quede naranja
  // Busca primero por placeId (Google Place ID = MapaProspecto.id), luego por mapsUrl
  try {
    const placeId = restaurantData.placeId ?? null;
    const mapsUrl = restaurantData.mapsUrl ?? restaurantData.googleMapsUrl ?? null;
    let matched = false;

    if (placeId) {
      const updated = await prisma.mapaProspecto.updateMany({
        where: { id: placeId, importedSlug: null },
        data: { importedSlug: slug },
      });
      matched = updated.count > 0;
    }

    if (!matched && mapsUrl) {
      // Fallback: buscar por mapsUrl exacto o por inicio de URL (sin parámetros de tracking)
      const baseUrl = mapsUrl.split('?')[0];
      await prisma.mapaProspecto.updateMany({
        where: {
          OR: [
            { mapsUrl: mapsUrl },
            { mapsUrl: { startsWith: baseUrl } },
          ],
          importedSlug: null,
        },
        data: { importedSlug: slug },
      });
    }
  } catch (e) {
    // No crítico — el showcase se crea igual aunque no haga match
    console.warn("[showcase/create] No se pudo vincular MapaProspecto:", e);
  }

  return NextResponse.json({ slug, restaurantId: restaurant.id });
  } catch (e: any) {
    console.error("[showcase/create] Error:", e);
    return NextResponse.json({ error: e.message ?? "Unknown error", detail: e.code ?? null }, { status: 500 });
  }
}
