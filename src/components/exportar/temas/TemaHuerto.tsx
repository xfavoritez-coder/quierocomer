"use client";

import type { Section } from "../ExportarCarta";

interface Props {
  restaurant: { name: string; logoUrl: string | null; address: string | null; phone: string | null };
  sections: Section[];
  incluirFotos: boolean;
  qrDataUrl?: string;
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
  <svg width="140" height="24" viewBox="0 0 140 24" style={{ display: "block", margin: "0 auto" }}>
    <line x1="0" y1="12" x2="48" y2="12" stroke="#3f6b4c" strokeWidth="0.7" opacity="0.5" />
    <g transform="translate(60, 4)" fill="#3f6b4c" opacity="0.6">
      <path d="M10 0 C14 6 16 12 10 18 C4 12 6 6 10 0Z" />
      <path d="M10 2 C10 8 10 14 10 16" stroke="#f6f1e3" strokeWidth="0.8" fill="none" />
    </g>
    <line x1="92" y1="12" x2="140" y2="12" stroke="#3f6b4c" strokeWidth="0.7" opacity="0.5" />
  </svg>
);

export default function TemaHuerto({ restaurant, sections, incluirFotos, qrDataUrl }: Props) {
  return (
    <>
      <style>{`
        @page { size: A4; margin: 0; }
        .huerto-page {
          background: #f6f1e3;
          color: #2c2c2c;
          font-family: 'Jost', sans-serif;
          padding: 32mm 20mm 18mm;
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
          font-size: 34pt;
          font-weight: 700;
          color: #1a3a24;
          letter-spacing: 0.04em;
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
          padding-top: 6mm;
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
        .huerto-section-line {
          flex: 1;
          height: 1px;
          background: rgba(63,107,76,0.35);
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
          <div className="huerto-header" style={{ position: "relative" }}>
            {qrDataUrl && (
              <div style={{ position: "absolute", top: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ padding: 5, background: "rgba(63,107,76,0.08)", borderRadius: 6, border: "2px solid #3f6b4c" }}>
                  <img src={qrDataUrl} alt="QR" style={{ width: 60, height: 60, display: "block", borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: "6.5pt", color: "#3f6b4c", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Cormorant Garamond', serif", textAlign: "center" }}>Ver carta QR</span>
              </div>
            )}
            {restaurant.logoUrl && (
              <img src={restaurant.logoUrl} alt="" className="huerto-logo" />
            )}
            <h1 className="huerto-title" style={{ color: "#1a3a24", fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "34pt", fontWeight: 700 }}>{restaurant.name}</h1>
            {restaurant.address && (
              <p className="huerto-subtitle" style={{ color: "#6a6a5e" }}>{restaurant.address}</p>
            )}
            <div style={{ marginTop: 8 }}>
              <LeafDivider />
            </div>
          </div>

          {/* Sections */}
          {sections.map((section, i) => (
            <div key={i} className="huerto-section" data-pdf-section>
              <h2 className="huerto-section-title" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "16pt", fontWeight: 700, color: "#3f6b4c", letterSpacing: "0.06em", textTransform: "uppercase", textAlign: "center", margin: "0 0 4mm", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <span className="huerto-section-line" style={{ flex: 1, height: 1, background: "rgba(63,107,76,0.35)" }} />
                {section.titulo}
                <span className="huerto-section-line" style={{ flex: 1, height: 1, background: "rgba(63,107,76,0.35)" }} />
              </h2>

              {incluirFotos ? (
                <div className="huerto-dishes-photo" style={{ display: "flex", flexDirection: "column", gap: "3mm" }}>
                  {section.platos.map((p, j) => (
                    <div key={j} className="huerto-dish-photo-row" style={{ display: "flex", alignItems: "center", gap: "3mm", breakInside: "avoid" }}>
                      {p.foto ? (
                        <img src={p.foto} alt="" className="huerto-dish-img" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", border: "1px solid rgba(63,107,76,0.2)", flexShrink: 0 }} />
                      ) : (
                        <div className="huerto-dish-img" style={{ width: 56, height: 56, borderRadius: 8, background: "#e8e2d4", flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                          <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "12pt", fontWeight: 700, color: "#2c2c2c", flex: 1, minWidth: 0, wordWrap: "break-word" }}>{p.nombre}</span>
                          <span style={{ flex: "0 0 auto", width: 20, borderBottom: "1px dotted rgba(63,107,76,0.3)", marginBottom: 2 }} />
                          <span style={{ fontSize: "12pt", fontWeight: 600, color: "#3f6b4c", whiteSpace: "nowrap", flexShrink: 0 }}>
                            {p.precio}
                            {p.precioDescuento && <span style={{ fontSize: "9pt", color: "#9a9a9a", textDecoration: "line-through", marginLeft: 4 }}>{p.precioDescuento}</span>}
                          </span>
                        </div>
                        {p.descripcion && <p style={{ fontSize: "10.5pt", color: "#5a5a5a", fontStyle: "italic", margin: "1px 0 0", lineHeight: 1.3 }}>{p.descripcion}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="huerto-dishes-text" style={{ columnCount: 2, columnGap: "8mm" }}>
                  {section.platos.map((p, j) => (
                    <div key={j} style={{ breakInside: "avoid", marginBottom: "3.5mm" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                        <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "12pt", fontWeight: 700, color: "#2c2c2c", flex: 1, minWidth: 0, wordWrap: "break-word" }}>{p.nombre}</span>
                        <span style={{ flex: "0 0 auto", width: 20, borderBottom: "1px dotted rgba(63,107,76,0.3)", marginBottom: 2 }} />
                        <span style={{ fontSize: "12pt", fontWeight: 600, color: "#3f6b4c", whiteSpace: "nowrap", flexShrink: 0 }}>
                          {p.precio}
                          {p.precioDescuento && <span style={{ fontSize: "9pt", color: "#9a9a9a", textDecoration: "line-through", marginLeft: 4 }}>{p.precioDescuento}</span>}
                        </span>
                      </div>
                      {p.descripcion && <p style={{ fontSize: "10.5pt", color: "#5a5a5a", fontStyle: "italic", margin: "1px 0 0", lineHeight: 1.3 }}>{p.descripcion}</p>}
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
