"use client";

import { useState } from "react";
import { Printer, Image as ImageIcon } from "lucide-react";
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
  { key: "carbon", label: "Carbon", color: "#d8ad57" },
  { key: "huerto", label: "Huerto", color: "#3f6b4c" },
  { key: "medit", label: "Medit", color: "#2f5d8a" },
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

  return (
    <>
      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={FONT_LINK} />

      {/* Print styles */}
      <style>{`
        @media print {
          .exportar-toolbar { display: none !important; }
          body { margin: 0; padding: 0; }
          .exportar-preview { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
        }
      `}</style>

      {/* Toolbar — hidden in print */}
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
          <ImageIcon size={14} />
          {incluirFotos ? "Con fotos" : "Sin fotos"}
        </button>

        {/* Print button */}
        <button onClick={() => window.print()} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 18px", borderRadius: 10, cursor: "pointer",
          background: GOLD, border: "none",
          fontFamily: F, fontSize: "0.85rem", fontWeight: 700,
          color: "#0a0a0a",
        }}>
          <Printer size={16} />
          Imprimir / PDF
        </button>

        <span style={{
          fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)",
          marginLeft: 4,
        }}>
          Usa "Guardar como PDF" en el cuadro de impresion
        </span>
      </div>

      {/* Preview */}
      <div className="exportar-preview" style={{
        boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
        borderRadius: 8, overflow: "hidden",
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
