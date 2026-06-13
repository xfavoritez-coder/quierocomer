import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://awbeyxfqtrdfhengabmw.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YmV5eGZxdHJkZmhlbmdhYm13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTQwMDgsImV4cCI6MjA5MTc3MDAwOH0.Eygu40U_oqgGcAYp9NG1nEsiUdocK7RQPd2jLC11W0E"
);

async function main() {
  const res = await fetch("https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1780133047284-ht76n4b1848.jpg");
  const buffer = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(buffer).metadata();
  console.log("Original:", meta.width, "x", meta.height);

  const w = meta.width!, h = meta.height!;
  const cropTop = Math.round(h * 0.38);
  const cropLeft = Math.round(w * 0.18);
  const cropW = Math.min(Math.round(w * 0.64), w - cropLeft);
  const cropH = Math.min(Math.round(h * 0.25), h - cropTop);
  console.log("Crop:", cropLeft, cropTop, cropW, cropH);

  const cropped = await sharp(buffer)
    .extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH })
    .resize(400, 400, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .jpeg({ quality: 90 })
    .toBuffer();

  const fileName = `logos/pavito-logo-${Date.now()}.jpg`;
  const { data, error } = await supabase.storage.from("fotos").upload(fileName, cropped, {
    contentType: "image/jpeg",
    upsert: false,
  });

  if (error) { console.error("Upload error:", error); return; }
  console.log("Uploaded:", data.path);

  const { data: urlData } = supabase.storage.from("fotos").getPublicUrl(data.path);
  console.log("URL:", urlData.publicUrl);

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
