import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const restaurantId = req.nextUrl.searchParams.get("restaurantId");
    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });

    await requireRestaurantForOwner(req, restaurantId);

    const tema = req.nextUrl.searchParams.get("tema") || "carbon";
    const fotos = req.nextUrl.searchParams.get("fotos") === "1";

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true, slug: true, logoUrl: true, address: true, phone: true },
    });
    if (!restaurant) return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });

    const categories = await prisma.category.findMany({
      where: { restaurantId, isActive: true },
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    });

    const dishes = await prisma.dish.findMany({
      where: { restaurantId, isActive: true, deletedAt: null },
      orderBy: { position: "asc" },
      select: { id: true, name: true, description: true, price: true, discountPrice: true, photos: true, categoryId: true },
    });

    // Build sections
    const sections = categories
      .map(cat => {
        const catDishes = dishes.filter(d => d.categoryId === cat.id && d.name && d.price > 0);
        if (catDishes.length === 0) return null;
        return {
          titulo: cat.name,
          platos: catDishes.map(d => ({
            nombre: d.name,
            descripcion: d.description || "",
            precio: `$${(d.discountPrice ?? d.price).toLocaleString("es-CL")}`,
            precioOriginal: d.discountPrice ? `$${d.price.toLocaleString("es-CL")}` : "",
            foto: fotos && d.photos.length > 0 ? d.photos[0] : "",
          })),
        };
      })
      .filter(Boolean) as any[];

    const html = buildHTML(restaurant, sections, tema, fotos);

    // Generate PDF with Puppeteer
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 30000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    await browser.close();

    const safeName = restaurant.name.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, "").trim().replace(/\s+/g, "-");

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}-carta-fisica.pdf"`,
      },
    });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    console.error("[Exportar PDF]", e);
    return NextResponse.json({ error: "Error generando PDF" }, { status: 500 });
  }
}

function formatPrice(p: string) { return p; }

