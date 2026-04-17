import { NextResponse } from "next/server";
import { seedRestaurant, reseedRestaurant } from "@/lib/qr/utils/seedData";
import { seedHandroll, reseedHandroll } from "@/lib/qr/utils/seedHandroll";
import { seedVeganMobile, reseedVeganMobile } from "@/lib/qr/utils/seedVeganMobile";
import { seedJuana, reseedJuana } from "@/lib/qr/utils/seedJuana";
import { seedHorus, reseedHorus } from "@/lib/qr/utils/seedHorus";

export async function GET(request: Request) {
  const isdev = process.env.NODE_ENV === "development";
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const validKey = key === process.env.SEED_SECRET;
  if (!isdev && !validKey) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";
    const which = url.searchParams.get("restaurant") || "parrilla";

    let restaurant;
    if (which === "handroll") {
      restaurant = force ? await reseedHandroll() : await seedHandroll();
    } else if (which === "juana") {
      restaurant = force ? await reseedJuana() : await seedJuana();
    } else if (which === "horus") {
      restaurant = force ? await reseedHorus() : await seedHorus();
    } else if (which === "veganmobile") {
      restaurant = force ? await reseedVeganMobile() : await seedVeganMobile();
    } else {
      restaurant = force ? await reseedRestaurant() : await seedRestaurant();
    }

    return NextResponse.json({
      ok: true,
      slug: restaurant.slug,
      url: `/qr/${restaurant.slug}`,
      reseeded: force,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Error al crear datos de prueba", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
