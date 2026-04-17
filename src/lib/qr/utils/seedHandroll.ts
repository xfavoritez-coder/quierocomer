import { prisma } from "@/lib/prisma";

const MENU_URL =
  "https://cdn.mer-cat.com/handroll/menus/4.json?nocache=1776193687794";

// Categories to skip (promos, sauces, drinks, kids)
const SKIP_POSITIONS = new Set([2, 3, 5, 19, 20]);

// Products to mark as RECOMMENDED (by name substring)
const RECOMMENDED_NAMES = [
  "SushiPizza de Salmón",
  "Chirashi Especial Del Chef",
  "Tiger Roll",
];

function cleanName(name: string) {
  return name.replace(/[🏯✨🌱]/g, "").trim();
}

function shortenCatName(name: string) {
  // Remove parenthetical text
  return cleanName(name).replace(/\s*\(.*\)/, "").trim();
}

interface MenuProduct {
  name: string;
  description: string;
  price: number;
  discount_price: number;
  position: number;
  hidden: boolean;
  product: {
    name: string;
    description: string | null;
    pictures: { thumbnails?: { large?: string }; url?: string }[];
  };
}

interface MenuGroup {
  name: string;
  position: number;
  prices: MenuProduct[];
}

export async function seedHandroll() {
  const existing = await prisma.restaurant.findUnique({
    where: { slug: "hand-roll" },
  });
  if (existing) return existing;

  // Fetch menu
  const res = await fetch(MENU_URL);
  const data = await res.json();
  const groups: MenuGroup[] = data.price_groups;

  // Filter and sort categories
  const cats = groups
    .filter((g) => !SKIP_POSITIONS.has(g.position))
    .sort((a, b) => a.position - b.position);

  // Create restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Hand Roll",
      slug: "hand-roll",
      description: "Sushi fusión japonés-chileno. Hand rolls, ceviches nikkei, rolls especiales y platos calientes.",
      cartaTheme: "PREMIUM",
      phone: "+56222222222",
      address: "Rojas Magallanes, La Florida",
      ownerId: "seed-owner-handroll",
      bannerUrl: null,
      logoUrl: "https://cdn.mer-cat.com/handroll/img/settings/imageedit_2_5671911227_1617112122.png",
    },
  });

  // Create categories
  for (let i = 0; i < cats.length; i++) {
    const cat = cats[i];
    const category = await prisma.category.create({
      data: {
        restaurantId: restaurant.id,
        name: shortenCatName(cat.name),
        position: i,
        isActive: true,
      },
    });

    // Create dishes for this category
    const visible = cat.prices
      .filter((p) => !p.hidden)
      .sort((a, b) => a.position - b.position);

    const dishData = visible.map((p, idx) => {
      const isRec = RECOMMENDED_NAMES.some((rn) =>
        p.product.name.toLowerCase().includes(rn.toLowerCase())
      );
      const photo = p.product.pictures?.[0]?.url || null;

      return {
        restaurantId: restaurant.id,
        categoryId: category.id,
        name: p.product.name,
        description: p.product.description || null,
        price: p.price,
        discountPrice: p.discount_price !== p.price ? p.discount_price : null,
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

export async function reseedHandroll() {
  const existing = await prisma.restaurant.findUnique({
    where: { slug: "hand-roll" },
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
  return seedHandroll();
}
