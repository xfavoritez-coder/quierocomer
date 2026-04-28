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

    // Process with sharp — maximize quality within 120KB target
    const TARGET_BYTES = 120 * 1024;
    const MAX_DIMENSION = 1400;

    let img = sharp(originalBuffer);
    const meta = await img.metadata();

    // Resize only if exceeds max dimension
    if ((meta.width && meta.width > MAX_DIMENSION) || (meta.height && meta.height > MAX_DIMENSION)) {
      img = img.resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true });
    }

    // Adaptive quality: start high, reduce until under target size
    let optimizedBuffer: Buffer;
    let quality = 92;
    do {
      optimizedBuffer = await img.clone().webp({ quality, smartSubsample: true }).toBuffer();
      if (optimizedBuffer.length <= TARGET_BYTES) break;
      quality -= 4;
    } while (quality >= 40);

    // If still over target after quality reduction, scale down resolution
    if (optimizedBuffer.length > TARGET_BYTES) {
      const scaledMeta = await sharp(optimizedBuffer).metadata();
      const scale = Math.sqrt(TARGET_BYTES / optimizedBuffer.length) * 0.95;
      const newW = Math.round((scaledMeta.width || 800) * scale);
      optimizedBuffer = await sharp(originalBuffer)
        .resize(newW, undefined, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 78, smartSubsample: true })
        .toBuffer();
    }

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
