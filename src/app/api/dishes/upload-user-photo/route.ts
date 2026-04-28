import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import sharp from "sharp";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const menuItemId = formData.get("menuItemId") as string;
    const sessionId = formData.get("sessionId") as string;

    if (!file || !menuItemId) {
      return NextResponse.json({ success: false, error: "Archivo y menuItemId requeridos" }, { status: 400 });
    }

    // Check dish exists and has no photo
    const dish = await prisma.menuItem.findUnique({ where: { id: menuItemId }, select: { imagenUrl: true, nombre: true } });
    if (!dish) return NextResponse.json({ success: false, error: "Plato no encontrado" }, { status: 404 });

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ success: false, error: "Solo JPG, PNG o WebP" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const TARGET_BYTES = 200 * 1024;
    const MAX_DIMENSION = 1600;

    let img = sharp(buffer).rotate(); // auto-rotate from EXIF

    const meta = await img.metadata();
    if ((meta.width && meta.width > MAX_DIMENSION) || (meta.height && meta.height > MAX_DIMENSION)) {
      img = img.resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true });
    }

    // Adaptive quality: start very high, reduce until under target
    let optimized: Buffer;
    let quality = 95;
    do {
      optimized = await img.clone().webp({ quality, effort: 6, smartSubsample: true }).toBuffer();
      if (optimized.length <= TARGET_BYTES) break;
      quality -= 3;
    } while (quality >= 50);

    // If still over target, scale down resolution proportionally
    if (optimized.length > TARGET_BYTES) {
      const scaledMeta = await sharp(optimized).metadata();
      const scale = Math.sqrt(TARGET_BYTES / optimized.length) * 0.95;
      const newW = Math.round((scaledMeta.width || 1000) * scale);
      optimized = await sharp(buffer).rotate()
        .resize(newW, undefined, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82, effort: 6, smartSubsample: true })
        .toBuffer();
    }

    const slug = (dish.nombre ?? "plato").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").slice(0, 30);
    const fileName = `dishes/user-${sessionId?.slice(0, 8) ?? "anon"}-${menuItemId.slice(0, 8)}-${Date.now()}-${slug}.webp`;

    const { error } = await supabase.storage.from("fotos").upload(fileName, optimized, { contentType: "image/webp", upsert: true });
    if (error) {
      return NextResponse.json({ success: false, error: "Error al subir" }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from("fotos").getPublicUrl(fileName);
    await prisma.menuItem.update({ where: { id: menuItemId }, data: { imagenUrl: urlData.publicUrl } });

    return NextResponse.json({ success: true, url: urlData.publicUrl });
  } catch (e) {
    console.error("[Upload user photo]", e);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
