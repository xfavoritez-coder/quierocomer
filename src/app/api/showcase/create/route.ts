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
      },
    });
  }

  // Invalidar cache del feed para que aparezca de inmediato
  revalidateTag("feed-dishes");

  return NextResponse.json({ slug, restaurantId: restaurant.id });
  } catch (e: any) {
    console.error("[showcase/create] Error:", e);
    return NextResponse.json({ error: e.message ?? "Unknown error", detail: e.code ?? null }, { status: 500 });
  }
}
