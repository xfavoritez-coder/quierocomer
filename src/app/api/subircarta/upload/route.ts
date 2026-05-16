import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { rateLimit, RATE_LIMITS, getClientIp, formatRetryAfter } from "@/lib/rateLimit";

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];

export async function POST(req: NextRequest) {
  try {
    // Rate limit
    const ip = getClientIp(req);
    const rl = rateLimit(`subircarta:${ip}`, RATE_LIMITS.subircarta);
    if (!rl.success) {
      return NextResponse.json(
        { error: `Demasiados intentos. Intenta de nuevo en ${formatRetryAfter(rl.retryAfterMs)}.` },
        { status: 429 },
      );
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: "Supabase no configurado." }, { status: 500 });
    }

    const formData = await req.formData();
    const files = formData.getAll("file") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
    }
    if (files.length > 10) {
      return NextResponse.json({ error: "Máximo 10 archivos." }, { status: 400 });
    }

    const uploadedUrls: string[] = [];
    let cartaType: "PHOTO" | "DOCUMENT" = "PHOTO";

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json({ error: `Tipo no permitido: ${file.name}. Usa JPG, PNG, WebP, HEIC o PDF.` }, { status: 400 });
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: `${file.name} es muy grande. Máximo 10MB.` }, { status: 400 });
      }

      const ext = file.name.split(".").pop() || "bin";
      const fileName = `cartas/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from("fotos")
        .upload(fileName, buffer, { contentType: file.type, upsert: true });

      if (uploadError) {
        console.error("[SubirCarta Upload] Supabase error:", uploadError);
        return NextResponse.json({ error: "Error al subir el archivo." }, { status: 500 });
      }

      const { data: urlData } = supabase.storage.from("fotos").getPublicUrl(fileName);
      uploadedUrls.push(urlData.publicUrl);

      if (!IMAGE_TYPES.includes(file.type)) cartaType = "DOCUMENT";
    }

    const lead = await prisma.lead.create({
      data: {
        localName: "",
        ownerName: "",
        email: "",
        cartaType,
        cartaFileUrl: uploadedUrls.join(","),
        cartaStatus: "PENDING",
      },
    });

    return NextResponse.json({
      id: lead.id,
      cartaFileUrl: uploadedUrls[0],
      cartaType,
    });
  } catch (error) {
    console.error("[SubirCarta Upload] Error:", error);
    return NextResponse.json({ error: "Error interno al procesar el archivo." }, { status: 500 });
  }
}
