"use client";

import type { Section } from "../ExportarCarta";

interface Props {
  restaurant: { name: string; logoUrl: string | null; address: string | null; phone: string | null };
  sections: Section[];
  incluirFotos: boolean;
}

/* ── Tile band (top / bottom) ── */
const TileBand = ({ flip }: { flip?: boolean }) => (
  <svg
    width="100%"
    height="18"
    viewBox="0 0 600 18"
    preserveAspectRatio="none"
    style={{ display: "block", transform: flip ? "scaleY(-1)" : undefined }}
  >
    {Array.from({ length: 30 }).map((_, i) => (
      <rect
        key={i}
        x={i * 20}
        y={0}
        width="18"
        height="18"
        rx="2"
        fill={i % 2 === 0 ? "#2f5d8a" : "#c0622d"}
        opacity={i % 2 === 0 ? 0.7 : 0.5}
      />
    ))}
  </svg>
);

/* ── Arch decoration ── */
const ArchDecor = () => (
  <svg width="160" height="40" viewBox="0 0 160 40" style={{ display: "block", margin: "0 auto" }}>
    <path
      d="M10 38 Q10 8 80 8 Q150 8 150 38"
      fill="none"
      stroke="#2f5d8a"
      strokeWidth="1.5"
    />
    <path
      d="M20 38 Q20 16 80 16 Q140 16 140 38"
      fill="none"
      stroke="#c0622d50"
      strokeWidth="1"
    />
    <circle cx="80" cy="6" r="3" fill="#c0622d" />
  </svg>
);

/* ── Simple divider ── */
const MeditDivider = () => (
  <svg width="120" height="14" viewBox="0 0 120 14" style={{ display: "block", margin: "0 auto" }}>
    <line x1="0" y1="7" x2="48" y2="7" stroke="#2f5d8a" strokeWidth="0.8" />
    <rect x="53" y="3" width="14" height="8" rx="2" fill="none" stroke="#c0622d" strokeWidth="1" />
    <line x1="72" y1="7" x2="120" y2="7" stroke="#2f5d8a" strokeWidth="0.8" />
  </svg>
);

