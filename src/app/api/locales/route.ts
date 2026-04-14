import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { makeLocalSlug } from "@/lib/slugify";

// Aliases for categories that users might type differently
const CATEGORIA_ALIASES: Record<string, string> = {
  "mexicana": "Mexicano", "mexicano": "Mexicano", "tacos": "Mexicano",
  "sushi": "Sushi", "japonesa": "Sushi", "japones": "Sushi",
  "pizza": "Pizza", "pizzas": "Pizza",
  "hamburguesa": "Hamburguesa", "hamburguesas": "Hamburguesa", "burger": "Hamburguesa",
  "vegano": "Vegano", "vegana": "Vegano",
  "vegetariano": "Vegetariano", "vegetariana": "Vegetariano",
  "saludable": "Saludable",
  "pastas": "Pastas", "pasta": "Pastas", "italiana": "Pastas",
  "pollo": "Pollo", "pollos": "Pollo",
  "mariscos": "Mariscos", "pescado": "Mariscos",
  "carnes": "Carnes / Parrilla", "parrilla": "Carnes / Parrilla", "asado": "Carnes / Parrilla",
  "arabe": "Árabe", "árabe": "Árabe",
  "peruano": "Peruano", "peruana": "Peruano", "ceviche": "Peruano",
  "india": "India", "hindu": "India",
  "coreano": "Coreano", "coreana": "Coreano", "korean": "Coreano",
  "thai": "Thai", "tailandesa": "Thai",
  "ramen": "Ramen",
  "fusion": "Fusión", "fusión": "Fusión",
  "cafe": "Café", "café": "Café", "cafeteria": "Café",
  "postres": "Postres", "postre": "Postres",
  "brunch": "Brunch",
  "chifa": "Chifa",
  "empanadas": "Empanadas", "empanada": "Empanadas",
  "poke": "Poke Bowl", "poke bowl": "Poke Bowl",
  "sandwich": "Sandwich", "sandwiches": "Sandwich",
  "jugos": "Jugos y Smoothies", "smoothies": "Jugos y Smoothies",
  "mediterraneo": "Mediterráneo", "mediterráneo": "Mediterráneo",
  "sin gluten": "Sin gluten",
};

/**
 * Parse a free-text search query to extract comuna, category, and remaining text.
 * Handles patterns like "sushi en quinta normal", "comida mexicana en la florida", etc.
 */
