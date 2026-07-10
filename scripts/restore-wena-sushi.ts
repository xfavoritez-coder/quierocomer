import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

/**
 * Restore photos for Wena Pizza and Sushi Austral.
 * Their photos were accidentally cleared during activation due to a bug.
 *
 * This script:
 * 1. Re-extracts dishes from their original menu URLs
 * 2. Matches extracted dishes to existing ones and restores photos
 * 3. Sets defaultView to "impact"
 * 4. Deletes promotions
 * 5. Sends apology email
 */
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const prisma = new PrismaClient();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

function slugify(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function upgradePhotoUrl(url: string): string {
  return url
    .replace(/\/w_\d+/g, "/w_1200").replace(/\/h_\d+/g, "/h_1200")
    .replace(/\?width=\d+/g, "?width=1200").replace(/&width=\d+/g, "&width=1200")
    .replace(/\?w=\d+/g, "?w=1200").replace(/&w=\d+/g, "&w=1200")
    .replace(/\?height=\d+/g, "?height=1200").replace(/&height=\d+/g, "&height=1200")
    .replace(/\/\d+x\d+\//g, "/1200x1200/")
    .replace(/_\d+x\d+\./g, ".").replace(/-\d+x\d+\./g, ".")
    .replace(/_(?:small|compact|medium|grande|thumb|thumbnail|large)(\.\w+)$/, "$1")
    .replace(/\/(?:small|compact|medium|thumb|thumbnail)\//, "/large/")
    .replace(/\/c_\w+,w_\d+,h_\d+/, "/c_fill,w_1200,h_1200")
    .replace(/\/t_\w+\//, "/t_original/");
}

async function reuploadPhoto(externalUrl: string, restaurantId: string, dishSlug: string): Promise<string | null> {
  try {
    const hdUrl = upgradePhotoUrl(externalUrl);
    let res = await fetch(hdUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    if (!res || !res.ok) {
      res = await fetch(externalUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
        signal: AbortSignal.timeout(8000),
      });
    }
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 500) return null;

    let pipeline = sharp(buffer);
    const meta = await pipeline.metadata();
    if (!meta.format) return null;
    if ((meta.width && meta.width > 1200) || (meta.height && meta.height > 1200)) {
      pipeline = pipeline.resize(1200, 1200, { fit: "inside", withoutEnlargement: true });
    }
    const webpBuffer = await pipeline.webp({ quality: 88 }).toBuffer();

    const path = `${restaurantId}/${dishSlug}-${Date.now()}.webp`;
    const { error } = await supabase.storage.from("fotos").upload(path, webpBuffer, { contentType: "image/webp", upsert: true });
    if (error) { console.error(`  Upload error for ${dishSlug}:`, error.message); return null; }

    const { data } = supabase.storage.from("fotos").getPublicUrl(path);
    return data.publicUrl;
  } catch (e: any) {
    console.error(`  reupload error for ${dishSlug}:`, e.message);
    return null;
  }
}

// Dynamically import extractors (they use env vars at call time)
async function extractMenu(url: string, provider: string) {
  if (provider === "olaclick") {
    const { extractOlaClick } = await import("../src/lib/extractors/olaclick");
    return extractOlaClick(url);
  }
  // atom.bio → generic scraper
  const { extractWithScraper } = await import("../src/lib/extractors/scrape");
  return extractWithScraper(url);
}

function normalizeForMatch(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
}

async function restoreRestaurant(slug: string, cartaUrl: string, provider: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Restoring: ${slug} from ${cartaUrl} (${provider})`);
  console.log("=".repeat(60));

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { id: true, name: true, owner: { select: { email: true, name: true } } },
  });
  if (!restaurant) { console.error(`Restaurant ${slug} not found!`); return; }

  // Step 1: Extract menu from source
  console.log("\n1. Extracting menu from source URL...");
  const extraction = await extractMenu(cartaUrl, provider);
  console.log(`   Extracted: ${extraction.dishes.length} dishes`);
  for (const d of extraction.dishes) {
    console.log(`   - [${d.category}] ${d.name}: $${d.price} ${d.imageUrl ? "📷" : "no photo"}`);
  }

  // Step 2: Match extracted dishes to existing ones and restore photos
  console.log("\n2. Matching and restoring photos...");
  const existingDishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id },
    select: { id: true, name: true, photos: true },
  });

  let restored = 0;
  for (const extracted of extraction.dishes) {
    if (!extracted.imageUrl) continue;

    // Find matching existing dish by normalized name
    const normalizedExtracted = normalizeForMatch(extracted.name);
    const match = existingDishes.find(d => normalizeForMatch(d.name) === normalizedExtracted);

    if (match) {
      // Re-upload photo to Supabase
      const dishSlug = slugify(match.name);
      const supabaseUrl = await reuploadPhoto(extracted.imageUrl, restaurant.id, dishSlug);
      const finalUrl = supabaseUrl || extracted.imageUrl;

      await prisma.dish.update({
        where: { id: match.id },
        data: { photos: [finalUrl], isPhotoReferential: false, photoCredits: [] },
      });
      console.log(`   ✓ ${match.name}: photo restored`);
      restored++;
    } else {
      console.log(`   ✗ No match for "${extracted.name}" — checking fuzzy...`);
      // Fuzzy: try contains
      const fuzzy = existingDishes.find(d =>
        normalizeForMatch(d.name).includes(normalizedExtracted) ||
        normalizedExtracted.includes(normalizeForMatch(d.name))
      );
      if (fuzzy) {
        const dishSlug = slugify(fuzzy.name);
        const supabaseUrl = await reuploadPhoto(extracted.imageUrl, restaurant.id, dishSlug);
        const finalUrl = supabaseUrl || extracted.imageUrl;
        await prisma.dish.update({
          where: { id: fuzzy.id },
          data: { photos: [finalUrl], isPhotoReferential: false, photoCredits: [] },
        });
        console.log(`   ✓ Fuzzy matched "${extracted.name}" → "${fuzzy.name}": photo restored`);
        restored++;
      }
    }
  }
  console.log(`   Restored ${restored}/${extraction.dishes.filter(d => d.imageUrl).length} photos`);

  // Step 3: Set defaultView to impact
  console.log("\n3. Setting defaultView to impact...");
  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { defaultView: "impact" },
  });

  // Step 4: Delete promotions
  console.log("4. Deleting promotions...");
  const deleted = await prisma.promotion.deleteMany({ where: { restaurantId: restaurant.id } });
  console.log(`   Deleted ${deleted.count} promotions`);

  // Step 5: Send apology email
  console.log("5. Sending apology email...");
  const ownerEmail = restaurant.owner?.email;
  const ownerName = (restaurant.owner?.name || "").split(" ")[0] || "Hola";

  if (ownerEmail) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";
    const cartaLink = `${baseUrl}/qr/${slug}`;

    const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;margin-top:32px;margin-bottom:32px;">

  <div style="background:#18181b;padding:32px 24px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">QuieroComer</h1>
  </div>

  <div style="padding:32px 24px;">
    <p style="font-size:16px;color:#18181b;line-height:1.6;margin:0 0 16px;">
      ${ownerName}, te pedimos disculpas.
    </p>
    <p style="font-size:16px;color:#374151;line-height:1.6;margin:0 0 16px;">
      Tuvimos un problema técnico al activar tu cuenta que afectó las fotos de tu carta digital.
      Ya lo solucionamos: <strong>restauramos todas las fotos de tus platos</strong> y tu carta está lista para usar.
    </p>
    <p style="font-size:16px;color:#374151;line-height:1.6;margin:0 0 24px;">
      Además, activamos la <strong>vista Impact</strong> para que tus platos se vean con fotos grandes y atractivas desde el primer momento.
    </p>

    <div style="text-align:center;margin:32px 0;">
      <a href="${cartaLink}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;">
        Ver mi carta
      </a>
    </div>

    <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:24px 0 0;">
      Lamentamos las molestias. Si necesitas cualquier ajuste o tienes dudas, responde directamente a este correo y te ayudamos.
    </p>
  </div>

  <div style="padding:20px 24px;background:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="margin:0;font-size:13px;color:#9ca3af;">
      QuieroComer — Tu carta digital profesional
    </p>
  </div>

</div>
</body></html>`;

    // Use Resend directly (can't import from src in scripts easily)
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.FROM_EMAIL ? `QuieroComer <${process.env.FROM_EMAIL}>` : "QuieroComer <onboarding@resend.dev>";

    const { data, error } = await resend.emails.send({
      from,
      to: ownerEmail,
      subject: `${ownerName}, restauramos las fotos de tu carta`,
      html: emailHtml,
    });

    if (error) {
      console.error(`   Email error:`, error);
    } else {
      console.log(`   ✓ Email sent to ${ownerEmail} (id: ${data?.id})`);
    }

    // Log email
    await prisma.emailLog.create({
      data: { to: ownerEmail, subject: `${ownerName}, restauramos las fotos de tu carta`, purpose: "apology_photo_restore", status: "sent" },
    }).catch(() => {});
  } else {
    console.log("   No owner email found, skipping");
  }

  console.log(`\n✓ Done: ${restaurant.name}`);
}

async function main() {
  await restoreRestaurant("wena-pizza", "https://www.atom.bio/wenapizza", "atom.bio");
  await restoreRestaurant("sushi-austral", "https://sushiaustral-chl.ola.click/products", "olaclick");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
