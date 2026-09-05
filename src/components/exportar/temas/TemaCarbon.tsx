"use client";

import type { Section } from "../ExportarCarta";

interface Props {
  restaurant: { name: string; logoUrl: string | null; address: string | null; phone: string | null };
  sections: Section[];
  incluirFotos: boolean;
  qrDataUrl?: string;
}

/* ── SVG corner ornament (gold flourish) ── */
const CornerOrnament = ({ style }: { style?: React.CSSProperties }) => (
  <svg width="60" height="60" viewBox="0 0 60 60" style={style}>
    <path
      d="M5 55 Q5 5 55 5"
      fill="none"
      stroke="#d8ad57"
      strokeWidth="2"
    />
    <path
      d="M10 55 Q10 10 55 10"
      fill="none"
      stroke="#d8ad5740"
      strokeWidth="1"
    />
    <circle cx="55" cy="5" r="3" fill="#d8ad57" />
    <circle cx="5" cy="55" r="3" fill="#d8ad57" />
  </svg>
);

/* ── Gold divider ── */
const GoldDivider = () => (
  <svg width="120" height="16" viewBox="0 0 120 16" style={{ display: "block", margin: "0 auto" }}>
    <line x1="0" y1="8" x2="45" y2="8" stroke="#d8ad57" strokeWidth="1" />
    <circle cx="60" cy="8" r="4" fill="none" stroke="#d8ad57" strokeWidth="1" />
    <circle cx="60" cy="8" r="1.5" fill="#d8ad57" />
    <line x1="75" y1="8" x2="120" y2="8" stroke="#d8ad57" strokeWidth="1" />
  </svg>
);

