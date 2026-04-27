import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";
import sharp from "sharp";

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const localId = (formData.get("localId") as string) || "unknown";
    const dishName = (formData.get("dishName") as string) || "plato";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    // Accept any image type — sharp will validate and convert
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Solo archivos de imagen" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Máximo 10MB" }, { status: 400 });
    }

    const originalBuffer = Buffer.from(await file.arrayBuffer());
    const originalSize = originalBuffer.length;

    // Process with sharp
    let pipeline = sharp(originalBuffer);
    const meta = await pipeline.metadata();

    if ((meta.width && meta.width > 800) || (meta.height && meta.height > 800)) {
      pipeline = pipeline.resize(800, 800, { fit: "inside", withoutEnlargement: true });
    }

    const optimizedBuffer = await pipeline.webp({ quality: 85 }).toBuffer();
    const optimizedSize = optimizedBuffer.length;

    // Build filename
    const slug = dishName
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    const fileName = `dishes/${localId}-${Date.now()}-${slug}.webp`;

    const { error } = await supabase.storage
      .from("fotos")
      .upload(fileName, optimizedBuffer, { contentType: "image/webp", upsert: true });

    if (error) {
      console.error("[Upload dish image]", error);
      return NextResponse.json({ error: "Error al subir imagen" }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from("fotos").getPublicUrl(fileName);

    return NextResponse.json({
      url: urlData.publicUrl,
      originalSize,
      optimizedSize,
    });
  } catch (e) {
    console.error("[Upload dish image]", e);
    return NextResponse.json({ error: "Error al procesar imagen" }, { status: 500 });
  }
}
