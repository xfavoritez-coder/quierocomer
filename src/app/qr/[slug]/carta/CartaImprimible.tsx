"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { useEffect, useRef } from "react";

type Template = "clasico" | "moderno" | "rustico";

interface Dish {
  id: string;
  name: string;
  description: string | null;
  price: number;
  discountPrice: number | null;
  photos: string[];
  tags: string[];
  dishDiet: string | null;
  isSpicy: boolean | null;
}

interface Section {
  id: string;
  name: string;
  dishes: Dish[];
}

interface Promo {
  id: string;
  name: string;
  description: string | null;
  promoPrice: number | null;
  originalPrice: number | null;
}

interface Restaurant {
  name: string;
  slug: string;
  logoUrl: string | null;
  accent: string;
  phone: string | null;
  address: string | null;
  instagram: string | null;
  website: string | null;
  whatsapp: string | null;
}

interface Props {
  restaurant: Restaurant;
  sections: Section[];
  promotions: Promo[];
  qrUrl: string;
  initialTemplate: Template;
}

function QRCodeCanvas({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, { width: 120, margin: 1, color: { dark: "#000", light: "#fff" } });
    }
  }, [url]);
  return <canvas ref={canvasRef} />;
}

function formatPrice(n: number) {
  return `$${n.toLocaleString("es-CL")}`;
}

function DishDietIcon({ diet, isSpicy }: { diet: string | null; isSpicy: boolean | null }) {
  return (
    <>
      {diet === "VEGAN" && <span title="Vegano" style={{ fontSize: "0.7em" }}> (V)</span>}
      {diet === "VEGETARIAN" && <span title="Vegetariano" style={{ fontSize: "0.7em" }}> (Veg)</span>}
      {isSpicy && <span title="Picante" style={{ fontSize: "0.7em" }}> *</span>}
    </>
  );
}

