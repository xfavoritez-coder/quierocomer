import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: "Supabase no configurado." }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Tipo de archivo no permitido. Usa PDF, Word, Excel, JPG o PNG." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "El archivo es muy grande. Máximo 10MB." }, { status: 400 });
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
    const cartaType = IMAGE_TYPES.includes(file.type) ? "PHOTO" : "DOCUMENT";

    // Detect provider — not applicable for file uploads
    const lead = await prisma.lead.create({
      data: {
        localName: "",
        ownerName: "",
        email: "",
        cartaType,
        cartaFileUrl: urlData.publicUrl,
        cartaStatus: "PENDING",
      },
    });

    return NextResponse.json({
      id: lead.id,
      cartaFileUrl: urlData.publicUrl,
      cartaType,
    });
  } catch (error) {
    console.error("[SubirCarta Upload] Error:", error);
    return NextResponse.json({ error: "Error interno al procesar el archivo." }, { status: 500 });
  }
}
