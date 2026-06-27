"use client";

import { useState, useRef } from "react";
import { Printer, Image as ImageIcon, ImageOff } from "lucide-react";
import TemaCarbon from "./temas/TemaCarbon";
import TemaHuerto from "./temas/TemaHuerto";
import TemaMedit from "./temas/TemaMedit";
import TemaPiedra from "./temas/TemaPiedra";
import { renderToStaticMarkup } from "react-dom/server";

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
  const sheetRef = useRef<HTMLDivElement>(null);
  const isTrial = !isPaid;
  const visibleSections = isTrial ? sections.slice(0, 2) : sections;
  const lockedSections = isTrial ? sections.slice(2) : [];

  const handlePrint = () => {
    if (!sheetRef.current) return;

    // Get the inner HTML of the rendered tema
    const html = sheetRef.current.innerHTML;

    // Also grab all <style> tags from the sheet (tema styles)
    const styleTags = sheetRef.current.querySelectorAll("style");
    let styles = "";
    styleTags.forEach((s) => { styles += s.outerHTML; });

    const safeName = restaurant.name.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, "").trim().replace(/\s+/g, "-");

    // Open a new window with ONLY the carta
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Permite las ventanas emergentes para descargar el PDF.");
      return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeName} — Carta</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${FONT_LINK}" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4; margin: 0; }
    html, body {
      margin: 0; padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body { background: #fff; }
    img { max-width: 100%; }
  </style>
  ${styles}
</head>
<body>
  ${html}
  <script>
    // Wait for fonts and images to load, then auto-print
    Promise.all([
      document.fonts.ready,
      ...Array.from(document.images).map(img =>
        img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
      )
    ]).then(() => {
      setTimeout(() => { window.print(); }, 300);
    });
  </script>
</body>
</html>`);
    printWindow.document.close();

    // Track
    fetch("/api/admin/exportar/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId: restaurant.id, action: "exportar_carta_pdf", tema, fotos: incluirFotos }),
      keepalive: true,
    }).catch(() => {});
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

        {/* Theme tabs */}
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

          <button
            onClick={isTrial
              ? () => window.dispatchEvent(new CustomEvent("show-plan-modal", { detail: { initialTab: "PREMIUM" } }))
              : handlePrint
            }
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 18px", borderRadius: 10, cursor: "pointer",
              background: isTrial ? "var(--adm-input)" : GOLD, border: isTrial ? "1px solid var(--adm-input-border)" : "none",
              fontFamily: F, fontSize: "0.82rem", fontWeight: 700,
              color: isTrial ? "var(--adm-text3)" : "#0a0a0a",
            }}>
            <Printer size={16} />
            {isTrial ? "Premium requerido" : "Guardar como PDF"}
          </button>
        </div>

        <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "10px 0 0", lineHeight: 1.4 }}>
          Se abrirá una ventana de impresión. Selecciona &quot;Guardar como PDF&quot; como destino.
        </p>
      </div>

      {/* Responsive styles */}
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

      {/* Preview sheet */}
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
            <div style={{ filter: "blur(8px)", opacity: 0.5, pointerEvents: "none", userSelect: "none" }}>
              <TemaComponent
                restaurant={{ ...restaurant, name: "", logoUrl: null, address: null, phone: null }}
                sections={lockedSections}
                incluirFotos={incluirFotos}
              />
            </div>
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
                  Suscríbete al plan Premium para exportar tu carta completa.
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
