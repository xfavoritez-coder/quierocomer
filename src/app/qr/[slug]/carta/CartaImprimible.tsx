"use client";

import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";

type Template = "magazine" | "bistro" | "minimal";

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

function QRCanvas({ url, size = 100 }: { url: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) QRCode.toCanvas(ref.current, url, { width: size, margin: 1, color: { dark: "#000", light: "#fff" } });
  }, [url, size]);
  return <canvas ref={ref} />;
}

function fmt(n: number) { return `$${n.toLocaleString("es-CL")}`; }

function ContactLine({ restaurant }: { restaurant: Restaurant }) {
  const parts = [restaurant.phone, restaurant.instagram && `@${restaurant.instagram}`, restaurant.website].filter(Boolean);
  if (!parts.length) return null;
  return <p style={{ fontSize: 11, color: "#999", margin: 0 }}>{parts.join(" · ")}</p>;
}

// ═══════════════════════════════════════════════════════════════
// MAGAZINE — foto grande, nombre sobre imagen, precio badge
// ═══════════════════════════════════════════════════════════════
function TemplateMagazine({ restaurant, sections, promotions, qrUrl }: Omit<Props, "initialTemplate">) {
  return (
    <div className="carta-print" style={{ fontFamily: "'Inter', sans-serif", color: "#111", maxWidth: 850, margin: "0 auto", padding: "40px 36px" }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 32, paddingBottom: 16, borderBottom: `3px solid ${restaurant.accent}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: 1 }}>
          {restaurant.logoUrl && <img src={restaurant.logoUrl} alt="" style={{ height: 48, objectFit: "contain", flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: "-0.5px", wordBreak: "break-word" }}>{restaurant.name}</h1>
            {restaurant.address && <p style={{ fontSize: 11, color: "#888", margin: "2px 0 0" }}>{restaurant.address}</p>}
          </div>
        </div>
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <QRCanvas url={qrUrl} size={64} />
          <p style={{ fontSize: 8, color: "#bbb", margin: "2px 0 0", letterSpacing: 1 }}>CARTA DIGITAL</p>
        </div>
      </header>

      {/* Promos banner */}
      {promotions.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
          {promotions.map(p => (
            <div key={p.id} style={{ flex: "1 1 200px", background: restaurant.accent, borderRadius: 10, padding: "12px 16px", color: "#fff" }}>
              <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", margin: "0 0 4px", opacity: 0.7 }}>OFERTA</p>
              <p style={{ fontSize: 16, fontWeight: 700, margin: "0 0 2px" }}>{p.name}</p>
              {p.promoPrice != null && (
                <p style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>
                  {fmt(p.promoPrice)}
                  {p.originalPrice != null && <del style={{ fontSize: 13, marginLeft: 8, opacity: 0.5 }}>{fmt(p.originalPrice)}</del>}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Sections */}
      {sections.map(sec => {
        const withPhoto = sec.dishes.filter(d => d.photos?.[0]);
        const withoutPhoto = sec.dishes.filter(d => !d.photos?.[0]);
        return (
          <section key={sec.id} style={{ marginBottom: 32, breakInside: "avoid" }}>
            <h2 style={{ fontSize: 13, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", color: restaurant.accent, margin: "0 0 14px", paddingBottom: 6, borderBottom: `1px solid ${restaurant.accent}30` }}>{sec.name}</h2>
            {/* Photo grid */}
            {withPhoto.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: withoutPhoto.length ? 14 : 0 }}>
                {withPhoto.map(d => (
                  <div key={d.id} style={{ position: "relative", borderRadius: 10, overflow: "hidden", aspectRatio: "4/3" }}>
                    <img src={d.photos[0]} alt={d.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 60%)" }} />
                    {d.tags?.includes("RECOMMENDED") && (
                      <span style={{ position: "absolute", top: 6, left: 6, background: restaurant.accent, color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 4 }}>★ DESTACADO</span>
                    )}
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "8px 10px" }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", margin: "0 0 2px", lineHeight: 1.2 }}>{d.name}</p>
                      <p style={{ fontSize: 13, fontWeight: 800, color: restaurant.accent, margin: 0 }}>
                        {d.discountPrice ? fmt(Math.min(d.price, d.discountPrice)) : fmt(d.price)}
                        {d.discountPrice && <del style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginLeft: 4 }}>{fmt(Math.max(d.price, d.discountPrice))}</del>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Text list for dishes without photos */}
            {withoutPhoto.length > 0 && (
              <div style={{ columnCount: 2, columnGap: 24 }}>
                {withoutPhoto.map(d => (
                  <div key={d.id} style={{ marginBottom: 6, breakInside: "avoid" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>
                        {d.tags?.includes("RECOMMENDED") && <span style={{ color: restaurant.accent }}>★ </span>}
                        {d.name}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0, marginLeft: 6 }}>{fmt(d.price)}</span>
                    </div>
                    {d.description && <p style={{ fontSize: 10, color: "#999", margin: "1px 0 0", lineHeight: 1.3 }}>{d.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {/* Footer */}
      <footer style={{ textAlign: "center", paddingTop: 16, borderTop: `2px solid ${restaurant.accent}`, marginTop: 20 }}>
        <ContactLine restaurant={restaurant} />
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BISTRO — cards con foto cuadrada arriba, info abajo, fondo crema
// ═══════════════════════════════════════════════════════════════
function TemplateBistro({ restaurant, sections, promotions, qrUrl }: Omit<Props, "initialTemplate">) {
  return (
    <div className="carta-print" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#3E2B1C", maxWidth: 850, margin: "0 auto", padding: "44px 40px", background: "#FBF8F3" }}>
      {/* Header */}
      <header style={{ textAlign: "center", marginBottom: 36 }}>
        {restaurant.logoUrl && <img src={restaurant.logoUrl} alt="" style={{ height: 56, marginBottom: 8, objectFit: "contain" }} />}
        <h1 style={{ fontSize: 34, fontWeight: 600, margin: "0 0 4px", fontStyle: "italic" }}>{restaurant.name}</h1>
        <div style={{ width: 50, height: 2, background: "#3E2B1C", margin: "8px auto", opacity: 0.3 }} />
        {restaurant.address && <p style={{ fontSize: 12, color: "#9B8E7A", margin: 0, fontFamily: "'Inter', sans-serif" }}>{restaurant.address}</p>}
      </header>

      {/* Promos */}
      {promotions.length > 0 && (
        <div style={{ textAlign: "center", marginBottom: 28, padding: "14px 0", borderTop: "1px solid #E8DDC8", borderBottom: "1px solid #E8DDC8" }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "#9B8E7A", margin: "0 0 8px", fontFamily: "'Inter', sans-serif" }}>Ofertas</p>
          {promotions.map(p => (
            <p key={p.id} style={{ fontSize: 16, margin: "4px 0" }}>
              <strong>{p.name}</strong>
              {p.promoPrice != null && <span style={{ marginLeft: 10, fontWeight: 700 }}>{fmt(p.promoPrice)}</span>}
              {p.originalPrice != null && p.promoPrice != null && <del style={{ marginLeft: 6, color: "#ccc", fontSize: 13 }}>{fmt(p.originalPrice)}</del>}
            </p>
          ))}
        </div>
      )}

      {/* Sections */}
      {sections.map(sec => (
        <section key={sec.id} style={{ marginBottom: 32, breakInside: "avoid" }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, fontStyle: "italic", textAlign: "center", margin: "0 0 4px" }}>{sec.name}</h2>
          <div style={{ width: 30, height: 1, background: "#3E2B1C", margin: "0 auto 16px", opacity: 0.25 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {sec.dishes.map(d => (
              <div key={d.id} style={{ borderRadius: 10, overflow: "hidden", background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.06)", breakInside: "avoid" }}>
                {d.photos?.[0] ? (
                  <div style={{ aspectRatio: "1", overflow: "hidden", position: "relative" }}>
                    <img src={d.photos[0]} alt={d.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    {d.tags?.includes("RECOMMENDED") && (
                      <span style={{ position: "absolute", top: 6, left: 6, background: "#3E2B1C", color: "#FBF8F3", fontSize: 8, fontWeight: 800, padding: "2px 6px", borderRadius: 3, letterSpacing: 0.5 }}>★</span>
                    )}
                  </div>
                ) : (
                  <div style={{ aspectRatio: "1", background: "#F3EDE4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "#D4C9B8" }}>🍽️</div>
                )}
                <div style={{ padding: "10px 10px 12px" }}>
                  <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 3px", lineHeight: 1.2 }}>{d.name}</p>
                  {d.description && <p style={{ fontSize: 10, color: "#9B8E7A", margin: "0 0 6px", lineHeight: 1.3, fontFamily: "'Inter', sans-serif" }}>{d.description}</p>}
                  <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                    {d.discountPrice ? (
                      <><span style={{ color: "#B85C38" }}>{fmt(Math.min(d.price, d.discountPrice))}</span> <del style={{ fontSize: 11, color: "#ccc" }}>{fmt(Math.max(d.price, d.discountPrice))}</del></>
                    ) : fmt(d.price)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Footer */}
      <footer style={{ textAlign: "center", marginTop: 28, paddingTop: 20, borderTop: "1px solid #E8DDC8" }}>
        <QRCanvas url={qrUrl} size={90} />
        <p style={{ fontSize: 9, color: "#9B8E7A", margin: "4px 0 0", letterSpacing: 2, fontFamily: "'Inter', sans-serif" }}>ESCANEA PARA VER LA CARTA DIGITAL</p>
        <div style={{ marginTop: 8 }}><ContactLine restaurant={restaurant} /></div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MINIMAL — destacados con foto grande, resto en lista compacta
// ═══════════════════════════════════════════════════════════════
function TemplateMinimal({ restaurant, sections, promotions, qrUrl }: Omit<Props, "initialTemplate">) {
  const allDishes = sections.flatMap(s => s.dishes);
  const featured = allDishes.filter(d => d.tags?.includes("RECOMMENDED") && d.photos?.[0]);
  return (
    <div className="carta-print" style={{ fontFamily: "'Inter', sans-serif", color: "#1a1a1a", maxWidth: 850, margin: "0 auto", padding: "40px 44px" }}>
      {/* Header */}
      <header style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          {restaurant.logoUrl && <img src={restaurant.logoUrl} alt="" style={{ height: 40, objectFit: "contain", flexShrink: 0 }} />}
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, wordBreak: "break-word" }}>{restaurant.name}</h1>
        </div>
        {restaurant.address && <p style={{ fontSize: 11, color: "#999", margin: 0 }}>{restaurant.address}</p>}
      </header>

      {/* Featured dishes — hero cards */}
      {featured.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: restaurant.accent, margin: "0 0 12px" }}>DESTACADOS</p>
          <div style={{ display: "grid", gridTemplateColumns: featured.length === 1 ? "1fr" : "repeat(2, 1fr)", gap: 12 }}>
            {featured.map(d => (
              <div key={d.id} style={{ position: "relative", borderRadius: 12, overflow: "hidden", aspectRatio: "16/9" }}>
                <img src={d.photos[0]} alt={d.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)" }} />
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 2px" }}>{d.name}</p>
                    {d.description && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.3 }}>{d.description}</p>}
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 800, color: restaurant.accent, flexShrink: 0, marginLeft: 12 }}>
                    {d.discountPrice ? fmt(Math.min(d.price, d.discountPrice)) : fmt(d.price)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Promos */}
      {promotions.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          {promotions.map(p => (
            <div key={p.id} style={{ flex: 1, background: "#f5f5f5", borderRadius: 8, padding: "10px 14px", borderLeft: `3px solid ${restaurant.accent}` }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: restaurant.accent, margin: "0 0 2px", letterSpacing: 1 }}>OFERTA</p>
              <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{p.name}</p>
              {p.promoPrice != null && <p style={{ fontSize: 15, fontWeight: 800, margin: "2px 0 0" }}>{fmt(p.promoPrice)}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Sections — compact list, two columns */}
      <div style={{ columnCount: 2, columnGap: 32 }}>
        {sections.map(sec => (
          <section key={sec.id} style={{ breakInside: "avoid", marginBottom: 22 }}>
            <h2 style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: restaurant.accent, margin: "0 0 8px", paddingBottom: 4, borderBottom: "1px solid #eee" }}>{sec.name}</h2>
            {sec.dishes.map(d => {
              const isFeatured = d.tags?.includes("RECOMMENDED");
              return (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  {d.photos?.[0] && (
                    <img src={d.photos[0]} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 12, fontWeight: isFeatured ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {isFeatured && <span style={{ color: restaurant.accent }}>★ </span>}
                        {d.name}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0, marginLeft: 6 }}>
                        {d.discountPrice ? fmt(Math.min(d.price, d.discountPrice)) : fmt(d.price)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div>

      {/* Footer */}
      <footer style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, paddingTop: 14, borderTop: "2px solid #eee" }}>
        <ContactLine restaurant={restaurant} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <p style={{ fontSize: 9, color: "#bbb", margin: 0, letterSpacing: 1 }}>CARTA<br />DIGITAL</p>
          <QRCanvas url={qrUrl} size={56} />
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
export default function CartaImprimible({ restaurant, sections, promotions, qrUrl, initialTemplate }: Props) {
  const [template, setTemplate] = useState<Template>(initialTemplate);

  const templates: { key: Template; label: string; desc: string }[] = [
    { key: "magazine", label: "Magazine", desc: "Fotos grandes, grid visual" },
    { key: "bistro", label: "Bistro", desc: "Cards con foto, fondo crema" },
    { key: "minimal", label: "Minimal", desc: "Destacados hero + lista" },
  ];

  const sharedProps = { restaurant, sections, promotions, qrUrl };

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .carta-print { margin: 0 !important; box-shadow: none !important; border-radius: 0 !important; }
        }
        @media screen {
          body { background: #e5e5e5 !important; }
          .carta-print { box-shadow: 0 4px 24px rgba(0,0,0,0.15); border-radius: 4px; margin-top: 80px !important; margin-bottom: 40px !important; }
        }
        @page { margin: 10mm; }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "#1a1a1a", padding: "10px 16px",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
      }}>
        {templates.map(t => (
          <button
            key={t.key}
            onClick={() => setTemplate(t.key)}
            style={{
              padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600,
              background: template === t.key ? restaurant.accent : "rgba(255,255,255,0.08)",
              color: template === t.key ? "#fff" : "#aaa",
            }}
          >
            {t.label}
          </button>
        ))}
        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />
        <button
          onClick={() => window.print()}
          style={{
            padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 700,
            background: "linear-gradient(135deg, #ffc44f, #f3a333)", color: "#1a1a1a",
          }}
        >
          Imprimir / Guardar PDF
        </button>
      </div>

      {template === "magazine" && <TemplateMagazine {...sharedProps} />}
      {template === "bistro" && <TemplateBistro {...sharedProps} />}
      {template === "minimal" && <TemplateMinimal {...sharedProps} />}
    </>
  );
}
