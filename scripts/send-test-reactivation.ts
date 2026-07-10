import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";
import { reactivationEmailHtml } from "../src/lib/email/reactivationEmailHtml";

const resend = new Resend(process.env.RESEND_API_KEY);

async function main() {
  const p = new PrismaClient();

  const slug = "beer-house-atacama";
  const restaurant = await p.restaurant.findFirst({
    where: { slug },
    include: {
      categories: {
        where: { isActive: true },
        orderBy: { position: "asc" },
        include: {
          dishes: {
            where: { isActive: true },
            orderBy: { position: "asc" },
            select: { name: true, photos: true, price: true },
          },
        },
      },
    },
  });

  if (!restaurant) { console.log("Restaurant not found"); return; }

  const categories = restaurant.categories.map(c => ({
    name: c.name,
    dishCount: c.dishes.length,
    topDish: c.dishes[0]?.name || undefined,
    topDishPhoto: c.dishes[0]?.photos?.[0] || null,
    topDishPrice: c.dishes[0]?.price || null,
  }));

  const totalDishes = categories.reduce((sum, c) => sum + c.dishCount, 0);

  const html = reactivationEmailHtml({
    ownerName: "Lissette",
    restaurantName: restaurant.name,
    logoUrl: restaurant.logoUrl,
    slug,
    dishCount: totalDishes,
    categories,
    cartaUrl: `https://quierocomer.com/qr/${slug}`,
    panelUrl: `https://quierocomer.com/panel`,
    activarUrl: `https://quierocomer.com/activar/${slug}`,
    openPixel: "https://quierocomer.com/api/email/track/open?eid=test-reactivation-2",
  });

  console.log(`Restaurant: ${restaurant.name}`);
  console.log(`Logo: ${restaurant.logoUrl?.substring(0, 60)}`);
  console.log(`Dishes: ${totalDishes}`);
  console.log(`Categories: ${categories.length}`);
  console.log(`Top 5:`, categories.slice(0, 5).map(c => `${c.name} (${c.dishCount}, foto:${!!c.topDishPhoto})`));

  const fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev";

  const { data, error } = await resend.emails.send({
    from: `QuieroComer <${fromEmail}>`,
    to: "favoritez@gmail.com",
    subject: "Lissette, tu carta QR es gratis y está lista",
    html,
  });

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Sent!", data);
  }

  await p.$disconnect();
}

main().catch(console.error);
