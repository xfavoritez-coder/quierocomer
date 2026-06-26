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
          width: 210mm; min-height: 297mm;
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
          padding: 22mm 16mm 16mm;
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
          font-size: 22pt;
          font-weight: 400;
          color: #2f5d8a;
          letter-spacing: 0.1em;
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
          font-size: 12pt;
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
          font-size: 9.5pt;
          font-weight: 400;
          color: #2c2c2c;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .medit-dish-dots {
          flex: 1;
          border-bottom: 1px dotted #c0622d50;
          min-width: 10px;
          margin-bottom: 2px;
        }
        .medit-dish-price {
          font-family: 'Jost', sans-serif;
          font-size: 9pt;
          font-weight: 600;
          color: #c0622d;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .medit-dish-desc {
          font-size: 7.5pt;
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
          width: 52px; height: 52px;
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
            <h1 className="medit-title">{restaurant.name}</h1>
            {restaurant.address && (
              <p className="medit-subtitle">{restaurant.address}</p>
            )}
          </div>

          {/* Sections */}
          {sections.map((section, i) => (
            <div key={i} className="medit-section">
              <h2 className="medit-section-title">{section.titulo}</h2>

              {incluirFotos ? (
                <div className="medit-dishes-photo">
                  {section.platos.map((p, j) => (
                    <div key={j} className="medit-dish-photo-row">
                      {p.foto ? (
                        <img src={p.foto} alt="" className="medit-dish-img" />
                      ) : (
                        <div className="medit-dish-img" style={{ background: "#ede7d6" }} />
                      )}
                      <div className="medit-dish-info">
                        <div className="medit-dish-info-top">
                          <span className="medit-dish-name">{p.nombre}</span>
                          <span className="medit-dish-dots" />
                          <span className="medit-dish-price">
                            {p.precio}
                            {p.precioDescuento && (
                              <span className="medit-old-price">{p.precioDescuento}</span>
                            )}
                          </span>
                        </div>
                        {p.descripcion && (
                          <p className="medit-dish-desc">{p.descripcion}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="medit-dishes-text">
                  {section.platos.map((p, j) => (
                    <div key={j} className="medit-dish-text">
                      <div className="medit-dish-row">
                        <span className="medit-dish-name">{p.nombre}</span>
                        <span className="medit-dish-dots" />
                        <span className="medit-dish-price">
                          {p.precio}
                          {p.precioDescuento && (
                            <span className="medit-old-price">{p.precioDescuento}</span>
                          )}
                        </span>
                      </div>
                      {p.descripcion && (
                        <p className="medit-dish-desc">{p.descripcion}</p>
                      )}
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
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
          <TileBand flip />
        </div>
      </div>
    </>
  );
}
