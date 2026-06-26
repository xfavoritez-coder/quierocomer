"use client";

import { useState, useRef } from "react";
import { Download, Image as ImageIcon, ImageOff, Loader2 } from "lucide-react";
import TemaCarbon from "./temas/TemaCarbon";
import TemaHuerto from "./temas/TemaHuerto";
import TemaMedit from "./temas/TemaMedit";

type Tema = "carbon" | "huerto" | "medit";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
}

interface Category {
  id: string;
  name: string;
  position: number;
}

interface Dish {
  id: string;
  name: string;
  description: string | null;
  price: number;
  discountPrice: number | null;
  photos: string[];
  categoryId: string;
  position: number;
}

export interface Section {
  titulo: string;
  platos: {
    nombre: string;
    descripcion: string | null;
    precio: string;
    precioDescuento: string | null;
    foto: string | null;
  }[];
}

interface Props {
  restaurant: Restaurant;
  categories: Category[];
  dishes: Dish[];
}

function formatPrice(price: number): string {
  return `$${price.toLocaleString("es-CL")}`;
}

const FONT_LINK =
  "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Cinzel+Decorative:wght@400;700;900&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Marcellus&family=Jost:wght@300;400;500;600&display=swap";

const F = "var(--font-display)";
const GOLD = "#F4A623";

const TEMAS: { key: Tema; label: string; color: string }[] = [
  { key: "carbon", label: "Carbón", color: "#d8ad57" },
  { key: "huerto", label: "Huerto", color: "#3f6b4c" },
  { key: "medit", label: "Mediterráneo", color: "#2f5d8a" },
];

export default function ExportarCarta({ restaurant, categories, dishes }: Props) {
  const [tema, setTema] = useState<Tema>("carbon");
  const [incluirFotos, setIncluirFotos] = useState(false);

  // Build sections from categories + dishes
  const sections: Section[] = categories.map((cat) => {
    const catDishes = dishes
      .filter((d) => d.categoryId === cat.id)
      .sort((a, b) => a.position - b.position);
    return {
      titulo: cat.name,
      platos: catDishes.map((d) => ({
        nombre: d.name,
        descripcion: d.description || null,
        precio: formatPrice(d.discountPrice ?? d.price),
        precioDescuento: d.discountPrice ? formatPrice(d.price) : null,
        foto: d.photos.length > 0 ? d.photos[0] : null,
      })),
    };
  });

  const TemaComponent = tema === "carbon" ? TemaCarbon : tema === "huerto" ? TemaHuerto : TemaMedit;
  const [downloading, setDownloading] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!sheetRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");

      const el = sheetRef.current;
      const A4_W = 210; // mm
      const A4_H = 297;
      const DPI_SCALE = 2; // high-res capture

      // Capture the rendered element as canvas
      const canvas = await html2canvas(el, {
        scale: DPI_SCALE,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
      });

      const imgW = canvas.width;
      const imgH = canvas.height;

      // Calculate how many A4 pages we need
      const pageHeightPx = (imgW / A4_W) * A4_H; // height of one A4 page in canvas pixels
      const totalPages = Math.ceil(imgH / pageHeightPx);

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();

        // Slice canvas for this page
        const sliceY = page * pageHeightPx;
        const sliceH = Math.min(pageHeightPx, imgH - sliceY);

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = imgW;
        pageCanvas.height = sliceH;
        const ctx = pageCanvas.getContext("2d")!;
        ctx.drawImage(canvas, 0, sliceY, imgW, sliceH, 0, 0, imgW, sliceH);

        const imgData = pageCanvas.toDataURL("image/jpeg", 0.92);
        const hMM = (sliceH / imgW) * A4_W;
        pdf.addImage(imgData, "JPEG", 0, 0, A4_W, hMM);
      }

      const safeName = restaurant.name.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, "").trim().replace(/\s+/g, "-");
      pdf.save(`${safeName}-carta-fisica.pdf`);
    } catch (e) {
      console.error("PDF generation error:", e);
      alert("Error al generar el PDF. Intenta de nuevo.");
    }
    setDownloading(false);
  };

  return (
    <>
      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={FONT_LINK} />

      {/* Toolbar */}
      <div className="exportar-toolbar" style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10,
        marginBottom: 20, padding: "14px 18px",
        background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
        borderRadius: 16,
      }}>
        {/* Theme tabs */}
        <div style={{ display: "flex", gap: 6 }}>
          {TEMAS.map((t) => {
            const active = tema === t.key;
            return (
              <button key={t.key} onClick={() => setTema(t.key)} style={{
                padding: "8px 16px", borderRadius: 10, cursor: "pointer",
                background: active ? `${t.color}18` : "var(--adm-input)",
                border: active ? `1.5px solid ${t.color}` : "1px solid var(--adm-input-border)",
                fontFamily: F, fontSize: "0.8rem", fontWeight: active ? 700 : 500,
                color: active ? t.color : "var(--adm-text2)",
              }}>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Toggle fotos */}
        <button onClick={() => setIncluirFotos((v) => !v)} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 14px", borderRadius: 10, cursor: "pointer",
          background: incluirFotos ? "rgba(244,166,35,0.1)" : "var(--adm-input)",
          border: incluirFotos ? `1.5px solid ${GOLD}` : "1px solid var(--adm-input-border)",
          fontFamily: F, fontSize: "0.8rem", fontWeight: 600,
          color: incluirFotos ? GOLD : "var(--adm-text2)",
        }}>
          {incluirFotos ? <ImageIcon size={14} /> : <ImageOff size={14} />}
          {incluirFotos ? "Fotos activadas" : "Activar fotos"}
        </button>

        {/* Download PDF button */}
        <button onClick={handleDownload} disabled={downloading} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 18px", borderRadius: 10, cursor: downloading ? "wait" : "pointer",
          background: GOLD, border: "none",
          fontFamily: F, fontSize: "0.85rem", fontWeight: 700,
          color: "#0a0a0a", marginLeft: "auto",
          opacity: downloading ? 0.7 : 1,
        }}>
          {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {downloading ? "Generando PDF..." : "Descargar PDF"}
        </button>
      </div>

      <p style={{
        fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)",
        margin: "-12px 0 16px", textAlign: "center",
      }}>
        Elige el diseño, activa fotos si quieres, y descarga el PDF listo para imprimir. El tema Carbón gasta más tinta.
      </p>

      {/* The printable sheet */}
      <div ref={sheetRef} className="exportar-sheet" style={{
        boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
        borderRadius: 8, overflow: "hidden",
        maxWidth: 900, margin: "0 auto",
      }}>
        <TemaComponent
          restaurant={restaurant}
          sections={sections}
          incluirFotos={incluirFotos}
        />
      </div>
    </>
  );
}
