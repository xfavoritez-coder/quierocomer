import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import sharp from "sharp";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_token")?.value) {
    return NextResponse.json({ error: "Not auth" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const promoName = (formData.get("promoName") as string) || "promo";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: "Solo JPG, PNG o WebP" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Máximo 10MB" }, { status: 400 });
    }

    const originalBuffer = Buffer.from(await file.arrayBuffer());

    const slug = promoName
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    const ts = Date.now();

    // Full image: max 1200px wide, webp quality 85
    const fullBuffer = await sharp(originalBuffer)
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const fullName = `promos/${ts}-${slug}.webp`;

    // Thumbnail: 300px wide, quality 75
    const thumbBuffer = await sharp(originalBuffer)
      .resize(300, 300, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    const thumbName = `promos/${ts}-${slug}-thumb.webp`;

    // Upload both
    const [fullResult, thumbResult] = await Promise.all([
      supabase.storage.from("fotos").upload(fullName, fullBuffer, { contentType: "image/webp", upsert: true }),
      supabase.storage.from("fotos").upload(thumbName, thumbBuffer, { contentType: "image/webp", upsert: true }),
    ]);

    if (fullResult.error || thumbResult.error) {
      console.error("[Upload promo]", fullResult.error, thumbResult.error);
      return NextResponse.json({ error: "Error al subir imagen" }, { status: 500 });
    }

    const fullUrl = supabase.storage.from("fotos").getPublicUrl(fullName).data.publicUrl;
    const thumbUrl = supabase.storage.from("fotos").getPublicUrl(thumbName).data.publicUrl;

    return NextResponse.json({ url: fullUrl, thumbUrl });
  } catch (e) {
    console.error("[Upload promo]", e);
    return NextResponse.json({ error: "Error al procesar imagen" }, { status: 500 });
  }
}