function parseSearchQuery(q: string): { comunaDetected: string | null; categoriaDetected: string | null; remainingText: string } {
  let text = q.toLowerCase().trim();
  let comunaDetected: string | null = null;
  let categoriaDetected: string | null = null;

  // Try to extract comuna — check longest names first to match "Quinta Normal" before "Normal"
  const COMUNAS_LIST = ["Providencia", "Santiago Centro", "Ñuñoa", "Las Condes", "Vitacura", "San Miguel", "Maipú", "La Florida", "Pudahuel", "Peñalolén", "Macul", "La Reina", "Lo Barnechea", "Huechuraba", "Recoleta", "Independencia", "Estación Central", "Cerrillos", "Cerro Navia", "Conchalí", "El Bosque", "La Cisterna", "La Granja", "La Pintana", "Lo Espejo", "Lo Prado", "Quilicura", "Quinta Normal", "Renca", "San Bernardo", "San Joaquín", "San Ramón", "Padre Hurtado", "Puente Alto", "Pirque", "Colina", "Lampa", "Melipilla", "Talagante", "Pedro Aguirre Cerda", "Buin"];
  const comunasSorted = [...COMUNAS_LIST].sort((a, b) => b.length - a.length);
  for (const comuna of comunasSorted) {
    const idx = text.indexOf(comuna.toLowerCase());
    if (idx !== -1) {
      comunaDetected = comuna;
      // Remove the comuna and any preceding "en", "de", "en la", etc.
      let start = idx;
      const before = text.slice(0, idx).trimEnd();
      if (before.endsWith(" en") || before.endsWith(" de")) {
        start = before.lastIndexOf(" ") === -1 ? 0 : before.lastIndexOf(" ");
      }
      text = (text.slice(0, start) + " " + text.slice(idx + comuna.length)).trim();
      break;
    }
  }

  // Try to extract category from remaining text
  const words = text.split(/\s+/).filter(w => w.length > 0);
  // Check multi-word aliases first (e.g., "poke bowl", "sin gluten")
  for (const [alias, cat] of Object.entries(CATEGORIA_ALIASES)) {
    if (alias.includes(" ") && text.includes(alias)) {
      categoriaDetected = cat;
      text = text.replace(alias, "").trim();
      break;
    }
  }
  // Check single-word aliases
  if (!categoriaDetected) {
    for (const word of words) {
      const cat = CATEGORIA_ALIASES[word];
      if (cat) {
        categoriaDetected = cat;
        text = text.replace(new RegExp(`\\b${word}\\b`, "i"), "").trim();
        break;
      }
    }
  }
  // Also check exact category names
  if (!categoriaDetected) {
    const CATEGORIAS_LIST = ["Sushi", "Pizza", "Hamburguesa", "Mexicano", "Vegano", "Vegetariano", "Saludable", "Pastas", "Pollo", "Mariscos", "Carnes / Parrilla", "Árabe", "Peruano", "India", "Coreano", "Thai", "Ramen", "Fusión", "Café", "Postres", "Brunch", "Chifa", "Empanadas", "Poke Bowl", "Sandwich", "Jugos y Smoothies", "Mediterráneo", "Sin gluten"];
    for (const cat of CATEGORIAS_LIST) {
      if (text.includes(cat.toLowerCase())) {
        categoriaDetected = cat;
        text = text.replace(new RegExp(cat, "i"), "").trim();
        break;
      }
    }
  }

  // Clean up remaining text — remove filler words
  const remaining = text.replace(/\b(en|de|la|el|los|las|por|para|con|comida|restaurante|restaurant|local)\b/gi, "").replace(/\s+/g, " ").trim();

  return { comunaDetected, categoriaDetected, remainingText: remaining };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoria = searchParams.get("categoria");
    const comuna = searchParams.get("comuna");
    const q = searchParams.get("q");
    const cursor = searchParams.get("cursor");
    const paginated = searchParams.get("paginated") === "1" || !!cursor;
    const limit = paginated ? Math.min(Number(searchParams.get("limit")) || 24, 60) : 500;

    // Parse free-text query to extract structured filters
    const parsed = q ? parseSearchQuery(q) : null;
    const efectiveComuna = comuna || parsed?.comunaDetected || null;
    const efectiveCategoria = categoria || parsed?.categoriaDetected || null;
    const remainingQ = parsed?.remainingText || null;

    const hayFiltros = !!(categoria || comuna || q);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
        AND: [
          // Base: only active locales
          { OR: [{ activo: true }, { estadoLocal: "ACTIVO", origenImportacion: "GOOGLE_PLACES" }] },
          { nombre: { not: "" } },
          { categorias: { isEmpty: false } },
          { NOT: { estadoLocal: "RECHAZADO" } },
          // Category filter (from dropdown OR parsed from query)
          ...(efectiveCategoria ? [{ categorias: { has: efectiveCategoria } }] : []),
          // Comuna filter (from dropdown OR parsed from query)
          ...(efectiveComuna ? [{ comuna: efectiveComuna }] : []),
          // Remaining search text after extracting comuna/category
          ...(remainingQ ? [{
            OR: [
              { nombre: { contains: remainingQ, mode: "insensitive" as const } },
              { descripcion: { contains: remainingQ, mode: "insensitive" as const } },
              ...remainingQ.split(/\s+/).filter(w => w.length > 2).map(w => ({ nombre: { contains: w, mode: "insensitive" as const } })),
            ],
          }] : []),
          // If query had no structured parts detected, fall back to broad text search
          ...(q && !efectiveComuna && !efectiveCategoria && !remainingQ ? [{
            OR: [
              { nombre: { contains: q, mode: "insensitive" as const } },
              { comuna: { contains: q, mode: "insensitive" as const } },
              { categorias: { hasSome: q.split(/\s+/).filter(w => w.length > 2).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) } },
              { descripcion: { contains: q, mode: "insensitive" as const } },
            ],
          }] : []),
        ],
      };

    // Count only on first page with filters (no cursor = first page)
    const totalCount = (paginated && hayFiltros && !cursor)
      ? await prisma.local.count({ where: whereClause })
      : undefined;

    const locales = await prisma.local.findMany({
      take: paginated ? limit + 1 : limit,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      where: whereClause,
      include: paginated ? {
        _count: { select: { favoritos: true, resenas: true, concursos: true, promociones: true } },
        resenas: { select: { rating: true } },
        promociones: { where: { activa: true }, select: { id: true, titulo: true, descripcion: true, horaInicio: true, horaFin: true }, take: 3 },
        concursos: { where: { activo: true, cancelado: false, fechaFin: { gt: new Date() } }, select: { id: true, slug: true, premio: true, fechaFin: true }, take: 3 },
      } : undefined,
      ...(!paginated && {
        select: {
          id: true, slug: true, nombre: true, categorias: true, comuna: true, activo: true,
          googleRating: true, estadoLocal: true, portadaUrl: true, logoUrl: true,
          tieneDelivery: true, comunasDelivery: true, tieneRetiro: true, linkPedido: true,
          horarioGoogle: true, horarios: true,
          _count: { select: { concursos: true } },
          concursos: { where: { activo: true, cancelado: false, fechaFin: { gt: new Date() } }, select: { id: true, slug: true, premio: true, fechaFin: true }, take: 1 },
        },
      }),
    });
    if (paginated) {
      const addRating = (l: typeof locales[number]) => {
        const { password: _, resenas, ...rest } = l as any;
        const promedioResenas = resenas?.length > 0
          ? resenas.reduce((sum: number, r: any) => sum + r.rating, 0) / resenas.length
          : null;
        return { ...rest, promedioResenas };
      };
      const hasMore = locales.length > limit;
      const results = hasMore ? locales.slice(0, limit) : locales;
      const safe = results.map(addRating);
      const nextCursor = hasMore ? results[results.length - 1].id : null;
      return NextResponse.json({ locales: safe, nextCursor, hasMore, ...(totalCount !== undefined && { totalCount }) });
    }
    const safe = locales.map((l: any) => {
      const { password: _, ...rest } = l;
      return rest;
    });
    return NextResponse.json(safe, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("[API /locales GET] Error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { nombre, nombreDueno, nombreEncargado, email, password, telefono, ciudad, registroRapido, passwordPlain, captadorCodigo, categorias: rawCategorias } = await req.json();
    const VALID_CATEGORIAS = ["Sushi", "Pizza", "Hamburguesa", "Mexicano", "Vegano", "Vegetariano", "Saludable", "Pastas", "Pollo", "Mariscos", "Carnes / Parrilla", "Árabe", "Peruano", "India", "Coreano", "Thai", "Ramen", "Fusión", "Café", "Postres", "Brunch", "Chifa", "Empanadas", "Poke Bowl", "Sandwich", "Jugos y Smoothies", "Mediterráneo", "Sin gluten"];
    const categorias = Array.isArray(rawCategorias)
      ? rawCategorias.filter((c: string) => VALID_CATEGORIAS.includes(c)).slice(0, 3)
      : [];

    if (!nombre || !email || !password) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    const existe = await prisma.local.findUnique({ where: { email } });
    if (existe) {
      return NextResponse.json({ error: "Este email ya está registrado" }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 10);
    const slug = makeLocalSlug(nombre, ciudad);

    // Resolve captador if code provided
    let captadorData: { captadorId: string; captadorCodigo: string } | undefined;
    if (captadorCodigo) {
      try {
        const captador = await prisma.captador.findUnique({ where: { codigo: captadorCodigo } });
        if (captador) captadorData = { captadorId: captador.id, captadorCodigo: captador.codigo };
      } catch { /* ignore */ }
    }

    // Check founder cupos
    let esFounder = false;
    try {
      const [cfgTotal, cfgUsados] = await Promise.all([
        prisma.configSite.findUnique({ where: { clave: "cupos_founder_total" } }),
        prisma.configSite.findUnique({ where: { clave: "cupos_founder_usados" } }),
      ]);
      const total = cfgTotal ? parseInt(cfgTotal.valor) : 50;
      const usados = cfgUsados ? parseInt(cfgUsados.valor) : 0;
      if (usados < total) {
        esFounder = true;
        await prisma.configSite.upsert({ where: { clave: "cupos_founder_usados" }, create: { clave: "cupos_founder_usados", valor: "1" }, update: { valor: String(usados + 1) } });
      }
    } catch {}

    const local = await prisma.local.create({
      data: {
        nombre, slug, nombreDueno: nombreDueno || nombreEncargado, celularDueno: telefono,
        email, password: hash, ciudad, activo: false,
        ...(nombreEncargado && { nombreEncargado }),
        ...(registroRapido && { registroRapido: true }),
        ...(captadorData && captadorData),
        ...(esFounder && { esFounder: true, founderAt: new Date() }),
        ...(categorias.length > 0 && { categorias }),
      },
    });

    // Track campaign conversion
    try {
      const contacto = await prisma.contactoCampana.findFirst({ where: { email: email.toLowerCase() } });
      if (contacto) {
        await prisma.contactoCampana.update({ where: { id: contacto.id }, data: { seRegistro: true } });
      }
    } catch {}

    // Send welcome email for quick registration
    if (registroRapido && passwordPlain) {
      try {
        const { resend } = await import("@/lib/resend");
        const fromEmail = process.env.FROM_EMAIL ? `QuieroComer <${process.env.FROM_EMAIL}>` : "QuieroComer <onboarding@resend.dev>";
        await resend.emails.send({
          from: fromEmail,
          to: email,
          subject: "¡Bienvenido a QuieroComer! Aquí están tus datos",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;background:#fff;border-radius:12px">
              <div style="text-align:center;padding:20px;background:linear-gradient(135deg,#e8a84c,#d4922a);border-radius:12px;margin-bottom:24px">
                <p style="font-size:28px;margin:0 0 8px">🧞</p>
                <h1 style="color:#fff;font-size:20px;margin:0">¡Bienvenido a QuieroComer!</h1>
              </div>
              <p>Hola <strong>${nombreEncargado || nombreDueno || ""}!</strong></p>
              <p>Tu local <strong>${nombre}</strong> ha sido registrado exitosamente.</p>
              <p>Aquí están tus datos de acceso al panel:</p>
              <div style="background:#faf7f2;border:1px solid rgba(180,130,40,0.2);border-radius:10px;padding:16px;margin:16px 0">
                <p style="margin:4px 0"><strong>Email:</strong> ${email}</p>
                <p style="margin:4px 0"><strong>Contraseña:</strong> ${passwordPlain}</p>
              </div>
              <p style="text-align:center;margin:24px 0">
                <a href="https://quierocomer.cl/login-local" style="background:#e8a84c;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block">Entrar al panel →</a>
              </p>
              <p style="font-size:13px;color:#888">Para aparecer en QuieroComer, completa tu perfil: sube tu logo, foto de portada, dirección, horarios y categoría.</p>
              <hr style="border:none;border-top:1px solid #eee;margin:20px 0" />
              <p style="font-size:12px;color:#aaa;text-align:center">QuieroComer — La plataforma gastronómica de Chile</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("[Email registro rápido]", emailErr);
      }
    }

    const { password: _, ...localSinPassword } = local;
    return NextResponse.json(localSinPassword, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
