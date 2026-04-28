import { NextResponse } from "next/server";
export const maxDuration = 300;
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import sharp from "sharp";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Download external image, optimize with sharp, upload to Supabase */
async function reuploadPhoto(externalUrl: string, restaurantId: string, dishSlug: string): Promise<string | null> {
  try {
    const res = await fetch(externalUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 500) return null; // skip tiny/broken images

    // Let sharp validate — content-type is unreliable (some CDNs return application/octet-stream)
    let pipeline = sharp(buffer);
    const meta = await pipeline.metadata();
    if (!meta.format) return null; // not a valid image
    if ((meta.width && meta.width > 800) || (meta.height && meta.height > 800)) {
      pipeline = pipeline.resize(800, 800, { fit: "inside", withoutEnlargement: true });
    }
    const optimized = await pipeline.webp({ quality: 82 }).toBuffer();

    const fileName = `dishes/${restaurantId}-${Date.now()}-${dishSlug.slice(0, 30)}.webp`;
    const { error } = await supabase.storage
      .from("fotos")
      .upload(fileName, optimized, { contentType: "image/webp", upsert: true });

    if (error) return null;

    const { data } = supabase.storage.from("fotos").getPublicUrl(fileName);
    return data.publicUrl;
  } catch {
    return null;
  }
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

    // Upload logo to Supabase if it's a base64 data URL
    let logoUrl: string | null = logo || null;
    if (logoUrl && logoUrl.startsWith("data:")) {
      try {
        const matches = logoUrl.match(/^data:image\/(\w+);base64,(.+)$/);
        if (matches) {
          const buffer = Buffer.from(matches[2], "base64");
          const optimized = await sharp(buffer).resize(256, 256, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
          const fileName = `logos/${slug}-${Date.now()}.webp`;
          const { error } = await supabase.storage.from("fotos").upload(fileName, optimized, { contentType: "image/webp", upsert: true });
          if (!error) {
            const { data } = supabase.storage.from("fotos").getPublicUrl(fileName);
            logoUrl = data.publicUrl;
          }
        }
      } catch {}
    }

    // Create restaurant with QR token
    const qrToken = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const restaurant = await prisma.restaurant.create({
      data: {
        name: name.trim(),
        slug,
        logoUrl,
        cartaTheme: "PREMIUM",
        defaultView: "premium",
        isActive: true,
        qrToken,
        qrActivatedAt: new Date(),
      },
    });

    // Create categories, dishes, and modifiers
    let totalDishes = 0;
    const createdDishes: { id: string; name: string; description: string | null; externalPhoto: string | null }[] = [];
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

        const created = await prisma.dish.create({
          data: {
            restaurantId: restaurant.id,
            categoryId: category.id,
            name: dish.name.trim(),
            description: dish.description || null,
            price: Number(dish.price) || 0,
            photos: [], // photos added after re-upload
            position: j,
            dishDiet: dish.diet || "OMNIVORE",
            isSpicy: dish.isSpicy || false,
            isPhotoReferential: dish._unsplash || false,
            isActive: true,
          },
        });

        // Create modifiers if present
        if (dish.modifiers?.length > 0) {
          for (let m = 0; m < dish.modifiers.length; m++) {
            const mod = dish.modifiers[m];
            const validOptions = (mod.options || []).filter((opt: any) => opt.name?.trim());
            if (!mod.name || !validOptions.length) continue;

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
                  create: validOptions.map((opt: any, k: number) => ({
                    name: opt.name.trim(),
                    priceAdjustment: Number(opt.price) || 0,
                    position: k,
                  })),
                },
              },
            });
          }
        }

        createdDishes.push({ id: created.id, name: created.name, description: created.description, externalPhoto: dish.photo || null });
        totalDishes++;
      }
    }

    // Re-upload external photos to Supabase in parallel batches
    const dishesWithPhotos = createdDishes.filter(d => d.externalPhoto);
    if (dishesWithPhotos.length > 0) {
      const BATCH = 10;
      for (let i = 0; i < dishesWithPhotos.length; i += BATCH) {
        const batch = dishesWithPhotos.slice(i, i + BATCH);
        const results = await Promise.allSettled(batch.map(async (dish) => {
          const dishSlug = slugify(dish.name);
          const supabaseUrl = await reuploadPhoto(dish.externalPhoto!, restaurant.id, dishSlug);
          // Use Supabase URL if re-upload worked, otherwise keep original external URL
          const finalUrl = supabaseUrl || dish.externalPhoto!;
          await prisma.dish.update({ where: { id: dish.id }, data: { photos: [finalUrl] } });
          return { dishId: dish.id, ok: !!supabaseUrl };
        }));
      }
    }

    return NextResponse.json({
      ok: true,
      dishIds: createdDishes.map(d => d.id),
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
      },
      totalCategories: categories.filter((c: any) => c.dishes?.length > 0).length,
      totalDishes,
      url: `https://quierocomer.cl/qr/${restaurant.slug}?t=${qrToken}`,
    });
  } catch (e: any) {
    console.error("[agregarlocal confirm]", e);
    return NextResponse.json({ error: e.message || "Error al crear el local" }, { status: 500 });
  }
}
