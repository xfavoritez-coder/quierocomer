"use client";

/**
 * /imprimirqr
 *
 * Formulario para imprimir codigos QR de un local. Permite elegir:
 * - Local
 * - Tamaño del QR (cm)
 * - Cantidad total de stickers
 * - Tamaño de la hoja (default 100x150mm — formato sticker estandar)
 *
 * Calcula cuantos QRs caben por hoja y cuantas hojas hace falta. Al
 * confirmar redirige a /imprimirqr/print con los parametros.
 */
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  qrToken: string | null;
};

const F = "var(--font-display, -apple-system, sans-serif)";
const FB = "var(--font-body, -apple-system, sans-serif)";

export default function ImprimirQrPage() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState("");
  const [qrCm, setQrCm] = useState(5); // 5cm default
  const [qty, setQty] = useState(20);
  const [paperW, setPaperW] = useState(100); // mm
  const [paperH, setPaperH] = useState(150); // mm

  useEffect(() => {
    fetch("/api/qr/print/restaurants")
      .then((r) => r.json())
      .then((d) => {
        setRestaurants(d.restaurants || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const layout = useMemo(() => {
    const qrMm = qrCm * 10;
    // Edge-to-edge: sin margen ni gap. Maximiza la densidad por hoja.
    // El usuario corta por la linea de separacion entre QRs adyacentes.
    const cols = Math.max(1, Math.floor(paperW / qrMm));
    const rows = Math.max(1, Math.floor(paperH / qrMm));
    const perPage = cols * rows;
    const pages = Math.max(1, Math.ceil(qty / perPage));
    const fits = qrMm <= paperW && qrMm <= paperH;
    return { qrMm, cols, rows, perPage, pages, fits };
  }, [qrCm, qty, paperW, paperH]);

  const selectedRestaurant = restaurants.find((r) => r.slug === slug);

  const handleSubmit = () => {
    if (!slug) return;
    const params = new URLSearchParams({
      slug,
      size: String(qrCm),
      qty: String(qty),
      paperW: String(paperW),
      paperH: String(paperH),
    });
    router.push(`/imprimirqr/print?${params.toString()}`);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f3", padding: "32px 16px 60px", fontFamily: FB }}>
      <div style={{ maxWidth: 540, margin: "0 auto" }}>
        <h1 style={{ fontFamily: F, fontSize: "1.6rem", fontWeight: 700, color: "#1a1a1a", margin: "0 0 6px" }}>Imprimir QRs</h1>
        <p style={{ fontSize: "0.92rem", color: "#666", margin: "0 0 28px", lineHeight: 1.5 }}>
          Genera una hoja imprimible con códigos QR del local elegido, con su logo al centro. Aprovechamos todo el espacio de cada hoja según el tamaño que elijas.
        </p>

        {loading ? (
          <p style={{ color: "#888", fontSize: "0.92rem" }}>Cargando locales…</p>
        ) : (
          <div style={{ background: "white", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", border: "1px solid #ececea" }}>
            {/* Local */}
            <Field label="Local">
              <select
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                style={inputStyle}
              >
                <option value="">— Elige un local —</option>
                {restaurants.map((r) => (
                  <option key={r.id} value={r.slug}>{r.name}</option>
                ))}
              </select>
              {selectedRestaurant && (
                <p style={{ fontSize: "0.78rem", color: "#888", margin: "6px 0 0" }}>
                  Apunta a: <code style={{ background: "#f5f5f3", padding: "1px 6px", borderRadius: 3 }}>quierocomer.cl/qr/{selectedRestaurant.slug}{selectedRestaurant.qrToken ? `?t=${selectedRestaurant.qrToken}` : ""}</code>
                </p>
              )}
            </Field>

            {/* Tamaño QR */}
            <Field label="Tamaño del QR" hint="Lado del cuadrado en cm">
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ display: "flex", gap: 6, flex: 1, flexWrap: "wrap" }}>
                  {[3, 4, 5, 6, 7, 8].map((cm) => (
                    <button
                      key={cm}
                      type="button"
                      onClick={() => setQrCm(cm)}
                      style={{
                        padding: "8px 14px", borderRadius: 999,
                        background: qrCm === cm ? "#1a1a1a" : "white",
                        color: qrCm === cm ? "white" : "#555",
                        border: qrCm === cm ? "1.5px solid #1a1a1a" : "1.5px solid #ececea",
                        fontFamily: F, fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      {cm}×{cm} cm
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <input
                  type="number"
                  min="2"
                  max="20"
                  step="0.5"
                  value={qrCm}
                  onChange={(e) => setQrCm(Math.max(2, Math.min(20, Number(e.target.value) || 5)))}
                  style={{ ...inputStyle, width: 100 }}
                /> <span style={{ fontSize: "0.85rem", color: "#888", marginLeft: 6 }}>cm (personalizado)</span>
              </div>
            </Field>

            {/* Cantidad */}
            <Field label="Cantidad de QRs" hint="¿Cuántos stickers necesitas en total?">
              <input
                type="number"
                min="1"
                max="500"
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                style={inputStyle}
              />
            </Field>

            {/* Tamaño hoja */}
            <Field label="Tamaño de la hoja" hint="Default: hoja sticker estándar 100×150 mm">
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="number"
                  min="50"
                  max="500"
                  value={paperW}
                  onChange={(e) => setPaperW(Math.max(50, Math.min(500, Number(e.target.value) || 100)))}
                  style={{ ...inputStyle, width: 80 }}
                />
                <span style={{ color: "#888" }}>×</span>
                <input
                  type="number"
                  min="50"
                  max="500"
                  value={paperH}
                  onChange={(e) => setPaperH(Math.max(50, Math.min(500, Number(e.target.value) || 150)))}
                  style={{ ...inputStyle, width: 80 }}
                />
                <span style={{ fontSize: "0.85rem", color: "#888" }}>mm</span>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {[
                  { label: "Sticker 100×150", w: 100, h: 150 },
                  { label: "A4", w: 210, h: 297 },
                  { label: "Carta", w: 216, h: 279 },
                ].map((p) => {
                  const active = paperW === p.w && paperH === p.h;
                  return (
                    <button key={p.label} type="button" onClick={() => { setPaperW(p.w); setPaperH(p.h); }} style={{
                      padding: "5px 12px", borderRadius: 999,
                      background: active ? "#1a1a1a" : "white",
                      color: active ? "white" : "#888",
                      border: active ? "1.5px solid #1a1a1a" : "1.5px solid #ececea",
                      fontFamily: F, fontSize: "0.78rem", fontWeight: 500, cursor: "pointer",
                    }}>{p.label}</button>
                  );
                })}
              </div>
            </Field>

            {/* Resumen */}
            <div style={{ background: "#fff8e7", border: "1px solid #fde68a", borderRadius: 10, padding: "14px 16px", marginTop: 18 }}>
              {!layout.fits ? (
                <p style={{ fontSize: "0.88rem", color: "#dc2626", margin: 0, fontWeight: 600 }}>
                  ⚠ El QR de {qrCm}×{qrCm} cm no entra en la hoja de {paperW}×{paperH} mm.
                </p>
              ) : (
                <>
                  <p style={{ fontSize: "0.88rem", color: "#92400e", margin: "0 0 4px", fontWeight: 700 }}>
                    {layout.cols} × {layout.rows} = <strong>{layout.perPage} QRs por hoja</strong>
                  </p>
                  <p style={{ fontSize: "0.82rem", color: "#78350f", margin: 0 }}>
                    Para {qty} stickers vas a imprimir <strong>{layout.pages} {layout.pages === 1 ? "hoja" : "hojas"}</strong> ({layout.pages * layout.perPage - qty > 0 ? `${layout.pages * layout.perPage - qty} sobrante${layout.pages * layout.perPage - qty === 1 ? "" : "s"}` : "sin sobrante"})
                  </p>
                </>
              )}
            </div>

            <button
              onClick={handleSubmit}
              disabled={!slug || !layout.fits}
              style={{
                width: "100%", marginTop: 18, padding: "14px",
                background: !slug || !layout.fits ? "#ccc" : "#F4A623",
                color: "white", border: "none", borderRadius: 10,
                fontFamily: F, fontSize: "0.95rem", fontWeight: 700,
                cursor: !slug || !layout.fits ? "not-allowed" : "pointer",
                boxShadow: !slug || !layout.fits ? "none" : "0 4px 14px rgba(244,166,35,0.3)",
              }}
            >
              Generar imprimible →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "#fafaf8",
  border: "1px solid #e0dcd4",
  borderRadius: 8,
  fontFamily: "inherit",
  fontSize: "0.92rem",
  color: "#1a1a1a",
  outline: "none",
  boxSizing: "border-box",
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: "0.78rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6, fontWeight: 600, fontFamily: "var(--font-display)" }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: "0.74rem", color: "#999", margin: "4px 0 0" }}>{hint}</p>}
    </div>
  );
}