// ═══════════════════════════════════════════════
// TEMPLATE: CLASICO
// ═══════════════════════════════════════════════
function TemplateClasico({ restaurant, sections, promotions, qrUrl }: Omit<Props, "initialTemplate">) {
  return (
    <div className="carta-print" style={{ fontFamily: "'Cormorant Garamond', 'Georgia', serif", color: "#1a1a1a", maxWidth: 800, margin: "0 auto", padding: "48px 56px" }}>
      {/* Header */}
      <header style={{ textAlign: "center", marginBottom: 40, borderBottom: "2px solid #1a1a1a", paddingBottom: 28 }}>
        {restaurant.logoUrl && (
          <img src={restaurant.logoUrl} alt="" style={{ height: 64, marginBottom: 12, objectFit: "contain" }} />
        )}
        <h1 style={{ fontSize: 36, fontWeight: 500, letterSpacing: 4, textTransform: "uppercase", margin: "0 0 6px" }}>{restaurant.name}</h1>
        {restaurant.address && <p style={{ fontSize: 13, color: "#666", margin: 0, fontFamily: "'Inter', sans-serif" }}>{restaurant.address}</p>}
      </header>

      {/* Promos */}
      {promotions.length > 0 && (
        <section style={{ marginBottom: 32, border: "1px solid #ddd", borderRadius: 4, padding: "16px 20px" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", margin: "0 0 12px", fontFamily: "'Inter', sans-serif" }}>Ofertas</h2>
          {promotions.map(p => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                {p.promoPrice != null && <span style={{ fontSize: 15, fontWeight: 700 }}>{formatPrice(p.promoPrice)}</span>}
                {p.originalPrice != null && p.promoPrice != null && <del style={{ fontSize: 12, color: "#999" }}>{formatPrice(p.originalPrice)}</del>}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Categories */}
      {sections.map(sec => (
        <section key={sec.id} style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 22, fontWeight: 500, fontStyle: "italic", borderBottom: "1px solid #ccc", paddingBottom: 6, marginBottom: 14 }}>{sec.name}</h2>
          {sec.dishes.map(d => (
            <div key={d.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>
                  {d.tags?.includes("RECOMMENDED") && <span style={{ color: restaurant.accent }}>★ </span>}
                  {d.name}
                  <DishDietIcon diet={d.dishDiet} isSpicy={d.isSpicy} />
                </span>
                <span style={{ flexShrink: 0, borderBottom: "1px dotted #ccc", flex: 1, margin: "0 8px", minWidth: 20 }} />
                <span style={{ fontSize: 15, fontWeight: 600, flexShrink: 0 }}>
                  {d.discountPrice ? (
                    <><span style={{ color: restaurant.accent }}>{formatPrice(Math.min(d.price, d.discountPrice))}</span> <del style={{ fontSize: 12, color: "#999" }}>{formatPrice(Math.max(d.price, d.discountPrice))}</del></>
                  ) : formatPrice(d.price)}
                </span>
              </div>
              {d.description && <p style={{ fontSize: 12, color: "#777", margin: "2px 0 0", fontFamily: "'Inter', sans-serif", lineHeight: 1.4 }}>{d.description}</p>}
            </div>
          ))}
        </section>
      ))}

      {/* Footer */}
      <footer style={{ textAlign: "center", marginTop: 40, paddingTop: 24, borderTop: "2px solid #1a1a1a" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 20 }}>
          <div>
            <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px", fontFamily: "'Inter', sans-serif", letterSpacing: 2, textTransform: "uppercase" }}>Carta digital</p>
            <QRCodeCanvas url={qrUrl} />
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: "#999", fontFamily: "'Inter', sans-serif" }}>
          {[restaurant.phone, restaurant.instagram && `@${restaurant.instagram}`, restaurant.website].filter(Boolean).join(" · ")}
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════
// TEMPLATE: MODERNO
// ═══════════════════════════════════════════════
function TemplateModerno({ restaurant, sections, promotions, qrUrl }: Omit<Props, "initialTemplate">) {
  return (
    <div className="carta-print" style={{ fontFamily: "'Inter', 'Helvetica Neue', sans-serif", color: "#111", maxWidth: 800, margin: "0 auto", padding: "40px 48px" }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 36, paddingBottom: 20, borderBottom: `3px solid ${restaurant.accent}` }}>
        {restaurant.logoUrl && (
          <img src={restaurant.logoUrl} alt="" style={{ height: 52, objectFit: "contain" }} />
        )}
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>{restaurant.name}</h1>
          {restaurant.address && <p style={{ fontSize: 12, color: "#888", margin: "2px 0 0" }}>{restaurant.address}</p>}
        </div>
      </header>

      {/* Promos */}
      {promotions.length > 0 && (
        <section style={{ marginBottom: 28, background: "#f8f8f8", borderRadius: 8, padding: "14px 18px", borderLeft: `4px solid ${restaurant.accent}` }}>
          <h2 style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: restaurant.accent, margin: "0 0 10px" }}>Ofertas</h2>
          {promotions.map(p => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
              <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                {p.promoPrice != null && <span style={{ fontSize: 13, fontWeight: 800, color: restaurant.accent }}>{formatPrice(p.promoPrice)}</span>}
                {p.originalPrice != null && p.promoPrice != null && <del style={{ fontSize: 11, color: "#bbb" }}>{formatPrice(p.originalPrice)}</del>}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Two-column layout */}
      <div style={{ columnCount: 2, columnGap: 32 }}>
        {sections.map(sec => (
          <section key={sec.id} style={{ breakInside: "avoid", marginBottom: 24 }}>
            <h2 style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: restaurant.accent, margin: "0 0 10px", paddingBottom: 4, borderBottom: "1px solid #eee" }}>{sec.name}</h2>
            {sec.dishes.map(d => (
              <div key={d.id} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {d.tags?.includes("RECOMMENDED") && <span style={{ color: restaurant.accent }}>★ </span>}
                    {d.name}
                    <DishDietIcon diet={d.dishDiet} isSpicy={d.isSpicy} />
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>
                    {d.discountPrice ? (
                      <><span style={{ color: restaurant.accent }}>{formatPrice(Math.min(d.price, d.discountPrice))}</span></>
                    ) : formatPrice(d.price)}
                  </span>
                </div>
                {d.description && <p style={{ fontSize: 10.5, color: "#999", margin: "1px 0 0", lineHeight: 1.3 }}>{d.description}</p>}
              </div>
            ))}
          </section>
        ))}
      </div>

      {/* Footer */}
      <footer style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 32, paddingTop: 16, borderTop: `2px solid ${restaurant.accent}` }}>
        <div style={{ fontSize: 11, color: "#999" }}>
          {[restaurant.phone, restaurant.instagram && `@${restaurant.instagram}`, restaurant.website].filter(Boolean).map((t, i) => (
            <span key={i}>{i > 0 && " · "}{t}</span>
          ))}
        </div>
        <div style={{ textAlign: "center" }}>
          <QRCodeCanvas url={qrUrl} />
          <p style={{ fontSize: 9, color: "#bbb", margin: "4px 0 0", letterSpacing: 1 }}>CARTA DIGITAL</p>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════
// TEMPLATE: RUSTICO
// ═══════════════════════════════════════════════
function TemplateRustico({ restaurant, sections, promotions, qrUrl }: Omit<Props, "initialTemplate">) {
  const warm = "#5C4033";
  return (
    <div className="carta-print" style={{ fontFamily: "'Playfair Display', 'Georgia', serif", color: warm, maxWidth: 800, margin: "0 auto", padding: "48px 56px", background: "#FFFDF8" }}>
      {/* Header */}
      <header style={{ textAlign: "center", marginBottom: 36 }}>
        {restaurant.logoUrl && (
          <img src={restaurant.logoUrl} alt="" style={{ height: 56, marginBottom: 10, objectFit: "contain" }} />
        )}
        <h1 style={{ fontSize: 34, fontWeight: 700, margin: "0 0 4px", fontStyle: "italic" }}>{restaurant.name}</h1>
        <div style={{ width: 60, height: 2, background: warm, margin: "8px auto 10px", opacity: 0.4 }} />
        {restaurant.address && <p style={{ fontSize: 12, color: "#9B8E7A", margin: 0, fontFamily: "'Inter', sans-serif" }}>{restaurant.address}</p>}
      </header>

      {/* Promos */}
      {promotions.length > 0 && (
        <section style={{ marginBottom: 28, textAlign: "center", padding: "14px 0", borderTop: `1px solid ${warm}33`, borderBottom: `1px solid ${warm}33` }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", margin: "0 0 10px", fontFamily: "'Inter', sans-serif", color: "#9B8E7A" }}>Ofertas del momento</h2>
          {promotions.map(p => (
            <div key={p.id} style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</span>
              {p.promoPrice != null && <span style={{ marginLeft: 8, fontWeight: 700 }}>{formatPrice(p.promoPrice)}</span>}
              {p.originalPrice != null && p.promoPrice != null && <del style={{ marginLeft: 6, fontSize: 12, color: "#ccc" }}>{formatPrice(p.originalPrice)}</del>}
            </div>
          ))}
        </section>
      )}

      {/* Categories */}
      {sections.map(sec => (
        <section key={sec.id} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, fontStyle: "italic", textAlign: "center", margin: "0 0 4px" }}>{sec.name}</h2>
          <div style={{ width: 40, height: 1, background: warm, margin: "0 auto 14px", opacity: 0.3 }} />
          {sec.dishes.map(d => (
            <div key={d.id} style={{ marginBottom: 10, textAlign: "center" }}>
              <div>
                <span style={{ fontSize: 15, fontWeight: 600 }}>
                  {d.tags?.includes("RECOMMENDED") && <span>★ </span>}
                  {d.name}
                  <DishDietIcon diet={d.dishDiet} isSpicy={d.isSpicy} />
                </span>
                <span style={{ margin: "0 8px", color: "#ccc" }}>·</span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>
                  {d.discountPrice ? formatPrice(Math.min(d.price, d.discountPrice)) : formatPrice(d.price)}
                </span>
              </div>
              {d.description && <p style={{ fontSize: 11, color: "#9B8E7A", margin: "2px 0 0", fontFamily: "'Inter', sans-serif", fontStyle: "italic" }}>{d.description}</p>}
            </div>
          ))}
        </section>
      ))}

      {/* Footer */}
      <footer style={{ textAlign: "center", marginTop: 36, paddingTop: 20, borderTop: `1px solid ${warm}33` }}>
        <QRCodeCanvas url={qrUrl} />
        <p style={{ fontSize: 10, color: "#9B8E7A", margin: "6px 0 0", fontFamily: "'Inter', sans-serif", letterSpacing: 2 }}>ESCANEA PARA VER LA CARTA DIGITAL</p>
        <p style={{ fontSize: 11, color: "#ccc", marginTop: 8, fontFamily: "'Inter', sans-serif" }}>
          {[restaurant.phone, restaurant.instagram && `@${restaurant.instagram}`].filter(Boolean).join(" · ")}
        </p>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════
export default function CartaImprimible({ restaurant, sections, promotions, qrUrl, initialTemplate }: Props) {
  const [template, setTemplate] = useState<Template>(initialTemplate);

  const templateNames: Record<Template, string> = {
    clasico: "Elegante",
    moderno: "Moderno",
    rustico: "Acogedor",
  };

  const sharedProps = { restaurant, sections, promotions, qrUrl };

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; }
          .carta-print { padding: 32px 40px !important; }
        }
        @media screen {
          body { background: #e5e5e5 !important; }
          .carta-print { background: white; box-shadow: 0 4px 24px rgba(0,0,0,0.15); border-radius: 4px; margin-top: 80px !important; margin-bottom: 40px !important; }
        }
        @page { margin: 12mm; }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "#1a1a1a", padding: "12px 20px",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
        boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
      }}>
        <span style={{ color: "#999", fontSize: 13, fontWeight: 600, marginRight: 8 }}>Plantilla:</span>
        {(Object.keys(templateNames) as Template[]).map(t => (
          <button
            key={t}
            onClick={() => setTemplate(t)}
            style={{
              padding: "7px 16px", borderRadius: 999, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
              background: template === t ? restaurant.accent : "rgba(255,255,255,0.08)",
              color: template === t ? "#fff" : "#aaa",
              transition: "all 0.15s",
            }}
          >
            {templateNames[t]}
          </button>
        ))}
        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)", margin: "0 8px" }} />
        <button
          onClick={() => window.print()}
          style={{
            padding: "8px 20px", borderRadius: 999, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 700,
            background: "linear-gradient(135deg, #ffc44f, #f3a333)", color: "#1a1a1a",
          }}
        >
          Imprimir / Guardar PDF
        </button>
      </div>

      {/* Template */}
      {template === "clasico" && <TemplateClasico {...sharedProps} />}
      {template === "moderno" && <TemplateModerno {...sharedProps} />}
      {template === "rustico" && <TemplateRustico {...sharedProps} />}
    </>
  );
}
