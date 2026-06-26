"use client";

import type { Section } from "../ExportarCarta";

interface Props {
  restaurant: { name: string; logoUrl: string | null; address: string | null; phone: string | null };
  sections: Section[];
  incluirFotos: boolean;
}

/* ── Leaf corner ornament ── */
const LeafCorner = ({ style }: { style?: React.CSSProperties }) => (
  <svg width="70" height="70" viewBox="0 0 70 70" style={style}>
    <path
      d="M8 62 Q12 30 35 18 Q20 35 18 60"
      fill="none"
      stroke="#3f6b4c"
      strokeWidth="1.5"
    />
    <path
      d="M14 58 Q18 34 38 24"
      fill="none"
      stroke="#3f6b4c50"
      strokeWidth="1"
    />
    <ellipse cx="35" cy="16" rx="4" ry="7" fill="#3f6b4c30" transform="rotate(-20 35 16)" />
    <path
      d="M4 66 Q6 40 28 22"
      fill="none"
      stroke="#3f6b4c30"
      strokeWidth="1"
    />
  </svg>
);

/* ── Leaf divider ── */
const LeafDivider = () => (
  <svg width="140" height="20" viewBox="0 0 140 20" style={{ display: "block", margin: "0 auto" }}>
    <line x1="0" y1="10" x2="50" y2="10" stroke="#3f6b4c" strokeWidth="0.8" />
    <path d="M65 4 Q70 10 65 16 Q70 12 75 10 Q70 8 65 4Z" fill="#3f6b4c" />
    <line x1="90" y1="10" x2="140" y2="10" stroke="#3f6b4c" strokeWidth="0.8" />
  </svg>
);

export default function TemaHuerto({ restaurant, sections, incluirFotos }: Props) {
  return (
    <>
      <style>{`
        @page { size: A4; margin: 0; }
        .huerto-page {
          background: #f6f1e3;
          color: #2c2c2c;
          font-family: 'Jost', sans-serif;
          padding: 18mm 20mm;
          box-sizing: border-box;
          position: relative;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
        .huerto-border {
          border: 1px solid #3f6b4c40;
          padding: 12mm 10mm;
          position: relative;
          box-sizing: border-box;
        }
        .huerto-header {
          text-align: center;
          margin-bottom: 8mm;
        }
        .huerto-logo {
          width: 48px; height: 48px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #3f6b4c;
          margin-bottom: 6px;
        }
        .huerto-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 28pt;
          font-weight: 700;
          color: #3f6b4c;
          letter-spacing: 0.08em;
          margin: 0 0 3px;
        }
        .huerto-subtitle {
          font-size: 8.5pt;
          color: #3f6b4c90;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin: 0;
          font-weight: 400;
        }
        .huerto-section {
          break-inside: avoid;
          margin-bottom: 7mm;
        }
        .huerto-section-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 16pt;
          font-weight: 700;
          color: #3f6b4c;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          text-align: center;
          margin: 0 0 4mm;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .huerto-section-title::before,
        .huerto-section-title::after {
          content: '';
          display: inline-block;
          width: 24px;
          height: 1px;
          background: #3f6b4c60;
        }
        .huerto-dishes-text {
          column-count: 2;
          column-gap: 8mm;
        }
        .huerto-dish-text {
          break-inside: avoid;
          margin-bottom: 3.5mm;
        }
        .huerto-dish-row {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .huerto-dish-name {
          font-family: 'Cormorant Garamond', serif;
          font-size: 12pt;
          font-weight: 700;
          color: #2c2c2c;
          flex: 1;
          min-width: 0;
          word-wrap: break-word;
        }
        .huerto-dish-dots {
          flex: 0 0 auto;
          width: 20px;
          border-bottom: 1px dotted #3f6b4c40;
          margin-bottom: 2px;
        }
        .huerto-dish-price {
          font-family: 'Jost', sans-serif;
          font-size: 12pt;
          font-weight: 600;
          color: #3f6b4c;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .huerto-dish-desc {
          font-size: 10.5pt;
          color: #5a5a5a;
          font-style: italic;
          margin: 1px 0 0;
          line-height: 1.3;
          font-family: 'Cormorant Garamond', serif;
        }
        .huerto-dishes-photo {
          display: flex;
          flex-direction: column;
          gap: 3mm;
        }
        .huerto-dish-photo-row {
          display: flex;
          align-items: center;
          gap: 3mm;
          break-inside: avoid;
        }
        .huerto-dish-img {
          width: 56px; height: 56px;
          border-radius: 8px;
          object-fit: cover;
          border: 1px solid #3f6b4c30;
          flex-shrink: 0;
        }
        .huerto-dish-info {
          flex: 1;
          min-width: 0;
        }
        .huerto-dish-info-top {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .huerto-old-price {
          font-size: 7pt;
          color: #9a9a9a;
          text-decoration: line-through;
          margin-left: 4px;
        }
      `}</style>

      <div className="huerto-page">
        <div className="huerto-border">
          {/* Leaf corners */}
          <LeafCorner style={{ position: "absolute", top: -4, left: -4 }} />
          <LeafCorner style={{ position: "absolute", top: -4, right: -4, transform: "scaleX(-1)" }} />
          <LeafCorner style={{ position: "absolute", bottom: -4, left: -4, transform: "scaleY(-1)" }} />
          <LeafCorner style={{ position: "absolute", bottom: -4, right: -4, transform: "scale(-1)" }} />

          {/* Header */}
          <div className="huerto-header">
            {restaurant.logoUrl && (
              <img src={restaurant.logoUrl} alt="" className="huerto-logo" />
            )}
            <h1 className="huerto-title">{restaurant.name}</h1>
            {restaurant.address && (
              <p className="huerto-subtitle">{restaurant.address}</p>
            )}
            <div style={{ marginTop: 8 }}>
              <LeafDivider />
            </div>
          </div>

          {/* Sections */}
          {sections.map((section, i) => (
            <div key={i} className="huerto-section">
              <h2 className="huerto-section-title">{section.titulo}</h2>

              {incluirFotos ? (
                <div className="huerto-dishes-photo">
                  {section.platos.map((p, j) => (
                    <div key={j} className="huerto-dish-photo-row">
                      {p.foto ? (
                        <img src={p.foto} alt="" className="huerto-dish-img" />
                      ) : (
                        <div className="huerto-dish-img" style={{ background: "#e8e2d4" }} />
                      )}
                      <div className="huerto-dish-info">
                        <div className="huerto-dish-info-top">
                          <span className="huerto-dish-name">{p.nombre}</span>
                          <span className="huerto-dish-dots" />
                          <span className="huerto-dish-price">
                            {p.precio}
                            {p.precioDescuento && (
                              <span className="huerto-old-price">{p.precioDescuento}</span>
                            )}
                          </span>
                        </div>
                        {p.descripcion && (
                          <p className="huerto-dish-desc">{p.descripcion}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="huerto-dishes-text">
                  {section.platos.map((p, j) => (
                    <div key={j} className="huerto-dish-text">
                      <div className="huerto-dish-row">
                        <span className="huerto-dish-name">{p.nombre}</span>
                        <span className="huerto-dish-dots" />
                        <span className="huerto-dish-price">
                          {p.precio}
                          {p.precioDescuento && (
                            <span className="huerto-old-price">{p.precioDescuento}</span>
                          )}
                        </span>
                      </div>
                      {p.descripcion && (
                        <p className="huerto-dish-desc">{p.descripcion}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {i < sections.length - 1 && (
                <div style={{ marginTop: "5mm" }}>
                  <LeafDivider />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
