import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

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

    const buffer = Buffer.from(await file.arrayBuffer());

    const slug = promoName
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    const ts = Date.now();
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const fileName = `promos/${ts}-${slug}.${ext}`;

    const { error } = await supabase.storage
      .from("fotos")
      .upload(fileName, buffer, { contentType: file.type, upsert: true });

    if (error) {
      console.error("[Upload promo]", error);
      return NextResponse.json({ error: "Error al subir: " + error.message }, { status: 500 });
    }

    const url = supabase.storage.from("fotos").getPublicUrl(fileName).data.publicUrl;

    return NextResponse.json({ url, thumbUrl: url });
  } catch (e: any) {
    console.error("[Upload promo]", e);
    return NextResponse.json({ error: "Error: " + (e.message || "desconocido") }, { status: 500 });
  }
}