function buildHTML(
  restaurant: { name: string; logoUrl: string | null; address: string | null },
  sections: { titulo: string; platos: { nombre: string; descripcion: string; precio: string; precioOriginal: string; foto: string }[] }[],
  tema: string,
  fotos: boolean,
) {
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Marcellus&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet">`;

  const dishHTML = (p: any) => {
    if (fotos && p.foto) {
      return `<div style="display:flex;align-items:center;gap:10px;break-inside:avoid;margin-bottom:8px">
        <img src="${p.foto}" style="width:56px;height:56px;border-radius:8px;object-fit:cover;flex-shrink:0;border:1px solid rgba(128,128,128,0.2)"/>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:baseline;gap:4px">
            <span class="dn">${p.nombre}</span>
            <span class="dd"></span>
            <span class="dp">${p.precio}${p.precioOriginal ? ` <s style="font-size:9pt;opacity:0.5">${p.precioOriginal}</s>` : ""}</span>
          </div>
          ${p.descripcion ? `<p class="ds">${p.descripcion}</p>` : ""}
        </div>
      </div>`;
    }
    return `<div style="break-inside:avoid;margin-bottom:6px">
      <div style="display:flex;align-items:baseline;gap:4px">
        <span class="dn">${p.nombre}</span>
        <span class="dd"></span>
        <span class="dp">${p.precio}${p.precioOriginal ? ` <s style="font-size:9pt;opacity:0.5">${p.precioOriginal}</s>` : ""}</span>
      </div>
      ${p.descripcion ? `<p class="ds">${p.descripcion}</p>` : ""}
    </div>`;
  };

  const sectionsHTML = sections.map(s => `
    <section style="break-inside:avoid;margin-bottom:24px">
      <h2 class="st">${s.titulo}</h2>
      <div class="${fotos ? "dishes-photo" : "dishes-text"}">${s.platos.map(dishHTML).join("")}</div>
    </section>
  `).join("");

  const logoHTML = restaurant.logoUrl
    ? `<img src="${restaurant.logoUrl}" style="width:54px;height:54px;border-radius:50%;object-fit:cover;margin:0 auto 8px;display:block;border:2px solid var(--accent)"/>`
    : "";
  const addressHTML = restaurant.address ? `<p class="sub">${restaurant.address}</p>` : "";

  const ornament = `<svg viewBox="0 0 200 14" width="160" style="display:block;margin:10px auto 0" fill="none" stroke="var(--accent)" stroke-width="1"><line x1="4" y1="7" x2="78" y2="7"/><line x1="122" y1="7" x2="196" y2="7"/><path d="M88 7 L100 1.5 L112 7 L100 12.5Z" fill="var(--accent)" stroke="none"/><circle cx="82" cy="7" r="1.5" fill="var(--accent)" stroke="none"/><circle cx="118" cy="7" r="1.5" fill="var(--accent)" stroke="none"/></svg>`;

  if (tema === "carbon") {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">${fonts}
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      @page{size:A4;margin:0}
      body{-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0}
      :root{--accent:#d8ad57;--bg:#221b13;--text:#f0e8d8;--dim:#b3a685}
      .page{background:linear-gradient(170deg,#2b231a 0%,#1d1812 50%,#241c14 100%);color:var(--text);font-family:'Cormorant Garamond',serif;padding:20mm 22mm}
      .title{font-family:'Cinzel',serif;font-size:30pt;font-weight:700;color:var(--accent);letter-spacing:0.08em;text-transform:uppercase;text-align:center;margin:0 0 4px}
      .sub{font-size:10pt;color:var(--dim);letter-spacing:0.12em;text-transform:uppercase;text-align:center;margin:0}
      .header{text-align:center;margin-bottom:22px;padding:16px 0}
      .st{font-family:'Cinzel',serif;font-size:15pt;font-weight:700;color:var(--accent);letter-spacing:0.15em;text-transform:uppercase;text-align:center;margin:0 0 14px;padding-bottom:8px;border-bottom:1px solid rgba(216,173,87,0.3)}
      .dishes-text{column-count:2;column-gap:28px}
      .dishes-photo{display:flex;flex-direction:column;gap:6px}
      .dn{font-family:'Cinzel',serif;font-size:12pt;font-weight:700;color:var(--text);white-space:nowrap;flex-shrink:0}
      .dd{flex:1;border-bottom:1px dotted rgba(216,173,87,0.4);min-width:10px;margin-bottom:3px}
      .dp{font-family:'Cinzel',serif;font-size:12pt;font-weight:700;color:var(--accent);white-space:nowrap;flex-shrink:0}
      .ds{font-size:10.5pt;font-style:italic;color:var(--dim);margin:2px 0 0;line-height:1.35}
    </style></head><body>
    <div class="page">
      <div class="header">${logoHTML}<h1 class="title">${restaurant.name}</h1>${addressHTML}${ornament}</div>
      ${sectionsHTML}
    </div></body></html>`;
  }

  if (tema === "huerto") {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">${fonts}
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      @page{size:A4;margin:0}
      body{-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0}
      :root{--accent:#3f6b4c;--bg:#f6f1e3;--text:#2c2c2c;--dim:#6a6a5e;--rust:#bd6a3a}
      .page{background:var(--bg);color:var(--text);font-family:'Jost',sans-serif;padding:20mm 22mm}
      .title{font-family:'Cormorant Garamond',serif;font-size:30pt;font-weight:700;color:var(--accent);text-align:center;margin:0 0 4px}
      .sub{font-size:10pt;color:var(--dim);letter-spacing:0.12em;text-transform:uppercase;text-align:center;margin:0}
      .header{text-align:center;margin-bottom:22px;padding:16px 0}
      .st{font-family:'Cormorant Garamond',serif;font-size:16pt;font-weight:700;color:var(--accent);text-align:center;margin:0 0 14px;display:flex;align-items:center;justify-content:center;gap:8px}
      .st::before,.st::after{content:'';height:1px;flex:1;background:rgba(63,107,76,0.4)}
      .dishes-text{column-count:2;column-gap:28px}
      .dishes-photo{display:flex;flex-direction:column;gap:6px}
      .dn{font-family:'Cormorant Garamond',serif;font-size:12pt;font-weight:700;color:var(--text);white-space:nowrap;flex-shrink:0}
      .dd{flex:1;border-bottom:1px dotted rgba(63,107,76,0.3);min-width:10px;margin-bottom:3px}
      .dp{font-size:12pt;font-weight:600;color:var(--accent);white-space:nowrap;flex-shrink:0}
      .ds{font-size:10.5pt;color:var(--dim);font-style:italic;margin:2px 0 0;line-height:1.35;font-family:'Cormorant Garamond',serif}
    </style></head><body>
    <div class="page">
      <div class="header">${logoHTML}<h1 class="title">${restaurant.name}</h1>${addressHTML}${ornament}</div>
      ${sectionsHTML}
    </div></body></html>`;
  }

  // Mediterráneo
  const tileSVG = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><rect width="44" height="44" fill="#faf4e6"/><path d="M22 5C26 13 31 18 39 22C31 26 26 31 22 39C18 31 13 26 5 22C13 18 18 13 22 5Z" fill="none" stroke="#2f5d8a" stroke-width="1.3"/><circle cx="22" cy="22" r="3.4" fill="none" stroke="#c0622d" stroke-width="1.3"/><circle cx="22" cy="22" r="1.3" fill="#c0622d"/></svg>`)}`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${fonts}
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    @page{size:A4;margin:0}
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0}
    :root{--accent:#2f5d8a;--terra:#c0622d;--bg:#faf4e6;--text:#403428;--dim:#8a7b63}
    .tile-band{height:18mm;background:url("${tileSVG}") center/22mm 22mm}
    .page{background:var(--bg);color:var(--text);font-family:'Jost',sans-serif}
    .inner{padding:18mm 22mm}
    .title{font-family:'Marcellus',serif;font-size:30pt;color:var(--terra);text-align:center;margin:0 0 4px}
    .sub{font-size:10pt;color:var(--dim);letter-spacing:0.12em;text-transform:uppercase;text-align:center;margin:0}
    .header{text-align:center;margin-bottom:22px;padding:16px 0}
    .st{font-family:'Marcellus',serif;font-size:15pt;color:var(--accent);margin:0 0 14px;padding-bottom:6px;border-bottom:2px solid var(--terra);position:relative}
    .st::after{content:'';position:absolute;left:0;bottom:-2px;width:30px;height:2px;background:var(--accent)}
    .dishes-text{column-count:2;column-gap:28px}
    .dishes-photo{display:flex;flex-direction:column;gap:6px}
    .dn{font-size:12pt;font-weight:600;color:var(--text);white-space:nowrap;flex-shrink:0}
    .dd{flex:1;border-bottom:1px dotted #d8cdb4;min-width:10px;margin-bottom:3px}
    .dp{font-size:12pt;font-weight:600;color:var(--terra);white-space:nowrap;flex-shrink:0}
    .ds{font-size:10.5pt;color:var(--dim);margin:2px 0 0;line-height:1.35}
  </style></head><body>
  <div class="page">
    <div class="tile-band"></div>
    <div class="inner">
      <div class="header">${logoHTML}<h1 class="title">${restaurant.name}</h1>${addressHTML}${ornament}</div>
      ${sectionsHTML}
    </div>
    <div class="tile-band"></div>
  </div></body></html>`;
}
