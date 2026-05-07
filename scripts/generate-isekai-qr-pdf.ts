/**
 * Genera un PDF imprimible con los QR de Isekai Ramen para
 * stickers de 7×7 cm en hoja de 10×15 cm.
 *
 * Uso:
 *   npx tsx scripts/generate-isekai-qr-pdf.ts
 *   → genera isekai-qr-stickers.pdf en la raíz del repo
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: "isekai-ramen" },
    select: { name: true, slug: true, qrToken: true },
  });
  if (!restaurant) throw new Error("Isekai Ramen no encontrado");

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
  const qrUrl = `${baseUrl}/qr/${restaurant.slug}${restaurant.qrToken ? `?t=${restaurant.qrToken}` : ""}`;

  // Generar QR como dataURL PNG en alta resolución
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 1400, // alta resolucion para imprimir nitido a 70mm
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  // PDF: 100×150 mm, sin margenes
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [100, 150],
  });

  // Sticker 1 (mitad superior, 0-75mm)
  // QR de 70×70mm centrado: x=15, y=2.5
  pdf.addImage(qrDataUrl, "PNG", 15, 2.5, 70, 70);

  // Linea de corte tenue al medio (75mm)
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineDashPattern([1, 1], 0);
  pdf.setLineWidth(0.1);
  pdf.line(5, 75, 95, 75);

  // Sticker 2 (mitad inferior, 75-150mm)
  // QR de 70×70mm centrado: x=15, y=77.5
  pdf.addImage(qrDataUrl, "PNG", 15, 77.5, 70, 70);

  const outPath = path.join(process.cwd(), "isekai-qr-stickers.pdf");
  fs.writeFileSync(outPath, Buffer.from(pdf.output("arraybuffer")));

  console.log(`\n✓ PDF generado: ${outPath}`);
  console.log(`  · Hoja: 100×150 mm (sin margenes)`);
  console.log(`  · QR: 70×70 mm × 2 stickers por hoja`);
  console.log(`  · URL del QR: ${qrUrl}\n`);
  console.log("Para imprimir:");
  console.log("  1. Abrir el PDF (Adobe Reader, Edge, Chrome, etc.)");
  console.log("  2. Imprimir → Tamaño real / Actual size (NO ajustar/scale)");
  console.log("  3. Tamaño papel: Custom 100×150 mm");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