export default function TemaMedit({ restaurant, sections, incluirFotos }: Props) {
  return (
    <>
      <style>{`
        @page { size: A4; margin: 0; }
        .medit-page {
          background: #faf4e6;
          color: #2c2c2c;
          font-family: 'Jost', sans-serif;
          padding: 0;
          box-sizing: border-box;
          position: relative;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
        .medit-inner {
          padding: 18mm 20mm;
        }
        .medit-header {
          text-align: center;
          margin-bottom: 6mm;
        }
        .medit-logo {
          width: 48px; height: 48px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #2f5d8a;
          margin-bottom: 6px;
        }
        .medit-title {
          font-family: 'Marcellus', serif;
          font-size: 34pt;
          font-weight: 400;
          color: #8b3a14;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin: 0 0 3px;
        }
        .medit-subtitle {
          font-size: 8.5pt;
          color: #c0622d;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin: 0;
          font-weight: 400;
        }
        .medit-section {
          break-inside: avoid;
          margin-bottom: 7mm;
        }
        .medit-section-title {
          font-family: 'Marcellus', serif;
          font-size: 15pt;
          font-weight: 400;
          color: #2f5d8a;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          text-align: center;
          margin: 0 0 4mm;
          padding-bottom: 2mm;
          border-bottom: 1px solid #c0622d40;
        }
        .medit-dishes-text {
          column-count: 2;
          column-gap: 8mm;
        }
        .medit-dish-text {
          break-inside: avoid;
          margin-bottom: 3.5mm;
        }
        .medit-dish-row {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .medit-dish-name {
          font-family: 'Marcellus', serif;
          font-size: 12pt;
          font-weight: 400;
          color: #2c2c2c;
          flex: 1;
          min-width: 0;
          word-wrap: break-word;
        }
        .medit-dish-dots {
          flex: 0 0 auto;
          width: 20px;
          border-bottom: 1px dotted #c0622d50;
          margin-bottom: 2px;
        }
        .medit-dish-price {
          font-family: 'Jost', sans-serif;
          font-size: 12pt;
          font-weight: 600;
          color: #c0622d;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .medit-dish-desc {
          font-size: 10.5pt;
          color: #6a6a6a;
          font-style: italic;
          margin: 1px 0 0;
          line-height: 1.3;
        }
        .medit-dishes-photo {
          display: flex;
          flex-direction: column;
          gap: 3mm;
        }
        .medit-dish-photo-row {
          display: flex;
          align-items: center;
          gap: 3mm;
          break-inside: avoid;
        }
        .medit-dish-img {
          width: 56px; height: 56px;
          border-radius: 6px;
          object-fit: cover;
          border: 1px solid #2f5d8a30;
          flex-shrink: 0;
        }
        .medit-dish-info {
          flex: 1;
          min-width: 0;
        }
        .medit-dish-info-top {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .medit-old-price {
          font-size: 7pt;
          color: #9a9a9a;
          text-decoration: line-through;
          margin-left: 4px;
        }
      `}</style>

      <div className="medit-page">
        {/* Top tile band */}
        <TileBand />

        <div className="medit-inner">
          {/* Header */}
          <div className="medit-header">
            {restaurant.logoUrl && (
              <img src={restaurant.logoUrl} alt="" className="medit-logo" />
            )}
            <ArchDecor />
            <h1 className="medit-title" style={{ color: "#8b3a14", fontFamily: "'Marcellus', Georgia, serif", fontSize: "34pt" }}>{restaurant.name}</h1>
            {restaurant.address && (
              <p className="medit-subtitle" style={{ color: "#8a7b63" }}>{restaurant.address}</p>
            )}
          </div>

          {/* Sections */}
          {sections.map((section, i) => (
            <div key={i} className="medit-section" data-pdf-section>
              <h2 className="medit-section-title" style={{ fontFamily: "'Marcellus', Georgia, serif", fontSize: "15pt", color: "#2f5d8a", margin: "0 0 12px", paddingBottom: 6, borderBottom: "2px solid #c0622d" }}>{section.titulo}</h2>

              {incluirFotos ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "3mm" }}>
                  {section.platos.map((p, j) => (
                    <div key={j} style={{ display: "flex", alignItems: "center", gap: 10, breakInside: "avoid" }}>
                      {p.foto ? (
                        <img src={p.foto} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", border: "1px solid rgba(192,98,45,0.2)", flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 56, height: 56, borderRadius: 8, background: "#ede7d6", flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                          <span style={{ fontSize: "12pt", fontWeight: 600, color: "#403428", flex: 1, minWidth: 0, wordWrap: "break-word" }}>{p.nombre}</span>
                          <span style={{ flex: "0 0 auto", width: 20, borderBottom: "1px dotted #d8cdb4", marginBottom: 3 }} />
                          <span style={{ fontSize: "12pt", fontWeight: 600, color: "#c0622d", whiteSpace: "nowrap", flexShrink: 0 }}>
                            {p.precio}
                            {p.precioDescuento && <span style={{ fontSize: "9pt", color: "#aaa", textDecoration: "line-through", marginLeft: 4 }}>{p.precioDescuento}</span>}
                          </span>
                        </div>
                        {p.descripcion && <p style={{ fontSize: "10.5pt", color: "#8a7b63", margin: "2px 0 0", lineHeight: 1.35 }}>{p.descripcion}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ columnCount: 2, columnGap: "8mm" }}>
                  {section.platos.map((p, j) => (
                    <div key={j} style={{ breakInside: "avoid", marginBottom: "3.5mm" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                        <span style={{ fontSize: "12pt", fontWeight: 600, color: "#403428", flex: 1, minWidth: 0, wordWrap: "break-word" }}>{p.nombre}</span>
                        <span style={{ flex: "0 0 auto", width: 20, borderBottom: "1px dotted #d8cdb4", marginBottom: 3 }} />
                        <span style={{ fontSize: "12pt", fontWeight: 600, color: "#c0622d", whiteSpace: "nowrap", flexShrink: 0 }}>
                          {p.precio}
                          {p.precioDescuento && <span style={{ fontSize: "9pt", color: "#aaa", textDecoration: "line-through", marginLeft: 4 }}>{p.precioDescuento}</span>}
                        </span>
                      </div>
                      {p.descripcion && <p style={{ fontSize: "10.5pt", color: "#8a7b63", margin: "2px 0 0", lineHeight: 1.35 }}>{p.descripcion}</p>}
                    </div>
                  ))}
                </div>
              )}

              {i < sections.length - 1 && (
                <div style={{ marginTop: "5mm" }}>
                  <MeditDivider />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom tile band */}
        <TileBand flip />
      </div>
    </>
  );
}
