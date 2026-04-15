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
    let pipeline = sharp(buffer);
    const meta = await pipeline.metadata();
    if ((meta.width && meta.width > 800) || (meta.height && meta.height > 800)) {
      pipeline = pipeline.resize(800, 800, { fit: "inside", withoutEnlargement: true });
    }
    const optimized = await pipeline.webp({ quality: 85 }).toBuffer();

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
