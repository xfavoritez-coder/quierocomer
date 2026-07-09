"use client";

import type { Section } from "../ExportarCarta";

interface Props {
  restaurant: { name: string; logoUrl: string | null; address: string | null; phone: string | null };
  sections: Section[];
  incluirFotos: boolean;
  qrDataUrl?: string;
}

/* ── Chiseled line divider ── */
const ChiselDivider = () => (
  <svg width="180" height="16" viewBox="0 0 180 16" style={{ display: "block", margin: "0 auto" }}>
    <line x1="0" y1="8" x2="70" y2="8" stroke="#a09888" strokeWidth="0.6" />
    <polygon points="85,3 90,8 85,13 80,8" fill="none" stroke="#a09888" strokeWidth="0.8" />
    <polygon points="95,3 100,8 95,13 90,8" fill="none" stroke="#a09888" strokeWidth="0.8" />
    <line x1="110" y1="8" x2="180" y2="8" stroke="#a09888" strokeWidth="0.6" />
  </svg>
);

/* ── Corner bracket ornament ── */
const CornerBracket = ({ style }: { style?: React.CSSProperties }) => (
  <svg width="32" height="32" viewBox="0 0 32 32" style={style}>
    <path d="M2 12 L2 2 L12 2" fill="none" stroke="#a09888" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export default function TemaPiedra({ restaurant, sections, incluirFotos, qrDataUrl }: Props) {
  return (
    <>
      <style>{`
        .piedra-page {
          background:
            repeating-linear-gradient(
              0deg,
              rgba(80,72,65,0.06) 0px, rgba(80,72,65,0.06) 1px,
              transparent 1px, transparent 3px
            ),
            repeating-linear-gradient(
              90deg,
              rgba(60,54,48,0.04) 0px, rgba(60,54,48,0.04) 1px,
              transparent 1px, transparent 4px
            ),
            radial-gradient(ellipse at 25% 15%, rgba(90,82,72,0.2), transparent 45%),
            radial-gradient(ellipse at 75% 85%, rgba(50,44,38,0.18), transparent 45%),
            radial-gradient(ellipse at 50% 50%, rgba(70,62,55,0.1), transparent 60%),
            linear-gradient(168deg, #3d3730 0%, #342f2a 25%, #2e2924 50%, #33302b 75%, #38342e 100%);
          color: #f0ece6;
          font-family: 'Jost', sans-serif;
          padding: 32mm 20mm 18mm;
          box-sizing: border-box;
          position: relative;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
        .piedra-frame {
          border: 1px solid rgba(160,148,132,0.3);
          padding: 12mm 14mm;
          position: relative;
        }
        .piedra-frame::before {
          content: '';
          position: absolute;
          inset: 3mm;
          border: 1px solid rgba(160,148,132,0.12);
          pointer-events: none;
        }
        .piedra-header {
          margin-bottom: 20px;
          padding-bottom: 16px;
          align-items: center;
        }
        .piedra-logo {
          width: 56px; height: 56px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid rgba(190,178,162,0.5);
          margin: 0 auto 10px;
          display: block;
        }
        .piedra-title {
          font-family: 'Cinzel', serif;
          font-size: 30pt;
          font-weight: 700;
          color: #f0ece6;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin: 0 0 4px;
          text-shadow: 0 2px 8px rgba(0,0,0,0.4);
        }
        .piedra-subtitle {
          font-size: 10pt;
          color: #beb2a2;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin: 0;
        }
        .piedra-section {
          break-inside: avoid;
          margin-bottom: 22px;
          padding-top: 6mm;
        }
        .piedra-section-title {
          font-family: 'Cinzel', serif;
          font-size: 13pt;
          font-weight: 700;
          color: #d4c8b8;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          text-align: center;
          margin: 0 0 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .piedra-section-line {
          height: 1px;
          flex: 1;
          background: linear-gradient(90deg, transparent, rgba(190,178,162,0.35));
        }
        .piedra-section-line-r {
          height: 1px;
          flex: 1;
          background: linear-gradient(90deg, rgba(190,178,162,0.35), transparent);
        }
        /* Text-only (2 columns) */
        .piedra-dishes-text {
          column-count: 2;
          column-gap: 28px;
        }
        .piedra-dish-text {
          break-inside: avoid;
          margin-bottom: 6px;
        }
        .piedra-dish-row {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .piedra-dish-name {
          font-family: 'Jost', sans-serif;
          font-size: 12pt;
          font-weight: 600;
          color: #f0ece6;
          flex: 1;
          min-width: 0;
          word-wrap: break-word;
        }
        .piedra-dish-dots {
          flex: 0 0 auto;
          width: 20px;
          border-bottom: 1px dotted rgba(190,178,162,0.3);
          margin-bottom: 3px;
        }
        .piedra-dish-price {
          font-family: 'Jost', sans-serif;
          font-size: 12pt;
          font-weight: 600;
          color: #d4c8b8;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .piedra-dish-desc {
          font-size: 10.5pt;
          font-style: italic;
          color: rgba(240,236,230,0.5);
          margin: 2px 0 0;
          line-height: 1.35;
        }
        /* Photo mode */
        .piedra-dishes-photo {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .piedra-dish-photo-row {
          display: flex;
          align-items: center;
          gap: 10px;
          break-inside: avoid;
        }
        .piedra-dish-img {
          width: 56px; height: 56px;
          border-radius: 6px;
          object-fit: cover;
          border: 1px solid rgba(190,178,162,0.25);
          flex-shrink: 0;
        }
        .piedra-dish-info {
          flex: 1;
          min-width: 0;
        }
        .piedra-dish-info-top {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .piedra-old-price {
          font-size: 9pt;
          color: rgba(240,236,230,0.35);
          text-decoration: line-through;
          margin-left: 4px;
        }
      `}</style>

      <div className="piedra-page">
        <div className="piedra-frame">
          {/* Corner brackets */}
          <CornerBracket style={{ position: "absolute", top: 5, left: 5 }} />
          <CornerBracket style={{ position: "absolute", top: 5, right: 5, transform: "scaleX(-1)" }} />
          <CornerBracket style={{ position: "absolute", bottom: 5, left: 5, transform: "scaleY(-1)" }} />
          <CornerBracket style={{ position: "absolute", bottom: 5, right: 5, transform: "scale(-1)" }} />

          {/* Header */}
          <div className="piedra-header" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Logo left */}
            <div style={{ flexShrink: 0, width: 70, display: "flex", flexDirection: "column", alignItems: "center" }}>
              {restaurant.logoUrl && (
                <img src={restaurant.logoUrl} alt="" className="piedra-logo" style={{ margin: 0 }} />
              )}
            </div>

            {/* Title center */}
            <div style={{ flex: 1, textAlign: "center" }}>
              <h1 className="piedra-title" style={{ color: "#f0ece6", fontFamily: "'Cinzel', Georgia, serif", fontSize: "30pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>{restaurant.name}</h1>
              {restaurant.address && (
                <p className="piedra-subtitle" style={{ color: "#beb2a2" }}>{restaurant.address}</p>
              )}
              <div style={{ marginTop: 12 }}>
                <ChiselDivider />
              </div>
            </div>

            {/* QR right */}
            <div style={{ flexShrink: 0, width: 70, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              {qrDataUrl && (
                <>
                  <div style={{ padding: 5, background: "rgba(160,148,132,0.08)", borderRadius: 6, border: "2px solid #a09888" }}>
                    <img src={qrDataUrl} alt="QR" style={{ width: 60, height: 60, display: "block" }} />
                  </div>
                  <span style={{ fontSize: "6.5pt", color: "#a09888", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Cinzel', serif", textAlign: "center" }}>Ver carta QR</span>
                </>
              )}
            </div>
          </div>

          {/* Sections */}
          {sections.map((section, i) => (
            <div key={i} className="piedra-section" data-pdf-section>
              <h2 className="piedra-section-title"><span className="piedra-section-line" />{section.titulo}<span className="piedra-section-line-r" /></h2>

              {incluirFotos ? (
                <div className="piedra-dishes-photo">
                  {section.platos.map((p, j) => (
                    <div key={j} className="piedra-dish-photo-row">
                      {p.foto ? (
                        <img src={p.foto} alt="" className="piedra-dish-img" />
                      ) : (
                        <div className="piedra-dish-img" style={{ background: "#4a4540" }} />
                      )}
                      <div className="piedra-dish-info">
                        <div className="piedra-dish-info-top">
                          <span className="piedra-dish-name">{p.nombre}</span>
                          <span className="piedra-dish-dots" />
                          <span className="piedra-dish-price">
                            {p.precio}
                            {p.precioDescuento && (
                              <span className="piedra-old-price">{p.precioDescuento}</span>
                            )}
                          </span>
                        </div>
                        {p.descripcion && (
                          <p className="piedra-dish-desc">{p.descripcion}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="piedra-dishes-text">
                  {section.platos.map((p, j) => (
                    <div key={j} className="piedra-dish-text">
                      <div className="piedra-dish-row">
                        <span className="piedra-dish-name">{p.nombre}</span>
                        <span className="piedra-dish-dots" />
                        <span className="piedra-dish-price">
                          {p.precio}
                          {p.precioDescuento && (
                            <span className="piedra-old-price">{p.precioDescuento}</span>
                          )}
                        </span>
                      </div>
                      {p.descripcion && (
                        <p className="piedra-dish-desc">{p.descripcion}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {i < sections.length - 1 && (
                <div style={{ marginTop: 14 }}>
                  <ChiselDivider />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
