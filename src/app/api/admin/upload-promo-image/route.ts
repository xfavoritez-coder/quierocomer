import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  checkAdminAuth,
  assertOwnsRestaurant,
  authErrorResponse,
} from "@/lib/adminAuth";

export const config = { api: { bodyParser: false } };
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const promoName = (formData.get("promoName") as string) || "promo";
    const restaurantId = formData.get("restaurantId") as string | null;

    // Ownership check if restaurantId provided
    if (restaurantId) {
      await assertOwnsRestaurant(req, restaurantId);
    }

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
    const fileName = `general/promo-${ts}-${slug}.${ext}`;

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
    if (e.status === 403) return authErrorResponse(e);
    console.error("[Upload promo]", e);
    return NextResponse.json({ error: "Error: " + (e.message || "desconocido") }, { status: 500 });
  }
}
