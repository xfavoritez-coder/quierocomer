import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { checkAdminAuth, authErrorResponse } from "@/lib/adminAuth";

export const maxDuration = 60;

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_SIZE = 15 * 1024 * 1024; // 15MB

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "Formato no permitido" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Imagen demasiado grande (máx 15MB)" }, { status: 400 });

  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `cartas/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from("fotos")
    .upload(fileName, buffer, { contentType: file.type, upsert: true });

  if (error) {
    console.error("[upload-menu-photo]", error);
    return NextResponse.json({ error: "Error al subir imagen" }, { status: 500 });
  }

  const { data } = supabase.storage.from("fotos").getPublicUrl(fileName);
  return NextResponse.json({ url: data.publicUrl });
}
