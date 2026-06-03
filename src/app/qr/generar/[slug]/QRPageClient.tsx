"use client";

import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";

interface Props {
  restaurant: { id: string; slug: string; name: string; logoUrl: string | null; qrToken: string | null };
}

type Size = "small" | "medium" | "large" | "custom";

// QR size = the actual QR code. Padding = margin between QR and cut lines.
const PADDING_MM = 5; // 5mm margin around QR inside cut lines

const SIZE_CONFIG: Record<string, { label: string; desc: string; qrMm: number }> = {
  small: { label: "Pequeño", desc: "5×5 cm", qrMm: 50 },
  medium: { label: "Mediano", desc: "8×8 cm", qrMm: 80 },
  large: { label: "Grande", desc: "12×12 cm", qrMm: 120 },
  custom: { label: "Personalizado", desc: "", qrMm: 0 },
};

const BASE_URL = "https://quierocomer.cl";

export default function QRPageClient({ restaurant }: Props) {
  const [size, setSize] = useState<Size>("medium");
  const [customMm, setCustomMm] = useState(70);
  const [customInput, setCustomInput] = useState("7");
  const [quantity, setQuantity] = useState(4);
  const [quantityInput, setQuantityInput] = useState("4");
  const [generating, setGenerating] = useState(false);
  const [qrPreview, setQrPreview] = useState<string>("");
  const [qrWithLogo, setQrWithLogo] = useState<string>("");
  const [showLogo, setShowLogo] = useState(!!restaurant.logoUrl);

  const qrUrl = `${BASE_URL}/qr/${restaurant.slug}`;

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

  const finalQr = showLogo && restaurant.logoUrl ? qrWithLogo || qrPreview : qrPreview;

  const getQrMm = () => size === "custom" ? customMm : SIZE_CONFIG[size].qrMm;

  const downloadImage = async () => {
    if (!finalQr) return;
    const qrMm = getQrMm();
    const pxPerMm = 4; // ~96 DPI scale for good quality
    const padding = PADDING_MM * pxPerMm;
    const qrPx = qrMm * pxPerMm;
    const cellPx = qrPx + padding * 2;
    const cols = Math.min(quantity, Math.max(1, Math.floor(Math.sqrt(quantity))));
    const rows = Math.ceil(quantity / cols);
    const canvas = document.createElement("canvas");
    canvas.width = cols * cellPx;
    canvas.height = rows * cellPx;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const qrImg = new Image();
    qrImg.src = finalQr;
    await new Promise((r) => (qrImg.onload = r));

    let placed = 0;
    for (let r = 0; r < rows && placed < quantity; r++) {
      for (let c = 0; c < cols && placed < quantity; c++) {
        const x = c * cellPx + padding;
        const y = r * cellPx + padding;
        ctx.drawImage(qrImg, x, y, qrPx, qrPx);
        // Dashed cut lines
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "#ccc";
        ctx.lineWidth = 1;
        ctx.strokeRect(c * cellPx, r * cellPx, cellPx, cellPx);
        placed++;
      }
    }

    const dataUrl = canvas.toDataURL("image/png");
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(`<html><head><title>QR ${restaurant.name}</title><style>body{margin:0;background:#f5f5f5;display:flex;flex-direction:column;align-items:center;padding:20px;font-family:system-ui,sans-serif}img{max-width:100%;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.1)}a{display:inline-block;margin-top:16px;padding:12px 28px;background:#F4A623;color:#fff;border-radius:50px;text-decoration:none;font-weight:700;font-size:14px}</style></head><body><img src="${dataUrl}" alt="QR"/><a href="${dataUrl}" download="QR-${restaurant.slug}-x${quantity}.png">Descargar imagen</a></body></html>`);
      w.document.close();
    }
  };

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const qrMm = getQrMm();
      const cellMm = qrMm + PADDING_MM * 2;
      const pageW = 210, pageH = 297, margin = 10;
      const cols = Math.floor((pageW - margin * 2) / cellMm);
      const rows = Math.floor((pageH - margin * 2) / cellMm);
      const perPage = cols * rows;
      const pages = Math.ceil(quantity / perPage);

      // Use the same QR as the preview (includes logo if enabled)
      // Re-generate at high res for print quality
      const qrHi = await QRCode.toDataURL(qrUrl, { width: 1200, margin: 1, errorCorrectionLevel: "H", color: { dark: "#0e0e0e", light: "#ffffff" } });

      let qrFinal = qrHi;
      if (showLogo && restaurant.logoUrl) {
        const canvas = document.createElement("canvas");
        canvas.width = 1200; canvas.height = 1200;
        const ctx = canvas.getContext("2d")!;
        const qrImg = new Image(); qrImg.src = qrHi;
        await new Promise((r) => (qrImg.onload = r));
        ctx.drawImage(qrImg, 0, 0, 1200, 1200);
        const ls = 240, cx = 600, cy = 600;
        ctx.beginPath(); ctx.arc(cx, cy, ls / 2 + 24, 0, Math.PI * 2); ctx.fillStyle = "white"; ctx.fill();
        try {
          const logoImg = new Image(); logoImg.crossOrigin = "anonymous";
          const logoSrc = restaurant.logoUrl.includes("supabase.co") ? restaurant.logoUrl : `/api/proxy-image?url=${encodeURIComponent(restaurant.logoUrl)}`;
          logoImg.src = logoSrc;
          await new Promise((r) => { logoImg.onload = r; logoImg.onerror = r; });
          if (logoImg.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath(); ctx.arc(cx, cy, ls / 2, 0, Math.PI * 2); ctx.clip();
            ctx.drawImage(logoImg, cx - ls / 2, cy - ls / 2, ls, ls);
            ctx.restore();
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
    const cellMm = getQrMm() + PADDING_MM * 2;
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
          <p style={{ fontFamily: "var(--font-display)", fontSize: "0.88rem", color: "#999" }}>Genera gratis tu código QR para imprimir</p>
        </div>

        {/* QR Preview */}
        {finalQr && (
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ display: "inline-block", background: "white", borderRadius: 20, padding: 20, boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}>
              <img src={finalQr} alt="QR Preview" style={{ width: 180, height: 180 }} />
            </div>
            {restaurant.logoUrl && (
              <button onClick={() => setShowLogo(l => !l)} style={{
                marginTop: 12, display: "flex", alignItems: "center", gap: 8,
                padding: "8px 16px", borderRadius: 10, cursor: "pointer",
                marginLeft: "auto", marginRight: "auto",
                background: showLogo ? "#FFF4E0" : "white",
                border: showLogo ? "1.5px solid #F4A623" : "1px solid #eee",
                fontFamily: "var(--font-display)", fontSize: "0.78rem", fontWeight: 600,
                color: showLogo ? "#0e0e0e" : "#999",
                transition: "all 0.2s",
              }}>
                <img src={restaurant.logoUrl} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />
                {showLogo ? "Con logo ✓" : "Agregar logo"}
              </button>
            )}
            <p style={{ fontFamily: "var(--font-display)", fontSize: "0.68rem", color: "#bbb", marginTop: 10 }}>
              Este QR apunta a:
            </p>
            <a href={`${BASE_URL}/qr/${restaurant.slug}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--font-display)", fontSize: "0.78rem", color: "#F4A623", textDecoration: "none", wordBreak: "break-all", fontWeight: 600 }}>
              {BASE_URL}/qr/{restaurant.slug}
            </a>
          </div>
        )}

        {/* Size + Quantity (single step, no design selector) */}
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "0.82rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Tamaño del QR</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: size === "custom" ? 10 : 24, flexWrap: "wrap" }}>
          {(["small", "medium", "large", "custom"] as Size[]).map((s) => {
            const cfg = SIZE_CONFIG[s];
            return (
              <button key={s} onClick={() => setSize(s)} style={{
                flex: s === "custom" ? "1 1 100%" : 1, padding: "14px 8px", textAlign: "center",
                background: size === s ? "#FFF4E0" : "white",
                border: size === s ? "2px solid #F4A623" : "1px solid #eee",
                borderRadius: 14, cursor: "pointer",
              }}>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "0.88rem", color: "#0e0e0e", fontWeight: 600, margin: 0 }}>{cfg.label}</p>
                {s !== "custom" && <p style={{ fontFamily: "var(--font-display)", fontSize: "0.68rem", color: "#999", margin: "4px 0 0" }}>{cfg.qrMm / 10}×{cfg.qrMm / 10} cm</p>}
              </button>
            );
          })}
        </div>
        {size === "custom" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <input type="number" min={3} max={20} step={0.5} value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onBlur={() => { const n = Math.max(3, Math.min(20, parseFloat(customInput) || 7)); setCustomMm(Math.round(n * 10)); setCustomInput(String(n)); }}
              style={{ flex: 1, padding: "14px 16px", background: "white", border: "1px solid #eee", borderRadius: 12, fontSize: "1.1rem", color: "#0e0e0e", textAlign: "center", outline: "none", fontFamily: "var(--font-display)", boxSizing: "border-box" }}
            />
            <span style={{ fontFamily: "var(--font-display)", fontSize: "0.88rem", color: "#999" }}>cm</span>
          </div>
        )}

        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "0.82rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>¿Cuántos?</h2>
        <input type="number" min={1} max={50} value={quantityInput} onChange={(e) => setQuantityInput(e.target.value)} onBlur={() => { const n = Math.max(1, Math.min(50, parseInt(quantityInput) || 1)); setQuantity(n); setQuantityInput(String(n)); }}
          style={{ width: "100%", padding: "14px 16px", background: "white", border: "1px solid #eee", borderRadius: 12, fontSize: "1.1rem", color: "#0e0e0e", textAlign: "center", outline: "none", fontFamily: "var(--font-display)", boxSizing: "border-box" }}
        />
        <p style={{ fontFamily: "var(--font-display)", fontSize: "0.72rem", color: "#bbb", textAlign: "center", marginTop: 6 }}>
          {perPage} por hoja · {Math.ceil(quantity / perPage)} {Math.ceil(quantity / perPage) === 1 ? "página" : "páginas"} A4
        </p>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={generatePDF} disabled={generating} style={{ flex: 1, padding: 14, background: "#F4A623", color: "white", border: "none", borderRadius: 50, fontFamily: "var(--font-display)", fontSize: "0.88rem", fontWeight: 700, cursor: generating ? "wait" : "pointer", boxShadow: "0 4px 14px rgba(244,166,35,0.25)", opacity: generating ? 0.6 : 1 }}>
            {generating ? "Generando..." : "Imprimir PDF"}
          </button>
          <button onClick={downloadImage} disabled={!finalQr} style={{ flex: 1, padding: 14, background: "#F4A623", color: "white", border: "none", borderRadius: 50, fontFamily: "var(--font-display)", fontSize: "0.88rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(244,166,35,0.25)" }}>
            Generar imagen
          </button>
        </div>

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
