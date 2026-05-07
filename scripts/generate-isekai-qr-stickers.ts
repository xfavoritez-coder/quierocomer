/**
 * Genera un HTML imprimible con los QR de Isekai Ramen para
 * stickers de 7×7 cm en hoja de 10×15 cm (formato sticker estandar).
 *
 * Uso:
 *   npx tsx scripts/generate-isekai-qr-stickers.ts
 *   → genera scripts/isekai-qr-stickers.html
 *
 * Imprimir desde el navegador (Ctrl+P) seleccionando:
 *   - Tamaño de papel: Custom 100×150 mm
 *   - Margenes: ninguno
 *   - Escala: 100% (NO ajustar a la pagina)
 *   - Color: Color
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: "isekai-ramen" },
    select: { id: true, name: true, slug: true, qrToken: true },
  });
  if (!restaurant) throw new Error("Isekai Ramen no encontrado");

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
  const qrUrl = `${baseUrl}/qr/${restaurant.slug}${restaurant.qrToken ? `?t=${restaurant.qrToken}` : ""}`;

  // Generamos el QR como SVG en alta densidad: nivel H (~30% recovery)
  // permite que el QR siga siendo escaneable aun con un pequeño logo encima
  // o leves manchas. Margen interno minimo.
  const qrSvg = await QRCode.toString(qrUrl, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 2,
    width: 700, // se reescala via CSS al tamaño físico
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Stickers QR — ${restaurant.name}</title>
  <style>
    /* Hoja de stickers: 100mm × 150mm. 2 QRs de 70×70mm apilados verticalmente. */
    @page {
      size: 100mm 150mm;
      margin: 0;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      width: 100mm;
      height: 150mm;
      background: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #1a1a1a;
    }

    .sheet {
      width: 100mm;
      height: 150mm;
      display: flex;
      flex-direction: column;
      page-break-after: always;
    }

    /* Cada sticker ocupa la mitad de la hoja (75mm) */
    .sticker {
      width: 100mm;
      height: 75mm;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    /* Linea de corte tenue entre los dos stickers (no se imprime fuerte) */
    .sticker:first-child {
      border-bottom: 0.2mm dashed #cccccc;
    }

    .qr-wrap {
      width: 70mm;
      height: 70mm;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .qr-wrap svg {
      width: 70mm !important;
      height: 70mm !important;
      display: block;
    }

    /* Pantalla: simulamos el papel con sombra para vista previa */
    @media screen {
      body {
        background: #2a2a2a;
        padding: 24px;
        width: auto;
        height: auto;
        min-height: 100vh;
      }
      .sheet {
        background: white;
        margin: 0 auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      }
      .info {
        max-width: 600px;
        margin: 0 auto 24px;
        padding: 20px 24px;
        background: #1a1a1a;
        border-radius: 12px;
        color: #f0f0f0;
        font-size: 14px;
        line-height: 1.6;
      }
      .info h1 { color: #F4A623; font-size: 18px; margin-bottom: 8px; }
      .info code { background: #000; padding: 2px 6px; border-radius: 3px; color: #F4A623; }
      .info ol { margin: 10px 0 0 20px; }
    }

    @media print {
      .info { display: none; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="info">
    <h1>Stickers QR — ${restaurant.name}</h1>
    <p>Hoja: <strong>100×150 mm</strong> · QR: <strong>70×70 mm</strong> · 2 stickers por hoja</p>
    <p style="margin-top: 6px; opacity: 0.7;">URL: <code>${qrUrl}</code></p>
    <ol style="margin-top: 12px;">
      <li>Imprimir con Ctrl+P / Cmd+P</li>
      <li>Tamaño papel: <strong>Custom 100×150 mm</strong> (o "Personalizado")</li>
      <li>Márgenes: <strong>Ninguno</strong></li>
      <li>Escala: <strong>100%</strong> (NO "ajustar a la página")</li>
      <li>Color y calidad alta</li>
    </ol>
  </div>

  <div class="sheet">
    <div class="sticker">
      <div class="qr-wrap">${qrSvg}</div>
    </div>
    <div class="sticker">
      <div class="qr-wrap">${qrSvg}</div>
    </div>
  </div>
</body>
</html>`;

  const outPath = path.join(process.cwd(), "isekai-qr-stickers.html");
  fs.writeFileSync(outPath, html);
  console.log(`\n✓ Imprimible generado: ${outPath}`);
  console.log(`  · Hoja: 100×150 mm`);
  console.log(`  · QR: 70×70 mm × 2 stickers por hoja`);
  console.log(`  · URL del QR: ${qrUrl}\n`);
  console.log("Pasos para imprimir:");
  console.log("  1. Abrir el archivo .html en Chrome o Edge");
  console.log("  2. Ctrl+P → Tamaño: Custom 100×150 mm · Margenes: ninguno · Escala: 100%");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
