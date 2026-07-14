"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { QrCode, ArrowLeft, Download, Printer, Copy, Check } from "lucide-react";
import Link from "next/link";
import SkeletonLoading from "@/components/admin/SkeletonLoading";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";
const BASE_URL = "https://quierocomer.com";

const PADDING_MM = 5;
type Size = "small" | "medium" | "large" | "custom";
const SIZE_CONFIG: Record<Exclude<Size, "custom">, { label: string; qrMm: number }> = {
  small:  { label: "5×5 cm", qrMm: 50 },
  medium: { label: "8×8 cm", qrMm: 80 },
  large:  { label: "12×12 cm", qrMm: 120 },
};

export default function PanelQRPage() {
  const { restaurants, selectedRestaurantId, loading } = useAdminSession();
  const [qrPreview, setQrPreview] = useState("");
  const [qrWithLogo, setQrWithLogo] = useState("");
  const [showLogo, setShowLogo] = useState(true);
  const [size, setSize] = useState<Size>("medium");
  const [customSizeCm, setCustomSizeCm] = useState(10);
  const [customSizeInput, setCustomSizeInput] = useState("10");
  const [quantity, setQuantity] = useState(4);
  const [quantityInput, setQuantityInput] = useState("4");
  const [generating, setGenerating] = useState(false);
  const [generatingImg, setGeneratingImg] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  const restaurant = restaurants.find(r => r.id === selectedRestaurantId);
  const slug = restaurant?.slug || "";
  const logoUrl = (restaurant as any)?.logoUrl || null;
  const qrUrl = `${BASE_URL}/qr/${slug}`;

  // Generate QR on mount
  useEffect(() => {
    if (!slug) return;
    async function gen() {
      const plain = await QRCode.toDataURL(qrUrl, { width: 600, margin: 1, errorCorrectionLevel: "H", color: { dark: "#0e0e0e", light: "#ffffff" } });
      setQrPreview(plain);

      if (logoUrl) {
        const canvas = document.createElement("canvas");
        canvas.width = 600; canvas.height = 600;
        const ctx = canvas.getContext("2d")!;
        const qrImg = new Image(); qrImg.crossOrigin = "anonymous"; qrImg.src = plain;
        await new Promise(r => (qrImg.onload = r));
        ctx.drawImage(qrImg, 0, 0, 600, 600);
        const ls = 120, cx = 300, cy = 300;
        ctx.beginPath(); ctx.arc(cx, cy, ls / 2 + 12, 0, Math.PI * 2); ctx.fillStyle = "white"; ctx.fill();
        try {
          const logoImg = new Image(); logoImg.crossOrigin = "anonymous";
          logoImg.src = logoUrl.includes("supabase.co") ? logoUrl : `/api/proxy-image?url=${encodeURIComponent(logoUrl)}`;
          await new Promise(r => { logoImg.onload = r; logoImg.onerror = r; });
          if (logoImg.naturalWidth > 0) {
            ctx.beginPath(); ctx.arc(cx, cy, ls / 2, 0, Math.PI * 2); ctx.clip();
            ctx.drawImage(logoImg, cx - ls / 2, cy - ls / 2, ls, ls);
          }
        } catch {}
        setQrWithLogo(canvas.toDataURL("image/png"));
      }
    }
    gen();
  }, [qrUrl, logoUrl, slug]);

  const finalQr = showLogo && logoUrl ? qrWithLogo || qrPreview : qrPreview;
  const qrMm = size === "custom" ? customSizeCm * 10 : SIZE_CONFIG[size].qrMm;
  const sizeLabel = size === "custom" ? `${customSizeCm}×${customSizeCm} cm` : SIZE_CONFIG[size].label;

  const downloadImage = async () => {
    if (!finalQr || generatingImg) return;
    setGeneratingImg(true);
    try {
      const pxPerMm = 4;
      const padding = PADDING_MM * pxPerMm;
      const qrPx = qrMm * pxPerMm;
      const cellPx = qrPx + padding * 2;
      const cols = Math.min(quantity, Math.max(1, Math.floor(Math.sqrt(quantity))));
      const rows = Math.ceil(quantity / cols);
      const canvas = document.createElement("canvas");
      canvas.width = cols * cellPx; canvas.height = rows * cellPx;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const qrImg = new Image(); qrImg.src = finalQr;
      await new Promise(r => (qrImg.onload = r));
      let placed = 0;
      for (let row = 0; row < rows && placed < quantity; row++) {
        for (let col = 0; col < cols && placed < quantity; col++) {
          ctx.drawImage(qrImg, col * cellPx + padding, row * cellPx + padding, qrPx, qrPx);
          ctx.setLineDash([4, 4]); ctx.strokeStyle = "#ccc"; ctx.lineWidth = 1;
          ctx.strokeRect(col * cellPx, row * cellPx, cellPx, cellPx);
          placed++;
        }
      }
      setPreviewDataUrl(canvas.toDataURL("image/png"));
    } catch (e) { console.error("Image error:", e); }
    setGeneratingImg(false);
  };

  const generatePDF = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const cellMm = qrMm + PADDING_MM * 2;
      const pageW = 210, pageH = 297, margin = 10;
      const cols = Math.floor((pageW - margin * 2) / cellMm);
      const rows = Math.floor((pageH - margin * 2) / cellMm);
      const perPage = cols * rows;
      const pages = Math.ceil(quantity / perPage);
      const qrHi = await QRCode.toDataURL(qrUrl, { width: 1200, margin: 1, errorCorrectionLevel: "H", color: { dark: "#0e0e0e", light: "#ffffff" } });
      let qrFinal = qrHi;
      if (showLogo && logoUrl) {
        const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 1200;
        const ctx = canvas.getContext("2d")!;
        const qrImg = new Image(); qrImg.src = qrHi;
        await new Promise(r => (qrImg.onload = r));
        ctx.drawImage(qrImg, 0, 0, 1200, 1200);
        const ls = 240, cx = 600, cy = 600;
        ctx.beginPath(); ctx.arc(cx, cy, ls / 2 + 24, 0, Math.PI * 2); ctx.fillStyle = "white"; ctx.fill();
        try {
          const logoImg = new Image(); logoImg.crossOrigin = "anonymous";
          logoImg.src = logoUrl.includes("supabase.co") ? logoUrl : `/api/proxy-image?url=${encodeURIComponent(logoUrl)}`;
          await new Promise(r => { logoImg.onload = r; logoImg.onerror = r; });
          if (logoImg.naturalWidth > 0) {
            ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, ls / 2, 0, Math.PI * 2); ctx.clip();
            ctx.drawImage(logoImg, cx - ls / 2, cy - ls / 2, ls, ls); ctx.restore();
          }
        } catch {}
        qrFinal = canvas.toDataURL("image/png");
      }
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      let placed = 0;
      for (let p = 0; p < pages; p++) {
        if (p > 0) pdf.addPage();
        for (let row = 0; row < rows && placed < quantity; row++) {
          for (let col = 0; col < cols && placed < quantity; col++) {
            const x = margin + col * cellMm, y = margin + row * cellMm;
            pdf.setDrawColor(200); pdf.setLineDashPattern([2, 2], 0); pdf.setLineWidth(0.3);
            pdf.rect(x, y, cellMm, cellMm);
            pdf.addImage(qrFinal, "PNG", x + PADDING_MM, y + PADDING_MM, qrMm, qrMm);
            placed++;
          }
        }
      }
      pdf.save(`QR-${slug}.pdf`);
    } catch (e) { console.error("PDF error:", e); }
    setGenerating(false);
  };

  const cellMm = qrMm + PADDING_MM * 2;
  const perPage = Math.floor((210 - 20) / cellMm) * Math.floor((297 - 20) / cellMm);

  const copyLink = () => {
    navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <SkeletonLoading type="form" />;
  if (!restaurant) return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "var(--adm-text2)", fontFamily: F }}>Selecciona un restaurant</p></div>;

  return (
    <div style={{ maxWidth: 480 }}>
      <Link href="/panel" style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontFamily: F, fontSize: "0.85rem", fontWeight: 600,
        color: "var(--adm-text3)", textDecoration: "none", marginBottom: 12,
      }}>
        <ArrowLeft size={16} /> Volver
      </Link>
      <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
        <QrCode size={20} color="var(--adm-text3)" /> Mi código QR
      </h1>
      <p style={{ fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text2)", margin: "0 0 24px" }}>
        Tus clientes escanean este código y ven tu carta digital
      </p>

      {/* QR Preview — visible de inmediato */}
      <div style={{
        background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
        borderRadius: 24, padding: "28px 20px", textAlign: "center", marginBottom: 16,
      }}>
        {finalQr ? (
          <div style={{ display: "inline-block", background: "white", borderRadius: 20, padding: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.06)", marginBottom: 16 }}>
            <img src={finalQr} alt="Tu código QR" style={{ width: 200, height: 200, display: "block" }} />
          </div>
        ) : (
          <div style={{ width: 200, height: 200, margin: "0 auto 16px", background: "var(--adm-input)", borderRadius: 20, display: "grid", placeItems: "center" }}>
            <span style={{ color: "var(--adm-text3)", fontSize: 13 }}>Generando...</span>
          </div>
        )}

        {/* Logo toggle */}
        {logoUrl && (
          <button onClick={() => setShowLogo(l => !l)} style={{
            display: "flex", alignItems: "center", gap: 8, margin: "0 auto 16px",
            padding: "8px 16px", borderRadius: 10, cursor: "pointer",
            background: showLogo ? "rgba(244,166,35,0.1)" : "var(--adm-input)",
            border: showLogo ? `1.5px solid ${GOLD}` : "1px solid var(--adm-input-border)",
            fontFamily: F, fontSize: "0.78rem", fontWeight: 600,
            color: showLogo ? GOLD : "var(--adm-text3)",
          }}>
            <img src={logoUrl} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />
            {showLogo ? "Con logo ✓" : "Agregar logo"}
          </button>
        )}

        {/* Link de la carta */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <a href={qrUrl} target="_blank" rel="noopener noreferrer" style={{
            fontFamily: FB, fontSize: "0.78rem", color: GOLD, textDecoration: "none", fontWeight: 600,
          }}>
            {qrUrl.replace("https://", "")}
          </a>
          <button onClick={copyLink} style={{
            background: "none", border: "none", cursor: "pointer", padding: 4,
            color: copied ? "#4ade80" : "var(--adm-text3)",
          }}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {/* Opciones de impresión */}
      <div style={{
        background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
        borderRadius: 24, padding: "20px", marginBottom: 16,
      }}>
        <h3 style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 7 }}>
          <Printer size={16} color="var(--adm-text3)" /> Imprimir
        </h3>

        {/* Tamaño */}
        <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: ".06em" }}>Tamaño</p>
        <div style={{ display: "flex", gap: 6, marginBottom: size === "custom" ? 8 : 14 }}>
          {(["small", "medium", "large"] as Exclude<Size, "custom">[]).map(s => {
            const active = size === s;
            return (
              <button key={s} onClick={() => setSize(s)} style={{
                flex: 1, padding: "10px 6px", textAlign: "center", borderRadius: 10, cursor: "pointer",
                background: active ? "rgba(244,166,35,0.1)" : "var(--adm-input)",
                border: active ? `1.5px solid ${GOLD}` : "1px solid var(--adm-input-border)",
                fontFamily: F, fontSize: "0.78rem", fontWeight: active ? 700 : 500,
                color: active ? GOLD : "var(--adm-text2)",
              }}>
                {SIZE_CONFIG[s].label}
              </button>
            );
          })}
          <button onClick={() => setSize("custom")} style={{
            flex: 1, padding: "10px 6px", textAlign: "center", borderRadius: 10, cursor: "pointer",
            background: size === "custom" ? "rgba(244,166,35,0.1)" : "var(--adm-input)",
            border: size === "custom" ? `1.5px solid ${GOLD}` : "1px solid var(--adm-input-border)",
            fontFamily: F, fontSize: "0.78rem", fontWeight: size === "custom" ? 700 : 500,
            color: size === "custom" ? GOLD : "var(--adm-text2)",
          }}>
            Otro
          </button>
        </div>
        {size === "custom" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <input
              type="number" min={3} max={100} value={customSizeInput}
              onChange={e => setCustomSizeInput(e.target.value)}
              onBlur={() => {
                const n = Math.max(3, Math.min(100, parseInt(customSizeInput) || 10));
                setCustomSizeCm(n);
                setCustomSizeInput(String(n));
              }}
              style={{
                width: 80, height: 36, textAlign: "center", borderRadius: 10,
                border: `1.5px solid ${GOLD}`, background: "var(--adm-input)",
                fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)", outline: "none",
              }}
            />
            <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)" }}>cm × {customSizeCm} cm</span>
          </div>
        )}

        {/* Cantidad */}
        <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: ".06em" }}>Cantidad</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <button onClick={() => { const n = Math.max(1, quantity - 1); setQuantity(n); setQuantityInput(String(n)); }} style={{
            width: 36, height: 36, borderRadius: 10, border: "1px solid var(--adm-input-border)",
            background: "var(--adm-input)", color: "var(--adm-text)", fontSize: 18, cursor: "pointer", display: "grid", placeItems: "center",
          }}>−</button>
          <input type="number" min={1} max={50} value={quantityInput}
            onChange={e => setQuantityInput(e.target.value)}
            onBlur={() => { const n = Math.max(1, Math.min(50, parseInt(quantityInput) || 1)); setQuantity(n); setQuantityInput(String(n)); }}
            style={{
              width: 60, height: 36, textAlign: "center", borderRadius: 10,
              border: "1px solid var(--adm-input-border)", background: "var(--adm-input)",
              fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)", outline: "none",
            }}
          />
          <button onClick={() => { const n = Math.min(50, quantity + 1); setQuantity(n); setQuantityInput(String(n)); }} style={{
            width: 36, height: 36, borderRadius: 10, border: "1px solid var(--adm-input-border)",
            background: "var(--adm-input)", color: "var(--adm-text)", fontSize: 18, cursor: "pointer", display: "grid", placeItems: "center",
          }}>+</button>
          <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>
            {perPage}/hoja · {Math.ceil(quantity / perPage)} {Math.ceil(quantity / perPage) === 1 ? "pág" : "págs"}
          </span>
        </div>

        {/* Botones */}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={generatePDF} disabled={generating} style={{
            flex: 1, padding: "12px 14px", borderRadius: 12, border: "none", cursor: generating ? "wait" : "pointer",
            background: GOLD, color: "#0a0a0a", fontFamily: F, fontSize: "0.85rem", fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            opacity: generating ? 0.6 : 1,
          }}>
            <Printer size={16} />
            {generating ? "Generando..." : "PDF"}
          </button>
          <button onClick={downloadImage} disabled={!finalQr || generatingImg} style={{
            flex: 1, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--adm-card-border)",
            cursor: generatingImg ? "wait" : "pointer",
            background: "var(--adm-input)", color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            opacity: generatingImg ? 0.6 : 1,
          }}>
            <Download size={16} />
            {generatingImg ? "Generando..." : "Imagen"}
          </button>
        </div>
      </div>

      {/* Preview modal — muestra la imagen generada con opción de descargar */}
      {previewDataUrl && (
        <div onClick={() => setPreviewDataUrl(null)} style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,.85)", backdropFilter: "blur(6px)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--adm-card)", borderRadius: 24, padding: "24px 20px",
            maxWidth: 400, width: "100%", textAlign: "center",
            border: "1px solid var(--adm-card-border)",
          }}>
            <img src={previewDataUrl} alt="QR generado" style={{
              maxWidth: "100%", maxHeight: "50vh", borderRadius: 12,
              boxShadow: "0 4px 20px rgba(0,0,0,0.1)", marginBottom: 16, background: "white",
            }} />
            <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", margin: "0 0 16px" }}>
              {quantity} código{quantity > 1 ? "s" : ""} QR · {sizeLabel}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <a href={previewDataUrl} download={`QR-${slug}-x${quantity}.png`} style={{
                flex: 1, padding: "12px 14px", borderRadius: 12, textDecoration: "none",
                background: GOLD, color: "#0a0a0a", fontFamily: F, fontSize: "0.85rem", fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                <Download size={16} /> Descargar
              </a>
              <button onClick={() => setPreviewDataUrl(null)} style={{
                flex: 1, padding: "12px 14px", borderRadius: 12,
                background: "var(--adm-input)", color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", fontWeight: 700,
                border: "1px solid var(--adm-card-border)", cursor: "pointer",
              }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
