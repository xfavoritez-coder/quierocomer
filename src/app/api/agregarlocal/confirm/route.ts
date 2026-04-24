import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractIngredientsForDish } from "@/lib/ai/extractIngredients";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(request: Request) {
  try {
    const { name, categories, logo } = await request.json();

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
        logoUrl: logo || null,
        cartaTheme: "PREMIUM",
        defaultView: "premium",
        isActive: true,
      },
    });

    // Create categories, dishes, and modifiers
    let totalDishes = 0;
    const createdDishes: { id: string; name: string; description: string | null }[] = [];
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

        const photos: string[] = dish.photo ? [dish.photo] : [];

        const created = await prisma.dish.create({
          data: {
            restaurantId: restaurant.id,
            categoryId: category.id,
            name: dish.name.trim(),
            description: dish.description || null,
            price: Number(dish.price) || 0,
            photos,
            position: j,
            dishDiet: dish.diet || "OMNIVORE",
            isSpicy: dish.isSpicy || false,
            isActive: true,
          },
        });

        // Create modifiers if present
        if (dish.modifiers?.length > 0) {
          for (let m = 0; m < dish.modifiers.length; m++) {
            const mod = dish.modifiers[m];
            if (!mod.name || !mod.options?.length) continue;

            const template = await prisma.modifierTemplate.create({
              data: {
                restaurantId: restaurant.id,
                name: mod.name,
                dishes: { connect: [{ id: created.id }] },
              },
            });

            await prisma.modifierTemplateGroup.create({
              data: {
                templateId: template.id,
                name: mod.name,
                required: mod.required || false,
                maxSelect: 1,
                position: m,
                options: {
                  create: mod.options.map((opt: any, k: number) => ({
                    name: opt.name,
                    priceAdjustment: Number(opt.price) || 0,
                    position: k,
                  })),
                },
              },
            });
          }
        }

        createdDishes.push({ id: created.id, name: created.name, description: created.description });
        totalDishes++;
      }
    }

    // Extract ingredients from descriptions
    const prefetchedIngredients = await prisma.ingredient.findMany({ select: { id: true, name: true, aliases: true }, orderBy: { name: "asc" } });
    const prefetchedIgnored = await prisma.ignoredIngredient.findMany({ select: { name: true } });

    for (let i = 0; i < createdDishes.length; i += 5) {
      const batch = createdDishes.slice(i, i + 5);
      await Promise.allSettled(
        batch.map(d => extractIngredientsForDish(d.id, d.name, d.description, null, prefetchedIngredients, prefetchedIgnored))
      );
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
