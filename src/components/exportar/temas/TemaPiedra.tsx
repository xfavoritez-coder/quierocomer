"use client";

import type { Section } from "../ExportarCarta";

interface Props {
  restaurant: { name: string; logoUrl: string | null; address: string | null; phone: string | null };
  sections: Section[];
  incluirFotos: boolean;
}

/* ── Stone line divider ── */
const StoneDivider = () => (
  <svg width="160" height="12" viewBox="0 0 160 12" style={{ display: "block", margin: "0 auto" }}>
    <line x1="0" y1="6" x2="65" y2="6" stroke="#8a7e72" strokeWidth="0.8" />
    <circle cx="80" cy="6" r="3" fill="none" stroke="#8a7e72" strokeWidth="0.8" />
    <circle cx="80" cy="6" r="1" fill="#8a7e72" />
    <line x1="95" y1="6" x2="160" y2="6" stroke="#8a7e72" strokeWidth="0.8" />
  </svg>
);

export default function TemaPiedra({ restaurant, sections, incluirFotos }: Props) {
  // SVG noise texture for rocky feel
  const noiseSVG = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="200" height="200" filter="url(#n)" opacity="0.08"/></svg>`)}`;

  return (
    <>
      <style>{`
        .piedra-page {
          background:
            url("${noiseSVG}") repeat,
            linear-gradient(170deg, #6b6560 0%, #5a5550 30%, #4e4a45 60%, #5c5752 100%);
          color: #f0ece6;
          font-family: 'Jost', sans-serif;
          padding: 20mm 22mm;
          box-sizing: border-box;
          position: relative;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
        .piedra-header {
          text-align: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
        }
        .piedra-logo {
          width: 54px; height: 54px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #c4b8a8;
          margin: 0 auto 8px;
          display: block;
        }
        .piedra-title {
          font-family: 'Cinzel', serif;
          font-size: 30pt;
          font-weight: 700;
          color: #f0ece6;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin: 0 0 4px;
          text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .piedra-subtitle {
          font-size: 10pt;
          color: #c4b8a8;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          margin: 0;
        }
        .piedra-section {
          break-inside: avoid;
          margin-bottom: 24px;
        }
        .piedra-section-title {
          font-family: 'Cinzel', serif;
          font-size: 14pt;
          font-weight: 700;
          color: #c4b8a8;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          text-align: center;
          margin: 0 0 14px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(196,184,168,0.25);
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
          border-bottom: 1px dotted rgba(196,184,168,0.35);
          margin-bottom: 3px;
        }
        .piedra-dish-price {
          font-family: 'Jost', sans-serif;
          font-size: 12pt;
          font-weight: 600;
          color: #c4b8a8;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .piedra-dish-desc {
          font-size: 10.5pt;
          font-style: italic;
          color: rgba(240,236,230,0.55);
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
          border-radius: 8px;
          object-fit: cover;
          border: 1px solid rgba(196,184,168,0.25);
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
          color: rgba(240,236,230,0.4);
          text-decoration: line-through;
          margin-left: 4px;
        }
      `}</style>

      <div className="piedra-page">
        {/* Header */}
        <div className="piedra-header">
          {restaurant.logoUrl && (
            <img src={restaurant.logoUrl} alt="" className="piedra-logo" />
          )}
          <h1 className="piedra-title">{restaurant.name}</h1>
          {restaurant.address && (
            <p className="piedra-subtitle">{restaurant.address}</p>
          )}
          <div style={{ marginTop: 10 }}>
            <StoneDivider />
          </div>
        </div>

        {/* Sections */}
        {sections.map((section, i) => (
          <div key={i} className="piedra-section">
            <h2 className="piedra-section-title">{section.titulo}</h2>

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
              <div style={{ marginTop: 16 }}>
                <StoneDivider />
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
