"use client";

import { useState, useRef, useEffect } from "react";
import { Download, Image as ImageIcon, ImageOff, Loader2 } from "lucide-react";
import TemaCarbon from "./temas/TemaCarbon";
import TemaHuerto from "./temas/TemaHuerto";
import TemaMedit from "./temas/TemaMedit";
import TemaPiedra from "./temas/TemaPiedra";

type Tema = "carbon" | "huerto" | "medit" | "piedra";

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
  isPaid?: boolean;
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
  { key: "piedra", label: "Piedra", color: "#8a7e72" },
];

export default function ExportarCarta({ restaurant, categories, dishes, isPaid = false }: Props) {
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

  const TemaComponent = tema === "carbon" ? TemaCarbon : tema === "huerto" ? TemaHuerto : tema === "medit" ? TemaMedit : TemaPiedra;
  const [downloading, setDownloading] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const isTrial = !isPaid;
  // Trial: only show first 2 sections, rest are locked
  const visibleSections = isTrial ? sections.slice(0, 2) : sections;
  const lockedSections = isTrial ? sections.slice(2) : [];

  // Track is done server-side via logActivity in /api/admin/exportar

  const handleDownload = async () => {
    if (!sheetRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");

      const el = sheetRef.current;
      const A4_W = 210; // mm
      const A4_H = 297;
      const DPI_SCALE = 2;

      // Force a fixed width for consistent PDF output (794px ≈ A4 at 96dpi)
      const origWidth = el.style.width;
      const origMaxWidth = el.style.maxWidth;
      const origTransform = el.style.transform;
      el.style.width = "794px";
      el.style.maxWidth = "794px";
      el.style.transform = "none";

      // Pre-convert all images to base64 via canvas (bypasses CORS if already rendered)
      const imgs = el.querySelectorAll("img");
      const origSrcs: { img: HTMLImageElement; src: string }[] = [];
      for (const img of Array.from(imgs)) {
        if (!img.src || img.src.startsWith("data:") || !img.naturalWidth) continue;
        try {
          // Method 1: draw to canvas (works if image is already loaded and rendered)
          const c = document.createElement("canvas");
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          const ctx = c.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const dataUrl = c.toDataURL("image/jpeg", 0.8);
            if (dataUrl.length > 100) {
              origSrcs.push({ img, src: img.src });
              img.src = dataUrl;
              continue;
            }
          }
        } catch {}
        // Method 2: fetch with no-cors proxy fallback
        try {
          const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(img.src)}`);
          if (res.ok) {
            const blob = await res.blob();
            const dataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
            origSrcs.push({ img, src: img.src });
            img.src = dataUrl;
          }
        } catch {}
      }
      await new Promise(r => setTimeout(r, 100));

      // ── Smart page-aware PDF: capture full sheet, cut at section boundaries ──

      const canvas = await html2canvas(el, {
        scale: DPI_SCALE,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
        width: 794,
      });

      // Restore original styles and srcs
      el.style.width = origWidth;
      el.style.maxWidth = origMaxWidth;
      el.style.transform = origTransform;
      for (const { img, src } of origSrcs) img.src = src;

      const imgW = canvas.width;
      const imgH = canvas.height;
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: "a4" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const scale = pdfW / imgW;
      const pageHPx = pdfH / scale; // one A4 page height in canvas pixels

      // Find section boundaries (top of each data-pdf-section in canvas coords)
      const sectionEls = el.querySelectorAll("[data-pdf-section]");
      const elTop = el.getBoundingClientRect().top;
      const cutPoints: number[] = [0]; // start of content

      if (sectionEls.length > 0) {
        for (const sec of Array.from(sectionEls)) {
          const rect = sec.getBoundingClientRect();
          const yInCanvas = (rect.top - elTop) * DPI_SCALE;
          cutPoints.push(yInCanvas);
        }
      }
      cutPoints.push(imgH); // end of content

      // Group sections into pages: accumulate until next section would overflow
      const pages: { startY: number; endY: number }[] = [];
      let pageStartY = 0;

      for (let i = 1; i < cutPoints.length; i++) {
        const sectionEnd = cutPoints[i];
        const pageContentH = sectionEnd - pageStartY;

        if (pageContentH > pageHPx && i > 1) {
          // This section would overflow — finalize current page at previous cut point
          pages.push({ startY: pageStartY, endY: cutPoints[i - 1] });
          pageStartY = cutPoints[i - 1];
        }
      }
      // Add final page
      if (pageStartY < imgH) {
        pages.push({ startY: pageStartY, endY: imgH });
      }

      // If no sections found, fall back to simple slicing
      if (pages.length === 0) {
        const totalSimple = Math.ceil(imgH / pageHPx);
        for (let p = 0; p < totalSimple; p++) {
          pages.push({ startY: p * pageHPx, endY: Math.min((p + 1) * pageHPx, imgH) });
        }
      }

      // Render each page
      for (let p = 0; p < pages.length; p++) {
        if (p > 0) pdf.addPage();
        const { startY, endY } = pages[p];
        const sliceH = endY - startY;

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = imgW;
        pageCanvas.height = sliceH;
        const ctx = pageCanvas.getContext("2d")!;
        ctx.drawImage(canvas, 0, startY, imgW, sliceH, 0, 0, imgW, sliceH);

        const imgData = pageCanvas.toDataURL("image/jpeg", 0.85);
        const renderedH = sliceH * scale;
        pdf.addImage(imgData, "JPEG", 0, 0, pdfW, renderedH);
      }

      const totalPages = pages.length;
      const safeName = restaurant.name.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, "").trim().replace(/\s+/g, "-");
      pdf.save(`${safeName}-carta-fisica.pdf`);

      // Track PDF download via logActivity
      fetch("/api/admin/exportar/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: restaurant.id, action: "exportar_carta_pdf", tema, fotos: incluirFotos, pages: totalPages }),
        keepalive: true,
      }).catch(() => {});
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

      {/* Header */}
      <div style={{
        background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
        borderRadius: 16, padding: "18px 16px", marginBottom: 16,
      }}>
        <h2 style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px" }}>
          Carta imprimible
        </h2>
        <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 14px", lineHeight: 1.5 }}>
          Elige un diseño, personaliza y descarga tu carta como PDF.
        </p>

        {/* Theme tabs — horizontal scroll on mobile */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", marginBottom: 10, paddingBottom: 2 }}>
          {TEMAS.map((t) => {
            const active = tema === t.key;
            return (
              <button key={t.key} onClick={() => setTema(t.key)} style={{
                padding: "7px 14px", borderRadius: 10, cursor: "pointer", flexShrink: 0,
                background: active ? `${t.color}18` : "var(--adm-input)",
                border: active ? `1.5px solid ${t.color}` : "1px solid var(--adm-input-border)",
                fontFamily: F, fontSize: "0.78rem", fontWeight: active ? 700 : 500,
                color: active ? t.color : "var(--adm-text2)",
              }}>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Actions row */}
        <div className="exportar-actions" style={{ display: "flex", gap: 8 }}>
          {/* Toggle fotos */}
          <button onClick={() => setIncluirFotos((v) => !v)} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 14px", borderRadius: 10, cursor: "pointer",
            background: incluirFotos ? "rgba(244,166,35,0.1)" : "var(--adm-input)",
            border: incluirFotos ? `1.5px solid ${GOLD}` : "1px solid var(--adm-input-border)",
            fontFamily: F, fontSize: "0.78rem", fontWeight: 600,
            color: incluirFotos ? GOLD : "var(--adm-text2)",
          }}>
            {incluirFotos ? <ImageIcon size={14} /> : <ImageOff size={14} />}
            {incluirFotos ? "Fotos activadas" : "Activar fotos"}
          </button>

          {/* Download PDF button */}
          <button
            onClick={isTrial
              ? () => window.dispatchEvent(new CustomEvent("show-plan-modal", { detail: { initialTab: "PREMIUM" } }))
              : handleDownload
            }
            disabled={downloading}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 18px", borderRadius: 10, cursor: downloading ? "wait" : "pointer",
              background: isTrial ? "var(--adm-input)" : GOLD, border: isTrial ? "1px solid var(--adm-input-border)" : "none",
              fontFamily: F, fontSize: "0.82rem", fontWeight: 700,
              color: isTrial ? "var(--adm-text3)" : "#0a0a0a",
              opacity: downloading ? 0.7 : 1,
            }}>
            {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {isTrial ? "Premium requerido" : downloading ? "Generando..." : "Descargar PDF"}
          </button>
        </div>
      </div>

      {/* Responsive scale styles for mobile preview */}
      <style>{`
        @media (max-width: 640px) {
          .exportar-sheet { transform: scale(0.5); transform-origin: top left; width: 200% !important; }
          .exportar-sheet-wrapper { overflow: hidden; }
          .exportar-actions { flex-wrap: wrap; }
          .exportar-actions button { flex: 1 1 auto !important; justify-content: center; }
        }
        @media (min-width: 641px) and (max-width: 900px) {
          .exportar-sheet { transform: scale(0.75); transform-origin: top left; width: 133.33% !important; }
          .exportar-sheet-wrapper { overflow: hidden; }
        }
      `}</style>

      {/* The printable sheet */}
      <div className="exportar-sheet-wrapper" style={{ overflow: "hidden", borderRadius: 8, position: "relative" }}>
      <div ref={sheetRef} className="exportar-sheet" style={{
        boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
        overflow: "hidden",
        maxWidth: 900,
      }}>
        <TemaComponent
          restaurant={restaurant}
          sections={visibleSections}
          incluirFotos={incluirFotos}
        />
      </div>

      {/* Locked sections for trial users */}
      {isTrial && lockedSections.length > 0 && (
        <div style={{ position: "relative" }}>
          {/* Blurred preview of remaining sections */}
          <div style={{ filter: "blur(8px)", opacity: 0.5, pointerEvents: "none", userSelect: "none" }}>
            <TemaComponent
              restaurant={{ ...restaurant, name: "", logoUrl: null, address: null, phone: null }}
              sections={lockedSections}
              incluirFotos={incluirFotos}
            />
          </div>
          {/* Overlay with upgrade CTA */}
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 12,
            background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)",
            borderRadius: "0 0 8px 8px",
          }}>
            <div style={{
              background: "rgba(0,0,0,0.7)", borderRadius: 16, padding: "24px 32px",
              textAlign: "center", maxWidth: 360,
            }}>
              <p style={{ fontSize: "2rem", margin: "0 0 8px" }}>🔒</p>
              <p style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "#fff", margin: "0 0 6px" }}>
                {lockedSections.length} sección{lockedSections.length !== 1 ? "es" : ""} más
              </p>
              <p style={{ fontFamily: F, fontSize: "0.82rem", color: "rgba(255,255,255,0.7)", margin: "0 0 16px", lineHeight: 1.5 }}>
                Suscríbete al plan Premium para exportar tu carta completa en PDF.
              </p>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("show-plan-modal", { detail: { initialTab: "PREMIUM" } }))}
                style={{
                  padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: GOLD, color: "#0a0a0a", fontFamily: F, fontSize: "0.85rem", fontWeight: 700,
                }}
              >
                Ver plan Premium
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
