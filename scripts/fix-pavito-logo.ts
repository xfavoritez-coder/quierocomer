import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Download current logo
  const res = await fetch("https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1780133047284-ht76n4b1848.jpg");
  const buffer = Buffer.from(await res.arrayBuffer());
  
  const meta = await sharp(buffer).metadata();
  console.log("Original:", meta.width, "x", meta.height);
  
  // Crop to the center where the actual logo is
  // The bird is roughly in the center, between y=450 and y=900 in a ~720x1600 image
  const w = meta.width!;
  const h = meta.height!;
  
  // Extract center portion containing the bird
  const cropTop = Math.round(h * 0.35);
  const cropBottom = Math.round(h * 0.65);
  const cropHeight = cropBottom - cropTop;
  const cropLeft = Math.round(w * 0.15);
  const cropWidth = Math.round(w * 0.7);
  
  const cropped = await sharp(buffer)
    .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
    .resize(400, 400, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .jpeg({ quality: 90 })
    .toBuffer();
  
  console.log("Cropped to 400x400");
  
  // Upload to Supabase
  const fileName = `logos/pavito-logo-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("fotos").upload(fileName, cropped, {
    contentType: "image/jpeg",
    upsert: true,
  });
  
  if (error) { console.error("Upload error:", error); return; }
  
  const { data: urlData } = supabase.storage.from("fotos").getPublicUrl(fileName);
  console.log("New URL:", urlData.publicUrl);
  
  // Update DB
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  await db.restaurant.update({
    where: { slug: "la-picada-del-pa-vito" },
    data: { logoUrl: urlData.publicUrl },
  });
  console.log("✓ Logo actualizado en DB");
  await db.$disconnect();
}

main().catch(console.error);
