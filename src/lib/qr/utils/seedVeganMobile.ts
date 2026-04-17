import { prisma } from "@/lib/prisma";

const MENU_URL = "https://www.veganmobile.cl/pedir";
const LOGO_URL = "https://tofuu.getjusto.com/orioneat-prod/gvzRxGqdvSFZLRPHy-Recursos%20VeganMobile_Iso%20color.png";

const RECOMMENDED_NAMES = [
  "Basílica",
  "Pepperoni",
  "Mac & Cheese Clásico",
];

function cleanName(name: string) {
  return name.replace(/[⚡🔥🍕🌱⭐☯🍟🍃🥤🍧🥗🏆🥇]/g, "").trim();
}

interface VeganProduct {
  name: string;
  description: string;
  categories: { _id: string; name: string }[];
  images: { key?: string; resizedData?: Record<string, string> }[];
  availabilityAt: { finalPrice?: number; basePrice?: number; visible?: boolean };
}

interface VeganCategory {
  _id: string;
  name: string;
  subCategories: unknown[];
}

export async function seedVeganMobile() {
  const existing = await prisma.restaurant.findUnique({
    where: { slug: "vegan-mobile" },
  });
  if (existing) return existing;

  // Fetch page and extract data
  const res = await fetch(MENU_URL);
  const html = await res.text();
  const match = html.match(/window\.__remixContext\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!match) throw new Error("Could not find menu data in page");

  const data = JSON.parse(match[1]);
  const md = data.state.loaderData["pages/Order/Layout/index"].menuData;
  const prods: VeganProduct[] = Object.values(md.products);
  const cats: VeganCategory[] = md.categoryTree;

  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Vegan Mobile Pizza",
      slug: "vegan-mobile",
      description: "La primera pizzería 100% vegana de Chile. Your Best Vegan Pizza.",
      cartaTheme: "PREMIUM",
      phone: "+56900000000",
      address: "Santiago, Chile",
      ownerId: "seed-owner-veganmobile",
      bannerUrl: null,
      logoUrl: LOGO_URL,
    },
  });

  for (let i = 0; i < cats.length; i++) {
    const cat = cats[i];
    const category = await prisma.category.create({
      data: {
        restaurantId: restaurant.id,
        name: cleanName(cat.name),
        position: i,
        isActive: true,
      },
    });

    const catProds = prods
      .filter(
        (p) =>
          p.categories?.some((c) => c._id === cat._id) &&
          p.availabilityAt?.visible !== false
      );

    const dishData = catProds.map((p, idx) => {
      const photo =
        p.images?.[0]?.resizedData?.medium ||
        (p.images?.[0]?.key
          ? `https://tofuu.getjusto.com/${p.images[0].key}`
          : null);
      const price = p.availabilityAt?.finalPrice || p.availabilityAt?.basePrice || 0;
      const isRec = RECOMMENDED_NAMES.some((rn) =>
        p.name.toLowerCase().includes(rn.toLowerCase())
      );

      return {
        restaurantId: restaurant.id,
        categoryId: category.id,
        name: p.name,
        description: p.description || null,
        price,
        photos: photo ? [photo] : [],
        tags: isRec ? ["RECOMMENDED" as const] : [],
        isHero: false,
        position: idx,
      };
    });

    if (dishData.length > 0) {
      await prisma.dish.createMany({ data: dishData });
    }
  }

  return restaurant;
}

export async function reseedVeganMobile() {
  const existing = await prisma.restaurant.findUnique({
    where: { slug: "vegan-mobile" },
  });
  if (existing) {
    await prisma.review.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.statEvent.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.waiterCall.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.restaurantPromotion.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.birthdayCampaign.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.restaurantScheduleRule.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.customer.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.dish.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.category.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.restaurantTable.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.restaurant.delete({ where: { id: existing.id } });
  }
  return seedVeganMobile();
}
