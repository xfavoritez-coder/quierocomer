"use client";

/**
 * /imprimirqr/print
 *
 * Preview imprimible. Lee params del URL, fetcha el restaurant y arma
 * N hojas con un grid de QRs (cada QR con logo del local al centro
 * si tiene). Boton "Imprimir" arriba (se oculta al imprimir).
 */
import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  qrToken: string | null;
};

const F = "var(--font-display, -apple-system, sans-serif)";
const FB = "var(--font-body, -apple-system, sans-serif)";

function PrintPageInner() {
  const params = useSearchParams();
  const slug = params.get("slug") || "";
  const size = Math.max(2, Math.min(20, Number(params.get("size") || 5)));
  const qty = Math.max(1, Math.min(500, Number(params.get("qty") || 20)));
  const paperW = Math.max(50, Math.min(500, Number(params.get("paperW") || 100)));
  const paperH = Math.max(50, Math.min(500, Number(params.get("paperH") || 150)));
  // logo: "1" o "0". Default "1" para no romper URLs antiguas.
  const withLogo = params.get("logo") !== "0";

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch restaurant
  useEffect(() => {
    if (!slug) { setLoading(false); return; }
    fetch("/api/qr/print/restaurants")
      .then((r) => r.json())
      .then((d) => {
        const r = (d.restaurants || []).find((x: Restaurant) => x.slug === slug);
        setRestaurant(r || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  // Generate QR data URL once we have the restaurant
  useEffect(() => {
    if (!restaurant) return;
    const baseUrl = typeof window !== "undefined" ? window.location.origin.replace(/^http:/, "https:") : "https://quierocomer.cl";
    const url = `${baseUrl}/qr/${restaurant.slug}${restaurant.qrToken ? `?t=${restaurant.qrToken}` : ""}`;
    QRCode.toDataURL(url, {
      errorCorrectionLevel: "H",
      // quiet zone minima — antes 2 modulos hacia que QRs adyacentes se vieran
      // separados aunque las celdas estuvieran pegadas. 1 modulo basta para
      // que cualquier scanner moderno lea el codigo, y los QRs quedan visualmente
      // mas juntos en la hoja.
      margin: 1,
      width: 1200, // alta resolucion para imprimir nitido
      color: { dark: "#000000", light: "#FFFFFF" },
    }).then(setQrDataUrl);
  }, [restaurant]);

  // Layout calc — edge-to-edge: sin margen ni gap, max densidad
  const layout = useMemo(() => {
    const qrMm = size * 10;
    const margin = 0;
    const gap = 0;
    const cols = Math.max(1, Math.floor(paperW / qrMm));
    const rows = Math.max(1, Math.floor(paperH / qrMm));
    const perPage = cols * rows;
    const pages = Math.max(1, Math.ceil(qty / perPage));
    return { qrMm, cols, rows, perPage, pages, margin, gap };
  }, [size, qty, paperW, paperH]);

  // Build pages with proper QR count (last page may have fewer)
  const pages = useMemo(() => {
    const result: number[] = [];
    let remaining = qty;
    for (let i = 0; i < layout.pages; i++) {
      const onThisPage = Math.min(remaining, layout.perPage);
      result.push(onThisPage);
      remaining -= onThisPage;
    }
    return result;
  }, [qty, layout]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", fontFamily: FB }}>Cargando…</div>;
  }
  if (!restaurant) {
    return <div style={{ padding: 40, textAlign: "center", fontFamily: FB, color: "#dc2626" }}>Local no encontrado.</div>;
  }
  if (!qrDataUrl) {
    return <div style={{ padding: 40, textAlign: "center", fontFamily: FB }}>Generando QR…</div>;
  }

  // Logo size: ~22% del QR — con error-correction H el QR sigue siendo escaneable.
  // Se usa como porcentaje del cell (que es flexible con grid 1fr).

  return (
    <>
      {/* Toolbar — solo visible en pantalla */}
      <div className="qr-toolbar" style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "#1a1a1a", color: "white", padding: "16px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
        fontFamily: FB,
      }}>
        <div>
          <p style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 700, margin: "0 0 2px" }}>
            {restaurant.name} · {qty} QRs de {size}×{size} cm
          </p>
          <p style={{ fontSize: "0.78rem", color: "#999", margin: 0 }}>
            {layout.pages} {layout.pages === 1 ? "hoja" : "hojas"} · {layout.cols}×{layout.rows} QRs por hoja · papel {paperW}×{paperH} mm
          </p>
        </div>
        <button
          onClick={() => window.print()}
          style={{
            padding: "10px 20px", background: "#F4A623", color: "white",
            border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.88rem",
            fontWeight: 700, cursor: "pointer",
          }}
        >
          🖨 Imprimir
        </button>
      </div>

      {/* Instrucciones — solo en pantalla */}
      <div className="qr-toolbar" style={{ padding: "14px 24px", background: "#fff8e7", borderBottom: "1px solid #fde68a", fontFamily: FB, fontSize: "0.82rem", color: "#78350f", lineHeight: 1.6 }}>
        <strong>Para imprimir:</strong> Ctrl+P → Tamaño papel: <strong>Custom {paperW}×{paperH} mm</strong> → Márgenes: <strong>Ninguno</strong> → Escala: <strong>100%</strong> (NO ajustar a página) → Imprimir.
      </div>

      {/* Hojas */}
      <div style={{ background: "#e8e4dc", padding: 20, minHeight: "calc(100vh - 100px)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
          {(() => {
            // Celdas cuadradas perfectas — usamos el lado mas chico que entra.
            // Solo dejamos 4mm de safety abajo (zona no imprimible del impresor).
            // Sin safety arriba ni a los lados — los QRs se pegan al tope.
            const bottomSafetyMm = 4;
            const cellSize = Math.min(paperW / layout.cols, (paperH - bottomSafetyMm) / layout.rows);
            const gridWidthMm = layout.cols * cellSize;
            return pages.map((countOnPage, pageIdx) => (
            <div
              key={pageIdx}
              className="qr-page"
              style={{
                width: `${paperW}mm`,
                height: `${paperH}mm`,
                background: "white",
                position: "relative",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                pageBreakAfter: pageIdx < pages.length - 1 ? "always" : "auto",
                padding: 0,
                boxSizing: "border-box",
                overflow: "hidden",
              }}
            >
              <div style={{
                display: "grid",
                gridTemplateColumns: `repeat(${layout.cols}, ${cellSize}mm)`,
                gridTemplateRows: `repeat(${layout.rows}, ${cellSize}mm)`,
                gap: 0,
                width: `${gridWidthMm}mm`,
                margin: "0 auto", // centra horizontalmente, top-aligned
              }}>
                {Array.from({ length: countOnPage }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: `${cellSize}mm`,
                      height: `${cellSize}mm`,
                      position: "relative",
                      background: "white",
                    }}
                  >
                    {/* QR */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrDataUrl}
                      alt={`QR ${restaurant.name}`}
                      style={{ width: "100%", height: "100%", display: "block" }}
                    />
                    {/* Logo overlay al centro (si el local tiene logo Y el usuario lo eligió) */}
                    {withLogo && restaurant.logoUrl && (
                      <div style={{
                        position: "absolute",
                        top: "50%", left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: "22%",
                        height: "22%",
                        background: "white",
                        borderRadius: "50%",
                        padding: "2%",
                        boxSizing: "border-box",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={restaurant.logoUrl}
                          alt={restaurant.name}
                          crossOrigin="anonymous"
                          style={{
                            width: "100%", height: "100%",
                            objectFit: "cover",
                            borderRadius: "50%",
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            ));
          })()}
        </div>
      </div>

      {/* Print CSS */}
      <style jsx global>{`
        @page {
          size: ${paperW}mm ${paperH}mm;
          margin: 0;
        }
        @media print {
          html, body {
            margin: 0;
            padding: 0;
            background: white !important;
          }
          .qr-toolbar { display: none !important; }
          .qr-page {
            box-shadow: none !important;
            margin: 0 !important;
            page-break-after: always;
          }
        }
      `}</style>
    </>
  );
}

export default function PrintPageWrapper() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", fontFamily: FB }}>Cargando…</div>}>
      <PrintPageInner />
    </Suspense>
  );
}
