"use client";

import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";

interface Props {
  restaurant: { id: string; slug: string; name: string; logoUrl: string | null; qrToken: string | null };
}

type Size = "small" | "medium" | "large";

// QR size = the actual QR code. Padding = margin between QR and cut lines.
const PADDING_MM = 5; // 5mm margin around QR inside cut lines

const SIZE_CONFIG: Record<Size, { label: string; desc: string; qrMm: number }> = {
  small: { label: "Pequeño", desc: "5×5 cm — para pegar en la mesa", qrMm: 50 },
  medium: { label: "Mediano", desc: "8×8 cm — tent card de mesa", qrMm: 80 },
  large: { label: "Grande", desc: "12×12 cm — para pared o vitrina", qrMm: 120 },
};

const BASE_URL = "https://quierocomer.cl";

export default function QRPageClient({ restaurant }: Props) {
  const [size, setSize] = useState<Size>("medium");
  const [quantity, setQuantity] = useState(4);
  const [quantityInput, setQuantityInput] = useState("4");
  const [generating, setGenerating] = useState(false);
  const [qrPreview, setQrPreview] = useState<string>("");
  const [qrWithLogo, setQrWithLogo] = useState<string>("");

  const qrUrl = restaurant.qrToken
    ? `${BASE_URL}/qr/${restaurant.slug}?t=${restaurant.qrToken}`
    : `${BASE_URL}/qr/${restaurant.slug}`;

  // Generate QR with logo overlay
  useEffect(() => {
    async function gen() {
      const plain = await QRCode.toDataURL(qrUrl, { width: 600, margin: 1, errorCorrectionLevel: "H", color: { dark: "#0e0e0e", light: "#ffffff" } });
      setQrPreview(plain);

      if (restaurant.logoUrl) {
        const canvas = document.createElement("canvas");
        canvas.width = 600;
        canvas.height = 600;
        const ctx = canvas.getContext("2d")!;

        const qrImg = new Image();
        qrImg.crossOrigin = "anonymous";
        qrImg.src = plain;
        await new Promise((r) => (qrImg.onload = r));
        ctx.drawImage(qrImg, 0, 0, 600, 600);

        // White circle background for logo
        const logoSize = 120;
        const cx = 300, cy = 300;
        ctx.beginPath();
        ctx.arc(cx, cy, logoSize / 2 + 12, 0, Math.PI * 2);
        ctx.fillStyle = "white";
        ctx.fill();

        // Logo
        try {
          const logoImg = new Image();
          logoImg.crossOrigin = "anonymous";
          const logoSrc = restaurant.logoUrl.includes("supabase.co") ? restaurant.logoUrl : `/api/proxy-image?url=${encodeURIComponent(restaurant.logoUrl)}`;
          logoImg.src = logoSrc;
          await new Promise((r) => { logoImg.onload = r; logoImg.onerror = r; });
          if (logoImg.naturalWidth > 0) {
            ctx.beginPath();
            ctx.arc(cx, cy, logoSize / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(logoImg, cx - logoSize / 2, cy - logoSize / 2, logoSize, logoSize);
          }
        } catch {}

        setQrWithLogo(canvas.toDataURL("image/png"));
      }
    }
    gen();
  }, [qrUrl, restaurant.logoUrl]);

  const finalQr = restaurant.logoUrl ? qrWithLogo || qrPreview : qrPreview;

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const cfg = SIZE_CONFIG[size];
      const qrMm = cfg.qrMm;
      const cellMm = qrMm + PADDING_MM * 2; // total cell = QR + padding on each side
      const pageW = 210, pageH = 297, margin = 10;
      const cols = Math.floor((pageW - margin * 2) / cellMm);
      const rows = Math.floor((pageH - margin * 2) / cellMm);
      const perPage = cols * rows;
      const pages = Math.ceil(quantity / perPage);

      // Generate high-res QR with logo
      const qrHi = await QRCode.toDataURL(qrUrl, { width: 1200, margin: 1, errorCorrectionLevel: "H", color: { dark: "#0e0e0e", light: "#ffffff" } });

      let qrFinal = qrHi;
      if (restaurant.logoUrl) {
        const canvas = document.createElement("canvas");
        canvas.width = 1200; canvas.height = 1200;
        const ctx = canvas.getContext("2d")!;
        const qrImg = new Image(); qrImg.src = qrHi;
        await new Promise((r) => (qrImg.onload = r));
        ctx.drawImage(qrImg, 0, 0, 1200, 1200);
        const ls = 240, cx = 600, cy = 600;
        ctx.beginPath(); ctx.arc(cx, cy, ls / 2 + 24, 0, Math.PI * 2); ctx.fillStyle = "white"; ctx.fill();
        try {
          const logoImg = new Image(); logoImg.crossOrigin = "anonymous"; logoImg.src = restaurant.logoUrl;
          await new Promise((r) => { logoImg.onload = r; logoImg.onerror = r; });
          if (logoImg.naturalWidth > 0) {
            ctx.beginPath(); ctx.arc(cx, cy, ls / 2, 0, Math.PI * 2); ctx.clip();
            ctx.drawImage(logoImg, cx - ls / 2, cy - ls / 2, ls, ls);
          }
        } catch {}
        qrFinal = canvas.toDataURL("image/png");
      }

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      let placed = 0;

      for (let p = 0; p < pages; p++) {
        if (p > 0) pdf.addPage();
        for (let r = 0; r < rows && placed < quantity; r++) {
          for (let c = 0; c < cols && placed < quantity; c++) {
            const x = margin + c * cellMm;
            const y = margin + r * cellMm;

            // Cut lines (dashed border around the full cell)
            pdf.setDrawColor(200);
            pdf.setLineDashPattern([2, 2], 0);
            pdf.setLineWidth(0.3);
            pdf.rect(x, y, cellMm, cellMm);

            // QR code centered inside the cell with padding
            pdf.addImage(qrFinal, "PNG", x + PADDING_MM, y + PADDING_MM, qrMm, qrMm);

            placed++;
          }
        }
      }
      pdf.save(`QR-${restaurant.slug}.pdf`);
    } catch (e) { console.error("PDF error:", e); }
    setGenerating(false);
  };

  const perPage = (() => {
    const cfg = SIZE_CONFIG[size];
    const cellMm = cfg.qrMm + PADDING_MM * 2;
    return Math.floor((210 - 20) / cellMm) * Math.floor((297 - 20) / cellMm);
  })();

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #FFF9ED 0%, #FFF4E0 50%, #f7f7f5 100%)" }}>
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "40px 20px 80px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 4 }}>
            {restaurant.logoUrl && <img src={restaurant.logoUrl} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />}
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", fontWeight: 800, color: "#0e0e0e", margin: 0 }}>
              {restaurant.name}
            </h1>
          </div>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "0.88rem", color: "#999" }}>Genera tu código QR para imprimir</p>
        </div>

        {/* QR Preview */}
        {finalQr && (
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ display: "inline-block", background: "white", borderRadius: 20, padding: 20, boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}>
              <img src={finalQr} alt="QR Preview" style={{ width: 180, height: 180 }} />
            </div>
            {restaurant.logoUrl && (
              <p style={{ fontFamily: "var(--font-display)", fontSize: "0.72rem", color: "#bbb", marginTop: 8 }}>QR con logo de tu local</p>
            )}
          </div>
        )}

        {/* Size + Quantity (single step, no design selector) */}
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "0.82rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Tamaño del QR</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {(["small", "medium", "large"] as Size[]).map((s) => {
            const cfg = SIZE_CONFIG[s];
            return (
              <button key={s} onClick={() => setSize(s)} style={{
                flex: 1, padding: "14px 8px", textAlign: "center",
                background: size === s ? "#FFF4E0" : "white",
                border: size === s ? "2px solid #F4A623" : "1px solid #eee",
                borderRadius: 14, cursor: "pointer",
              }}>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "0.88rem", color: "#0e0e0e", fontWeight: 600, margin: 0 }}>{cfg.label}</p>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "0.68rem", color: "#999", margin: "4px 0 0" }}>{cfg.qrMm / 10}×{cfg.qrMm / 10} cm</p>
              </button>
            );
          })}
        </div>

        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "0.82rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>¿Cuántos?</h2>
        <input type="number" min={1} max={50} value={quantityInput} onChange={(e) => setQuantityInput(e.target.value)} onBlur={() => { const n = Math.max(1, Math.min(50, parseInt(quantityInput) || 1)); setQuantity(n); setQuantityInput(String(n)); }}
          style={{ width: "100%", padding: "14px 16px", background: "white", border: "1px solid #eee", borderRadius: 12, fontSize: "1.1rem", color: "#0e0e0e", textAlign: "center", outline: "none", fontFamily: "var(--font-display)", boxSizing: "border-box" }}
        />
        <p style={{ fontFamily: "var(--font-display)", fontSize: "0.72rem", color: "#bbb", textAlign: "center", marginTop: 6 }}>
          {perPage} por hoja · {Math.ceil(quantity / perPage)} {Math.ceil(quantity / perPage) === 1 ? "página" : "páginas"} A4
        </p>

        <button onClick={generatePDF} disabled={generating} style={{ width: "100%", marginTop: 20, padding: 14, background: "#F4A623", color: "white", border: "none", borderRadius: 50, fontFamily: "var(--font-display)", fontSize: "0.95rem", fontWeight: 700, cursor: generating ? "wait" : "pointer", boxShadow: "0 4px 14px rgba(244,166,35,0.25)", opacity: generating ? 0.6 : 1 }}>
          {generating ? "Generando..." : "Descargar PDF"}
        </button>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 40 }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "0.72rem", color: "#ccc" }}>
            Powered by <span style={{ fontWeight: 700, color: "#999" }}>QuieroComer<span style={{ color: "#F4A623" }}>.cl</span></span>
          </p>
        </div>
      </div>
    </div>
  );
}
