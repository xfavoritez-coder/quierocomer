import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSellerFromRequest } from "@/lib/ventas/session";

export const runtime = "nodejs";
export const maxDuration = 60;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_SIZE = 10 * 1024 * 1024;

/** POST /api/ventas/upload (form-data: file) → { url }  Foto de la carta tomada por el vendedor. */
export async function POST(req: NextRequest) {
  const seller = await getSellerFromRequest(req);
  if (!seller) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No se recibió la foto" }, { status: 400 });
  if (!IMAGE_TYPES.includes(file.type)) return NextResponse.json({ error: "Usa una foto JPG, PNG, WebP o HEIC" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "La foto pesa más de 10 MB" }, { status: 400 });
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `cartas/ventas/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("fotos").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) { console.error("[ventas upload]", error); return NextResponse.json({ error: "No se pudo subir la foto" }, { status: 500 }); }
  return NextResponse.json({ url: supabase.storage.from("fotos").getPublicUrl(path).data.publicUrl });
}