export default function TemaCarbon({ restaurant, sections, incluirFotos, qrDataUrl }: Props) {
  return (
    <>
      <style>{`
        @page { size: A4; margin: 0; }
        .carbon-page {
          background: linear-gradient(180deg, #2b231a 0%, #1d1812 100%);
          color: #f5efe3;
          font-family: 'Cormorant Garamond', serif;
          padding: 32mm 20mm 18mm;
          box-sizing: border-box;
          position: relative;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
        .carbon-frame {
          border: 1.5px solid #d8ad57;
          outline: 1px solid #d8ad5730;
          outline-offset: 4px;
          padding: 14mm 12mm;
          position: relative;
          box-sizing: border-box;
        }
        .carbon-header {
          text-align: center;
          margin-bottom: 8mm;
        }
        .carbon-logo {
          width: 50px; height: 50px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #d8ad57;
          margin-bottom: 6px;
        }
        .carbon-title {
          font-family: 'Cinzel', serif;
          font-size: 28pt;
          font-weight: 700;
          color: #d8ad57;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin: 0 0 4px;
        }
        .carbon-subtitle {
          font-size: 9pt;
          color: #d8ad5790;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          margin: 0;
        }
        .carbon-section {
          break-inside: avoid;
          margin-bottom: 7mm;
          padding-top: 6mm;
        }
        .carbon-section-title {
          font-family: 'Cinzel', serif;
          font-size: 15pt;
          font-weight: 700;
          color: #d8ad57;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          text-align: center;
          margin: 0 0 4mm;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .carbon-section-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(216,173,87,0.4));
        }
        .carbon-section-line-r {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, rgba(216,173,87,0.4), transparent);
        }
        /* Text-only (2 columns) */
        .carbon-dishes-text {
          column-count: 2;
          column-gap: 8mm;
        }
        .carbon-dish-text {
          break-inside: avoid;
          margin-bottom: 3.5mm;
        }
        .carbon-dish-row {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .carbon-dish-name {
          font-family: 'Cinzel', serif;
          font-size: 12pt;
          font-weight: 700;
          color: #f5efe3;
          flex: 1;
          min-width: 0;
          word-wrap: break-word;
        }
        .carbon-dish-dots {
          flex: 0 0 auto;
          width: 20px;
          border-bottom: 1px dotted #d8ad5750;
          margin-bottom: 2px;
        }
        .carbon-dish-price {
          font-family: 'Cinzel', serif;
          font-size: 12pt;
          font-weight: 700;
          color: #d8ad57;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .carbon-dish-desc {
          font-size: 10.5pt;
          font-style: italic;
          color: #f5efe3a0;
          margin: 1px 0 0;
          line-height: 1.3;
        }
        /* Photo mode */
        .carbon-dishes-photo {
          display: flex;
          flex-direction: column;
          gap: 3mm;
        }
        .carbon-dish-photo-row {
          display: flex;
          align-items: center;
          gap: 3mm;
          break-inside: avoid;
        }
        .carbon-dish-img {
          width: 56px; height: 56px;
          border-radius: 6px;
          object-fit: cover;
          border: 1px solid #d8ad5740;
          flex-shrink: 0;
        }
        .carbon-dish-info {
          flex: 1;
          min-width: 0;
        }
        .carbon-dish-info-top {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .carbon-old-price {
          font-size: 7pt;
          color: #f5efe360;
          text-decoration: line-through;
          margin-left: 4px;
        }
      `}</style>

      <div className="carbon-page">
        <div className="carbon-frame">
          {/* Corner ornaments */}
          <CornerOrnament style={{ position: "absolute", top: -2, left: -2 }} />
          <CornerOrnament style={{ position: "absolute", top: -2, right: -2, transform: "scaleX(-1)" }} />
          <CornerOrnament style={{ position: "absolute", bottom: -2, left: -2, transform: "scaleY(-1)" }} />
          <CornerOrnament style={{ position: "absolute", bottom: -2, right: -2, transform: "scale(-1)" }} />

          {/* Header */}
          <div className="carbon-header" style={{ position: "relative" }}>
            {qrDataUrl && (
              <div style={{ position: "absolute", top: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ padding: 3, background: "#fff", borderRadius: 4, border: "1px solid rgba(216,173,87,0.3)" }}>
                  <img src={qrDataUrl} alt="QR" style={{ width: 44, height: 44, display: "block" }} />
                </div>
                <span style={{ fontSize: "5.5pt", color: "#d8ad57", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Cinzel', serif", textAlign: "center" }}>Ver carta QR</span>
              </div>
            )}
            {restaurant.logoUrl && (
              <img src={restaurant.logoUrl} alt="" className="carbon-logo" />
            )}
            <h1 className="carbon-title">{restaurant.name}</h1>
            {restaurant.address && (
              <p className="carbon-subtitle">{restaurant.address}</p>
            )}
            <div style={{ marginTop: 8 }}>
              <GoldDivider />
            </div>
          </div>

          {/* Sections */}
          {sections.map((section, i) => (
            <div key={i} className="carbon-section" data-pdf-section>
              <h2 className="carbon-section-title"><span className="carbon-section-line" />{section.titulo}<span className="carbon-section-line-r" /></h2>

              {(incluirFotos && section.platos.some(p => p.foto)) ? (
                <div className="carbon-dishes-photo">
                  {section.platos.map((p, j) => (
                    <div key={j} className="carbon-dish-photo-row">
                      {p.foto ? (
                        <img src={p.foto} alt="" className="carbon-dish-img" />
                      ) : (
                        <div className="carbon-dish-img" style={{ background: "#3a2f22" }} />
                      )}
                      <div className="carbon-dish-info">
                        <div className="carbon-dish-info-top">
                          <span className="carbon-dish-name">{p.nombre}</span>
                          <span className="carbon-dish-dots" />
                          <span className="carbon-dish-price">
                            {p.precio}
                            {p.precioDescuento && (
                              <span className="carbon-old-price">{p.precioDescuento}</span>
                            )}
                          </span>
                        </div>
                        {p.descripcion && (
                          <p className="carbon-dish-desc">{p.descripcion}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="carbon-dishes-text">
                  {section.platos.map((p, j) => (
                    <div key={j} className="carbon-dish-text">
                      <div className="carbon-dish-row">
                        <span className="carbon-dish-name">{p.nombre}</span>
                        <span className="carbon-dish-dots" />
                        <span className="carbon-dish-price">
                          {p.precio}
                          {p.precioDescuento && (
                            <span className="carbon-old-price">{p.precioDescuento}</span>
                          )}
                        </span>
                      </div>
                      {p.descripcion && (
                        <p className="carbon-dish-desc">{p.descripcion}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {i < sections.length - 1 && (
                <div style={{ marginTop: "5mm" }}>
                  <GoldDivider />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
