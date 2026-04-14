import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "general";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: "Tipo de archivo no permitido. Usa JPG, PNG, WebP o GIF." }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "El archivo es muy grande. Máximo 5MB." }, { status: 400 });

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage
      .from("fotos")
      .upload(fileName, buffer, { contentType: file.type, upsert: true });

    if (error) {
      console.error("[Upload] Supabase error:", error);
      return NextResponse.json({ error: "Error al subir archivo" }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from("fotos").getPublicUrl(fileName);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (error) {
    console.error("[Upload] Error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
