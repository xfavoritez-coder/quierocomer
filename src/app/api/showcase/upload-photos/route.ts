import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import sharp from "sharp";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("photos") as File[];
    if (!files.length) return NextResponse.json({ error: "No photos" }, { status: 400 });

    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const buffer = Buffer.from(await file.arrayBuffer());
      const optimized = await sharp(buffer)
        .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      const fileName = `showcase/temp-${Date.now()}-${i}.webp`;
      const { error } = await supabase.storage
        .from("fotos")
        .upload(fileName, optimized, { contentType: "image/webp", upsert: true });
      if (error) {
        console.error(`[showcase/upload] Supabase error:`, error.message);
        continue;
      }
      const { data } = supabase.storage.from("fotos").getPublicUrl(fileName);
      urls.push(data.publicUrl);
    }

    if (!urls.length) return NextResponse.json({ error: "No se pudieron subir las fotos" }, { status: 500 });
    return NextResponse.json({ urls });
  } catch (e: any) {
    console.error("[showcase/upload] Error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
