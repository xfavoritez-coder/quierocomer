"use client";

import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";

interface Props {
  restaurant: { id: string; slug: string; name: string; logoUrl: string | null };
}

type Design = "minimal" | "marca" | "completo";
type Size = "small" | "medium" | "large";

const SIZE_CONFIG: Record<Size, { label: string; desc: string; cm: number; mm: number }> = {
  small: { label: "Pequeño", desc: "5×5 cm — para pegar en la mesa", cm: 5, mm: 50 },
  medium: { label: "Mediano", desc: "8×8 cm — tent card de mesa", cm: 8, mm: 80 },
  large: { label: "Grande", desc: "12×12 cm — para pared o vitrina", cm: 12, mm: 120 },
};

const BASE_URL = "https://quierocomer.cl";

export default function QRPageClient({ restaurant }: Props) {
  const [step, setStep] = useState(1);
  const [design, setDesign] = useState<Design>("marca");
  const [size, setSize] = useState<Size>("medium");
  const [quantity, setQuantity] = useState(4);
  const [quantityInput, setQuantityInput] = useState("4");
  const [generating, setGenerating] = useState(false);
  const [qrPreview, setQrPreview] = useState<string>("");
  const [qrWithLogo, setQrWithLogo] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
          logoImg.src = restaurant.logoUrl;
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

  const finalQr = restaurant.logoUrl && design !== "minimal" ? qrWithLogo || qrPreview : qrPreview;

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const cfg = SIZE_CONFIG[size];
      const u = cfg.mm;
      const pageW = 210, pageH = 297, margin = 10;
      const cols = Math.floor((pageW - margin * 2) / u);
      const rows = Math.floor((pageH - margin * 2) / u);
      const perPage = cols * rows;
      const pages = Math.ceil(quantity / perPage);

      // Generate high-res QR
      const qrHi = await QRCode.toDataURL(qrUrl, { width: 1200, margin: 1, errorCorrectionLevel: "H", color: { dark: "#0e0e0e", light: "#ffffff" } });

      // QR with logo for non-minimal
      let qrFinal = qrHi;
      if (restaurant.logoUrl && design !== "minimal") {
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
            const x = margin + c * u;
            const y = margin + r * u;

            // Cut lines
            pdf.setDrawColor(200); pdf.setLineDashPattern([2, 2], 0); pdf.rect(x, y, u, u);

            if (design === "minimal") {
              const qs = u * 0.82;
              pdf.addImage(qrFinal, "PNG", x + (u - qs) / 2, y + (u - qs) / 2, qs, qs);
            } else if (design === "marca") {
              const pad = u * 0.06;
              let ty = y + pad + 1;
              // Name
              pdf.setFontSize(u * 0.09); pdf.setFont("helvetica", "bold"); pdf.setTextColor(14, 14, 14);
              pdf.text(restaurant.name, x + u / 2, ty + 3, { align: "center" });
              ty += 5;
              // QR with logo
              const qs = u * 0.65;
              pdf.addImage(qrFinal, "PNG", x + (u - qs) / 2, ty, qs, qs);
              ty += qs + 1;
              // Text
              pdf.setFontSize(u * 0.06); pdf.setFont("helvetica", "normal"); pdf.setTextColor(120, 120, 120);
              pdf.text("Escanea para ver nuestra carta", x + u / 2, ty + 2, { align: "center" });
            } else {
              // Completo
              const pad = u * 0.05;
              const ix = x + pad, iy = y + pad, iw = u - pad * 2, ih = u - pad * 2;
              pdf.setDrawColor(244, 166, 35); pdf.setLineDashPattern([], 0); pdf.setLineWidth(0.5);
              pdf.roundedRect(ix, iy, iw, ih, 2, 2);
              let ty = iy + 3;
              pdf.setFontSize(u * 0.08); pdf.setFont("helvetica", "bold"); pdf.setTextColor(14, 14, 14);
              pdf.text(restaurant.name, x + u / 2, ty + 3, { align: "center" });
              ty += 5;
              const qs = u * 0.58;
              pdf.addImage(qrFinal, "PNG", x + (u - qs) / 2, ty, qs, qs);
              ty += qs + 1;
              pdf.setFontSize(u * 0.055); pdf.setFont("helvetica", "normal"); pdf.setTextColor(100, 100, 100);
              pdf.text("Escanea y descubre qué pedir 🧞", x + u / 2, ty + 2, { align: "center" });
            }
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
    return Math.floor((210 - 20) / cfg.mm) * Math.floor((297 - 20) / cfg.mm);
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
          </div>
        )}

        {/* Step 1: Design */}
        {step === 1 && (
          <>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "0.82rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Elige un diseño</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {([
                { value: "minimal" as Design, label: "Solo QR", desc: "Limpio, sin texto" },
                { value: "marca" as Design, label: "Con marca", desc: "Nombre + QR + texto" },
              ]).map((d) => (
                <button key={d.value} onClick={() => setDesign(d.value)} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
                  background: design === d.value ? "#FFF4E0" : "white",
                  border: design === d.value ? "2px solid #F4A623" : "1px solid #eee",
                  borderRadius: 14, cursor: "pointer", textAlign: "left",
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: design === d.value ? "#F4A623" : "#ddd", flexShrink: 0 }} />
                  <div>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: "0.92rem", color: "#0e0e0e", fontWeight: 600, margin: 0 }}>{d.label}</p>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: "0.78rem", color: "#999", margin: "2px 0 0" }}>{d.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(2)} style={{ width: "100%", marginTop: 20, padding: 14, background: "#F4A623", color: "white", border: "none", borderRadius: 50, fontFamily: "var(--font-display)", fontSize: "0.95rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(244,166,35,0.25)" }}>
              Siguiente →
            </button>
          </>
        )}

        {/* Step 2: Size + Quantity */}
        {step === 2 && (
          <>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "0.82rem", color: "#999", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Tamaño</h2>
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
                    <p style={{ fontFamily: "var(--font-display)", fontSize: "0.68rem", color: "#999", margin: "4px 0 0" }}>{cfg.desc.split("—")[0]}</p>
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

            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button onClick={() => setStep(1)} style={{ padding: "14px 20px", background: "white", border: "1px solid #eee", borderRadius: 50, color: "#999", fontFamily: "var(--font-display)", fontSize: "0.88rem", cursor: "pointer" }}>← Atrás</button>
              <button onClick={generatePDF} disabled={generating} style={{ flex: 1, padding: 14, background: "#F4A623", color: "white", border: "none", borderRadius: 50, fontFamily: "var(--font-display)", fontSize: "0.95rem", fontWeight: 700, cursor: generating ? "wait" : "pointer", boxShadow: "0 4px 14px rgba(244,166,35,0.25)", opacity: generating ? 0.6 : 1 }}>
                {generating ? "Generando..." : "Descargar PDF"}
              </button>
            </div>
          </>
        )}

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
