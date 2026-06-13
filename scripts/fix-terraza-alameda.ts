import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const prisma = new PrismaClient();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const BASE_IMAGE_URL = "https://backend.influye.app/storage/products/";

// Full mapping of dish name → image filename, extracted from terrazaalameda.cl
// Dishes not listed here have NO_IMAGE.png on the original site
const DISH_IMAGE_MAP: Record<string, string> = {
  // Appetizer—Entradas
  "Ceviche Premium Atun": "5013bc98dc020648cb96d786b263126c.png",
  "Ceviche Premium Salmon": "5013bc98dc020648cb96d786b263126c.png",
  "Ceviche Atun Pulpo": "b14ebda154c2e818abaad4e07c2a8ff1.png",
  "Ceviche Salmon Pulpo": "b14ebda154c2e818abaad4e07c2a8ff1.png",
  "Ceviche Atun y Camaron": "2a86aedabcfa60053eadf39094a45389.png",
  "Ceviche Salmon y Camaron": "2a86aedabcfa60053eadf39094a45389.png",
  "Duo Tar Tar": "f6de3a1e38d15bbc25a4893614339499.png",
  "Tataki de Atun": "2d133c7a9a77e77f90979a3952e8ce30.png",
  "Ceviche Atun": "b0139757274949f3d5ec6c8fbe95c92e.png",
  "Ceviche Salmon": "b0139757274949f3d5ec6c8fbe95c92e.png",
  "Ceviche de Camaron": "fac8f601fa487305e136ee44627899be.png",
  "Ceviche de Champiñon": "600be0efb2438eca8911161bd43d276e.png",
  "Tiradito de Salmon Fresco": "5dfdcce98784f717cb992aa7bc70826a.png",
  "Tartar Salmón": "596c1468f37d85dce009f775e2e72876.png",
  "Camaron al pil pil": "2e7db19dc95a9ee2d9f44efdf3e8f22e.png",
  "Leche de Tigre": "156e997f7bf92d070a876ba1d5cda75a.png",
  "Mini Empanadas (5 Unidades)": "3b5b5294f1bf9ab21cc317639338a727.png",
  "Onion Ring 12 Unidades": "c1e83534b5eaad9305ad1676cac03e06.png",

  // Platos a la Carta
  "Lomo grillado en salsa de Whisky": "3d61e754153037ba41a1b6471da457d8.png",
  "Lomo a lo Pobre": "a5de367417fc38b2ccb22238bceee976.png",
  "Lomo Saltado": "61ae66b9c6da539e5bc027efc7dd5da0.png",
  "Lomo Funghi": "625b436cf612bde9f82ceb159f556e18.png",
  "Lomo al Pil Pil": "bf8005379a7f0ea6af40ccef2860845d.png",
  "Salmon a lo Pobre": "d80d28bba377fcb561291cbcbed141f1.png",
  "Salmon Funghi": "be87c5e8874e3893c968539c4ced2a50.png",
  "Filete de Salmon en Salsa": "6bef5ccba6bce5e095577232476367af.png",
  "Pastel Jaiva Camarón": "1c4c3fc05f1ca40d112bd7e2f194ac02.png",
  "Pastel de Jaiba": "b340954be04507a0360a108efca80c57.png",
  "Crudo": "3652b209309128ee2de62697deb88d80.png",
  "Costillas de Cerdo a lo Pobre": "cca49ea66892411aa3cf2b0547f26cb9.png",
  "Costillas Baby Ribs": "8ccc525678a21e0a7ed2dfd94bbce2b4.png",
  "Camaron Saltado": "93f53025211a7bbe70b56017d4deb5f4.png",
  "Picante de Camaron": "3985bc275b347b6be77d39f124010a4f.png",
  "Pollo grillado en salsa de Whisky": "f4ae5850780e1bb18e5fae9620ef9e3b.png",
  "Filete de pollo a lo pobre": "e85a7a8433c6af5f74544bade3994102.png",
  "Pollo Saltado": "33a43d51e192308a734448e94b5f9e49.png",
  "Pollo Funghi": "6edc276d2d99b9358b8768fb4ebcd7e4.png",
  "Filete de Pollo Grillado": "ccc39d98965b6a80733477469ca50db5.png",
  "Risotto Variedades": "c8d3e623b4545b5492307a1cc2e0f874.png",
  "Fetuccini con Salsa a elección": "4595533b5af72c4ad231fdd723d57258.png",
  "Fetuccini con Salsa a eleción": "4595533b5af72c4ad231fdd723d57258.png",
  "Fetuccini de Lomo Saltado": "dc0ed0c58943df7172fd8ea4cfa47e26.png",
  "Fetuccini de Camarón Saltado": "ed8da4c89a82c8670e202c1fd971babd.png",
  "Fetuccini de Pollo Saltado": "9222f066ee35d22247fb4f90cc702990.png",
  "Yakimeshi Camaron": "991e88badacbea41ad36472fcb4cffcb.png",
  "Yakimeshy Pollo": "02987f387ebae757951a21c09b4f8234.png",

  // Tablas para Compartir
  "Tabla Mixta": "aba62475b3388c1b1668c4c2aebcdbed.png",
  "Tabla Mar y Tierra": "7d603d912e98ab3a83e49fddab56f540.png",
  "Tabla Fried": "3b70e64f12f29e12109c94e2d42ae8d7.png",
  "Tabla Super Fried 2.0": "3b70e64f12f29e12109c94e2d42ae8d7.png",
  "Tabla Cheesse Fried !! NUEVA !!!": "2b709c1c4f083a7825d283f4fc68b93e.png",

  // Sushi
  "Tako Roll": "8946b3dc8fe27ae73109cc600fdc94c4.png",
  "Parrillero Roll": "c3a2e8bebe0cca76ff1f72309f686170.png",
  "Tempura Costa Roll": "8ddac0633ee95685295cf97ebee61f3a.png",
  "Terraza roll": "5fcae26cc7bdc143b7358ca6bd072d5d.png",
  "Tartar Roll": "3220b3ec62fb09b096052a7d9b0ae585.png",
  "Teriyaki Roll": "5ff9439e3e13bf6eeae29ced3c66d8d3.png",
  "Chicken Tocino Roll": "c9bb5b581a223491e14112a8f5f35d2c.png",
  "Alameda Roll": "1f96e6ba3aabf3e0fe91131cbf8e9dd0.png",
  "Mar y Tierra Roll": "caf8ac1f784970c7a495ed794807e33a.png",
  "Sake Roll": "0e7a3a18241b45727e1052fa5a6e473d.png",
  "Tori furay": "67143df5ca3cdd645367da991248deba.png",
  "Tabla Sushi Terraza 38 Bocados": "01c4db9c42d4f35077a1ab6de145651f.png",
  "Tabla Sushi 28 Bocados": "d153eb4d2601dfd36453356cd5085ce5.png",
  "Promo 20 piezas": "65a91d96922f7fea7256689e172f0a8c.png",
  "Promo 30 piezas": "50992c967a9b643a40d20d5eb995b13c.png",
  "Promo 40 piezas": "66f8b1d65ae106c15fc85f060dee275b.png",

  // Sushi sin Arroz
  "Soft Roll": "0951df10577ee98ab7229cb3be47dc22.png",
  "Lucky Roll": "3694b25a8bcb8ec69ac38475de2c5b57.png",
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

async function reuploadPhoto(
  externalUrl: string,
  restaurantId: string,
  dishSlug: string,
): Promise<string | null> {
  try {
    const res = await fetch(externalUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error(`    HTTP ${res.status} for ${externalUrl}`);
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 500) return null;

    let pipeline = sharp(buffer);
    const meta = await pipeline.metadata();
    if (!meta.format) return null;
    if (
      (meta.width && meta.width > 1200) ||
      (meta.height && meta.height > 1200)
    ) {
      pipeline = pipeline.resize(1200, 1200, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }
    const webpBuffer = await pipeline.webp({ quality: 88 }).toBuffer();

    const path = `${restaurantId}/${dishSlug}-${Date.now()}.webp`;
    const { error } = await supabase.storage
      .from("fotos")
      .upload(path, webpBuffer, { contentType: "image/webp", upsert: true });
    if (error) {
      console.error(`    Upload error for ${dishSlug}:`, error.message);
      return null;
    }

    const { data } = supabase.storage.from("fotos").getPublicUrl(path);
    return data.publicUrl;
  } catch (e: any) {
    console.error(`    reupload error for ${dishSlug}:`, e.message);
    return null;
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("Fix Terraza Alameda — Replace Unsplash with real photos");
  console.log("=".repeat(60));

  // 1. Find restaurant
  const restaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [
        { slug: "terraza-alameda" },
        { name: { contains: "Terraza Alameda", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, slug: true, plan: true, defaultView: true },
  });

  if (!restaurant) {
    console.error("Restaurant 'terraza-alameda' not found!");
    return;
  }

  console.log(`\nRestaurant: ${restaurant.name} (${restaurant.id})`);
  console.log(`  Plan: ${restaurant.plan} | defaultView: ${restaurant.defaultView}`);

  // 2. Get all dishes
  const dishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id },
    select: { id: true, name: true, photos: true, photoCredits: true },
  });

  console.log(`\nTotal dishes: ${dishes.length}`);
  const unsplashDishes = dishes.filter((d) =>
    d.photos.some((p: string) => p.includes("unsplash.com")),
  );
  console.log(`Dishes with Unsplash photos: ${unsplashDishes.length}`);

  // 3. Clear ALL Unsplash photos first
  console.log("\n--- Step 1: Clear all Unsplash photos ---");
  let cleared = 0;
  for (const dish of unsplashDishes) {
    await prisma.dish.update({
      where: { id: dish.id },
      data: { photos: [], photoCredits: [], isPhotoReferential: false },
    });
    console.log(`  Cleared: ${dish.name}`);
    cleared++;
  }
  console.log(`  Cleared ${cleared} dishes`);

  // 4. Upload real photos from influye.app
  console.log("\n--- Step 2: Upload real photos from terrazaalameda.cl ---");

  // Build a normalized lookup from our map
  const normalizedMap: Record<string, string> = {};
  for (const [name, file] of Object.entries(DISH_IMAGE_MAP)) {
    normalizedMap[normalizeForMatch(name)] = file;
  }

  // Track which image files we've already uploaded (to reuse Supabase URL)
  const uploadedFiles: Record<string, string> = {};

  let uploaded = 0;
  let matched = 0;
  let noMatch = 0;

  for (const dish of dishes) {
    const normalizedName = normalizeForMatch(dish.name);

    // Try exact normalized match first
    let imageFile = normalizedMap[normalizedName];

    // Try fuzzy: check if any map key contains or is contained in the dish name
    if (!imageFile) {
      for (const [mapNorm, file] of Object.entries(normalizedMap)) {
        if (
          mapNorm.length > 4 &&
          (normalizedName.includes(mapNorm) || mapNorm.includes(normalizedName))
        ) {
          imageFile = file;
          console.log(
            `  Fuzzy: "${dish.name}" matched via "${Object.keys(DISH_IMAGE_MAP).find((k) => normalizeForMatch(k) === mapNorm)}"`,
          );
          break;
        }
      }
    }

    if (!imageFile) {
      noMatch++;
      continue;
    }

    matched++;
    const imageUrl = `${BASE_IMAGE_URL}${imageFile}`;

    // Reuse already-uploaded file if same image
    let supabaseUrl: string | null = null;
    if (uploadedFiles[imageFile]) {
      supabaseUrl = uploadedFiles[imageFile];
      console.log(
        `  Reusing cached: ${dish.name} → ${imageFile.substring(0, 20)}...`,
      );
    } else {
      console.log(`  Uploading: ${dish.name} → ${imageUrl}`);
      supabaseUrl = await reuploadPhoto(
        imageUrl,
        restaurant.id,
        slugify(dish.name),
      );
      if (supabaseUrl) {
        uploadedFiles[imageFile] = supabaseUrl;
        uploaded++;
        console.log(`    ✓ Uploaded`);
      } else {
        console.log(`    ✗ Upload failed`);
      }
    }

    if (supabaseUrl) {
      await prisma.dish.update({
        where: { id: dish.id },
        data: { photos: [supabaseUrl], photoCredits: [], isPhotoReferential: false },
      });
    }
  }

  console.log(`\n  Matched: ${matched} dishes`);
  console.log(`  Uploaded: ${uploaded} unique photos`);
  console.log(`  No real photo available: ${noMatch} dishes (set to empty [])`);

  // 5. Set defaultView to impact
  console.log("\n--- Step 3: Set defaultView to 'impact' ---");
  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { defaultView: "impact" },
  });
  console.log("  ✓ defaultView set to 'impact'");

  // 6. Final summary
  console.log("\n--- Final Summary ---");
  const finalDishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id },
    select: { photos: true },
  });
  const withPhotos = finalDishes.filter((d) => d.photos.length > 0).length;
  const withoutPhotos = finalDishes.filter((d) => d.photos.length === 0).length;
  const stillUnsplash = finalDishes.filter((d) =>
    d.photos.some((p: string) => p.includes("unsplash.com")),
  ).length;

  console.log(`  Total dishes: ${finalDishes.length}`);
  console.log(`  With real photos: ${withPhotos}`);
  console.log(`  Without photos: ${withoutPhotos}`);
  console.log(`  Still Unsplash (should be 0): ${stillUnsplash}`);
  console.log(`  defaultView: impact`);
  console.log("\n✓ Done!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
