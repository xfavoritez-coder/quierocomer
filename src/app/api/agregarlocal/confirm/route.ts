import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(request: Request) {
  try {
    const { name, categories } = await request.json();

    if (!name?.trim() || !categories?.length) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    // Generate unique slug
    let slug = slugify(name);
    const existing = await prisma.restaurant.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    // Create restaurant
    const restaurant = await prisma.restaurant.create({
      data: {
        name: name.trim(),
        slug,
        cartaTheme: "PREMIUM",
        defaultView: "premium",
        isActive: true,
      },
    });

    // Create categories and dishes
    let totalDishes = 0;
    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      if (!cat.dishes?.length) continue;

      const category = await prisma.category.create({
        data: {
          restaurantId: restaurant.id,
          name: cat.name,
          position: i,
          dishType: cat.type || "food",
          isActive: true,
        },
      });

      for (let j = 0; j < cat.dishes.length; j++) {
        const dish = cat.dishes[j];
        if (!dish.name?.trim()) continue;

        await prisma.dish.create({
          data: {
            restaurantId: restaurant.id,
            categoryId: category.id,
            name: dish.name.trim(),
            description: dish.description || null,
            price: Number(dish.price) || 0,
            position: j,
            dishDiet: dish.diet || "OMNIVORE",
            isSpicy: dish.isSpicy || false,
            isActive: true,
          },
        });
        totalDishes++;
      }
    }

    return NextResponse.json({
      ok: true,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
      },
      totalCategories: categories.filter((c: any) => c.dishes?.length > 0).length,
      totalDishes,
      url: `https://quierocomer.cl/qr/${restaurant.slug}`,
    });
  } catch (e: any) {
    console.error("[agregarlocal confirm]", e);
    return NextResponse.json({ error: e.message || "Error al crear el local" }, { status: 500 });
  }
}
