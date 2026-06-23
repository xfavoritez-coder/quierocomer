import { NextRequest, NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { extractCommune } from "@/lib/communeUtils";

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

  const communeData = restaurantData.address ? extractCommune(restaurantData.address) : null
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
      googlePlaceId: restaurantData.placeId ?? null,
      phone: restaurantData.phone ?? null,
      website: restaurantData.website ?? null,
      instagram: restaurantData.instagram ?? null,
      isDemo: false,
      isActive: true,
      isShowcase: true,
      plan: "FREE",
      cartaTheme: "BASIC",
      commune: communeData?.commune ?? null,
      communeSlug: communeData?.communeSlug ?? null,
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

  // Solo crear platos reales — excluir bebidas y extras/condimentos clasificados por IA
  const platosData = dishesData.filter((d: any) => d.type !== 'bebida' && d.type !== 'extra');
  for (let i = 0; i < platosData.length; i++) {
    const d = platosData[i];
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

  // Invalidar cache del feed y la página para que aparezca de inmediato
  revalidateTag("feed-dishes", { expire: 0 });
  revalidatePath('/');

  // Vincular con MapaProspecto: marcar como importado para que el pin quede naranja.
  // Si no existe, crear uno nuevo para que aparezca en /localesfeed y /mapalocales.
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
      const baseUrl = mapsUrl.split('?')[0];
      const res = await prisma.mapaProspecto.updateMany({
        where: {
          OR: [{ mapsUrl: mapsUrl }, { mapsUrl: { startsWith: baseUrl } }],
          importedSlug: null,
        },
        data: { importedSlug: slug },
      });
      matched = res.count > 0;
    }

    // Si no encontró ningún MapaProspecto existente, crear uno nuevo
    if (!matched && mapsUrl) {
      const prospectoId = placeId ?? `showcase-${slug}`;
      await prisma.mapaProspecto.upsert({
        where: { id: prospectoId },
        update: { importedSlug: slug },
        create: {
          id: prospectoId,
          name: restaurantData.name,
          address: restaurantData.address ?? '',
          lat: restaurantData.lat ?? null,
          lng: restaurantData.lng ?? null,
          mapsUrl,
          status: 'encontrado',
          importedSlug: slug,
        },
      });
    }
  } catch (e) {
    console.warn("[showcase/create] No se pudo vincular MapaProspecto:", e);
  }

  return NextResponse.json({ slug, restaurantId: restaurant.id });
  } catch (e: any) {
    console.error("[showcase/create] Error:", e);
    return NextResponse.json({ error: e.message ?? "Unknown error", detail: e.code ?? null }, { status: 500 });
  }
}
