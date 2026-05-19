import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import bcrypt from "bcryptjs";

/**
 * POST /api/activar/registrar
 * Body: { localName, ownerName, email, whatsapp }
 *
 * Crea un restaurant con platos de ejemplo + owner para activación directa desde /planes.
 */

const SAMPLE_CATEGORIES = [
  { name: "Para Comenzar", position: 0 },
  { name: "Platos Principales", position: 1 },
  { name: "Postres y Bebidas", position: 2 },
];

const SAMPLE_DISHES: { cat: number; name: string; desc: string; price: number; photo: string; isHero?: boolean; isSpicy?: boolean; diet?: "VEGAN" | "VEGETARIAN" | "OMNIVORE" }[] = [
  { cat: 0, name: "Ensalada Mediterránea", desc: "Mix de hojas verdes, tomate cherry, aceitunas, pepino y queso feta con vinagreta de limón.", price: 6900, photo: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80", diet: "VEGETARIAN" },
  { cat: 0, name: "Bruschetta Clásica", desc: "Pan artesanal tostado con tomate fresco, albahaca, ajo y aceite de oliva.", price: 5500, photo: "https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=800&q=80", diet: "VEGAN" },
  { cat: 0, name: "Empanadas de Carne", desc: "Tres empanadas horneadas rellenas de pino con huevo, aceituna y pasas.", price: 4900, photo: "https://images.unsplash.com/photo-1604467707321-70d009801bf3?w=800&q=80" },
  { cat: 1, name: "Lomo a la Parrilla", desc: "Corte de lomo grillado a punto, acompañado de puré rústico y verduras salteadas.", price: 14900, photo: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80", isHero: true },
  { cat: 1, name: "Pasta Carbonara", desc: "Spaghetti al dente con salsa cremosa de huevo, panceta crocante y parmesano.", price: 11900, photo: "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800&q=80", isHero: true },
  { cat: 1, name: "Bowl Vegano Thai", desc: "Arroz jazmín, tofu marinado, edamame, palta, zanahoria y salsa de maní.", price: 10500, photo: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80", diet: "VEGAN" },
  { cat: 1, name: "Tacos Picantes", desc: "Tres tacos de carne especiada con jalapeños, cilantro, cebolla morada y salsa chipotle.", price: 9800, photo: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80", isSpicy: true },
  { cat: 2, name: "Tiramisú", desc: "Clásico postre italiano con capas de mascarpone, café espresso y cacao.", price: 5900, photo: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800&q=80" },
  { cat: 2, name: "Limonada Artesanal", desc: "Limonada natural con hierbabuena, jengibre y un toque de miel.", price: 3500, photo: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=800&q=80", diet: "VEGAN" },
  { cat: 2, name: "Café de Especialidad", desc: "Espresso doble con granos de origen único, tostado medio.", price: 2800, photo: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80" },
];

export async function POST(req: NextRequest) {
  let body: { localName?: string; ownerName?: string; email?: string; whatsapp?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const { localName: rawLocalName, ownerName: rawOwnerName, email, whatsapp } = body;
  if (!rawLocalName?.trim() || !email?.trim() || !email.includes("@")) {
    return NextResponse.json({ error: "Completa nombre del local y email" }, { status: 400 });
  }

  // Title Case: "horus vegan" → "Horus Vegan"
  const toTitleCase = (s: string) => s.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  const localName = toTitleCase(rawLocalName);
  const ownerName = rawOwnerName?.trim() ? toTitleCase(rawOwnerName) : undefined;

  // Generar slug
  let slug = localName.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) slug = "mi-local";
  const existing = await prisma.restaurant.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const qrToken = crypto.randomUUID().replace(/-/g, "").slice(0, 12);

  // Crear o encontrar owner
  let owner = await prisma.restaurantOwner.findFirst({ where: { email: email.trim().toLowerCase() } });
  if (!owner) {
    const passwordHash = await bcrypt.hash(`${slug}2026`, 10);
    owner = await prisma.restaurantOwner.create({
      data: {
        name: ownerName?.trim() || localName.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        role: "OWNER",
        whatsapp: whatsapp?.trim() || undefined,
      },
    });
  }

  // Crear restaurant con categorías y platos de ejemplo
  const restaurant = await prisma.restaurant.create({
    data: {
      name: localName.trim(),
      slug,
      cartaTheme: "PREMIUM",
      cartaColorMode: "DARK",
      defaultView: "impact",
      enabledLangs: ["es"],
      isActive: true,
      isDemo: true,
      weeklyEmailEnabled: true,
      qrToken,
      qrActivatedAt: new Date(),
      plan: "PREMIUM",
      ownerId: owner.id,
      allPhotosReferential: true,
    },
  });

  // Crear categorías
  const categoryIds: string[] = [];
  for (const cat of SAMPLE_CATEGORIES) {
    const c = await prisma.category.create({
      data: { restaurantId: restaurant.id, name: cat.name, position: cat.position },
    });
    categoryIds.push(c.id);
  }

  // Crear platos de ejemplo
  for (let i = 0; i < SAMPLE_DISHES.length; i++) {
    const d = SAMPLE_DISHES[i];
    await prisma.dish.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: categoryIds[d.cat],
        name: d.name,
        description: d.desc,
        price: d.price,
        photos: [d.photo],
        isPhotoReferential: true,
        photoCredits: [{ source: "unsplash", referential: true }],
        isHero: d.isHero || false,
        isSpicy: d.isSpicy || false,
        dishDiet: d.diet || "OMNIVORE",
        isFeaturedAuto: d.isHero || false,
        position: i,
      },
    });
  }

  return NextResponse.json({ ok: true, slug: restaurant.slug, plan: "PREMIUM" });
}
