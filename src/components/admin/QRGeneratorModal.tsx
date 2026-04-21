"use client";

import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";

interface Props {
  restaurant: { id: string; slug: string; name: string; logoUrl: string | null };
  onClose: () => void;
}

type Design = "minimal" | "marca" | "completo";
type Size = "small" | "medium" | "large";

const SIZE_CONFIG: Record<Size, { label: string; cmLabel: string; cm: number; mmPerUnit: number }> = {
  small: { label: "Pequeño", cmLabel: "5×5 cm", cm: 5, mmPerUnit: 50 },
  medium: { label: "Mediano", cmLabel: "8×8 cm", cm: 8, mmPerUnit: 80 },
  large: { label: "Grande", cmLabel: "12×12 cm", cm: 12, mmPerUnit: 120 },
};

const F = "var(--font-display)";
const BASE_URL = "https://quierocomer.cl";

export default function QRGeneratorModal({ restaurant, onClose }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [design, setDesign] = useState<Design>("marca");
  const [size, setSize] = useState<Size>("medium");
  const [quantity, setQuantity] = useState(4);
  const [generating, setGenerating] = useState(false);
  const [previews, setPreviews] = useState<Record<Design, string>>({} as any);

  const qrUrl = `${BASE_URL}/qr/${restaurant.slug}`;

  // Generate preview QR codes
  useEffect(() => {
    async function gen() {
      const qr = await QRCode.toDataURL(qrUrl, { width: 300, margin: 1, color: { dark: "#0e0e0e", light: "#ffffff" } });
      setPreviews({ minimal: qr, marca: qr, completo: qr });
    }
    gen();
  }, [qrUrl]);

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const cfg = SIZE_CONFIG[size];
      const unitMm = cfg.mmPerUnit;
      const pageW = 210; // A4
      const pageH = 297;
      const margin = 10;
      const cols = Math.floor((pageW - margin * 2) / unitMm);
      const rows = Math.floor((pageH - margin * 2) / unitMm);
      const perPage = cols * rows;
      const pages = Math.ceil(quantity / perPage);

      const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 600, margin: 1, color: { dark: "#0e0e0e", light: "#ffffff" } });

      // Load logo if available
      let logoDataUrl: string | null = null;
      if (restaurant.logoUrl && design !== "minimal") {
        try {
          const resp = await fetch(restaurant.logoUrl);
          const blob = await resp.blob();
          logoDataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch { /* skip logo */ }
      }

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      let placed = 0;

      for (let p = 0; p < pages; p++) {
        if (p > 0) pdf.addPage();

        for (let r = 0; r < rows && placed < quantity; r++) {
          for (let c = 0; c < cols && placed < quantity; c++) {
            const x = margin + c * unitMm;
            const y = margin + r * unitMm;

            // Cut lines (dashed)
            pdf.setDrawColor(200);
            pdf.setLineDashPattern([2, 2], 0);
            pdf.rect(x, y, unitMm, unitMm);

            if (design === "minimal") {
              // Just the QR centered
              const qrSize = unitMm * 0.8;
              const qrX = x + (unitMm - qrSize) / 2;
              const qrY = y + (unitMm - qrSize) / 2;
              pdf.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
            } else if (design === "marca") {
              // Logo + name + QR + text
              const padding = unitMm * 0.08;
              const contentX = x + padding;
              const contentW = unitMm - padding * 2;

              // Logo + name at top
              let topY = y + padding + 2;
              if (logoDataUrl) {
                const logoSize = unitMm * 0.12;
                pdf.addImage(logoDataUrl, "PNG", contentX + (contentW - logoSize) / 2, topY, logoSize, logoSize);
                topY += logoSize + 1;
              }
              pdf.setFontSize(unitMm * 0.1);
              pdf.setFont("helvetica", "bold");
              pdf.setTextColor(14, 14, 14);
              pdf.text(restaurant.name, x + unitMm / 2, topY + 2, { align: "center" });
              topY += 4;

              // QR
              const qrSize = unitMm * 0.55;
              pdf.addImage(qrDataUrl, "PNG", x + (unitMm - qrSize) / 2, topY, qrSize, qrSize);
              topY += qrSize + 1;

              // Bottom text
              pdf.setFontSize(unitMm * 0.065);
              pdf.setFont("helvetica", "normal");
              pdf.setTextColor(120, 120, 120);
              pdf.text("Escanea para ver nuestra carta", x + unitMm / 2, topY + 1, { align: "center" });
            } else {
              // Completo: logo + name + QR + genio text + border
              const padding = unitMm * 0.06;
              const innerX = x + padding;
              const innerY = y + padding;
              const innerW = unitMm - padding * 2;
              const innerH = unitMm - padding * 2;

              // Decorative border
              pdf.setDrawColor(244, 166, 35);
              pdf.setLineDashPattern([], 0);
              pdf.setLineWidth(0.5);
              pdf.roundedRect(innerX, innerY, innerW, innerH, 2, 2);

              let topY = innerY + 3;

              // Logo + name
              if (logoDataUrl) {
                const logoSize = unitMm * 0.11;
                pdf.addImage(logoDataUrl, "PNG", innerX + (innerW - logoSize) / 2, topY, logoSize, logoSize);
                topY += logoSize + 1;
              }
              pdf.setFontSize(unitMm * 0.09);
              pdf.setFont("helvetica", "bold");
              pdf.setTextColor(14, 14, 14);
              pdf.text(restaurant.name, x + unitMm / 2, topY + 2, { align: "center" });
              topY += 4;

              // QR
              const qrSize = unitMm * 0.48;
              pdf.addImage(qrDataUrl, "PNG", x + (unitMm - qrSize) / 2, topY, qrSize, qrSize);
              topY += qrSize + 1;

              // Genio text
              pdf.setFontSize(unitMm * 0.06);
              pdf.setFont("helvetica", "normal");
              pdf.setTextColor(100, 100, 100);
              pdf.text("Escanea y descubre qué pedir", x + unitMm / 2, topY + 1, { align: "center" });
            }

            placed++;
          }
        }
      }

      pdf.save(`QR-${restaurant.slug}-${design}-${size}-x${quantity}.pdf`);
    } catch (e) {
      console.error("PDF generation error:", e);
    }
    setGenerating(false);
  };

  return (
    <div className="fixed flex items-center justify-center" style={{ inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)" }}>
      <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 20, padding: 28, maxWidth: 420, width: "90%", maxHeight: "85vh", overflowY: "auto", position: "relative", scrollbarWidth: "none" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: "#666", fontSize: "1.1rem", cursor: "pointer" }}>✕</button>

        <h2 style={{ fontFamily: F, fontSize: "1.1rem", color: "#F4A623", margin: "0 0 4px" }}>Generar QR</h2>
        <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#888", margin: "0 0 20px" }}>{restaurant.name} · {qrUrl}</p>

        {/* Step 1: Design */}
        {step === 1 && (
          <>
            <p style={{ fontFamily: F, fontSize: "0.72rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Elige un diseño</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {([
                { value: "minimal" as Design, label: "Minimal", desc: "Solo el código QR" },
                { value: "marca" as Design, label: "Con marca", desc: "Logo + nombre + QR" },
                { value: "completo" as Design, label: "Completo", desc: "Logo + nombre + QR + texto + borde" },
              ]).map((d) => (
                <button key={d.value} onClick={() => setDesign(d.value)} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                  background: design === d.value ? "rgba(244,166,35,0.1)" : "rgba(255,255,255,0.03)",
                  border: design === d.value ? "1.5px solid rgba(244,166,35,0.4)" : "1px solid #2A2A2A",
                  borderRadius: 12, cursor: "pointer", textAlign: "left",
                }}>
                  {previews[d.value] && (
                    <div style={{ width: 48, height: 48, borderRadius: 6, background: "white", display: "flex", alignItems: "center", justifyContent: "center", padding: 4, flexShrink: 0 }}>
                      <img src={previews[d.value]} alt="" style={{ width: "100%", height: "100%" }} />
                    </div>
                  )}
                  <div>
                    <p style={{ fontFamily: F, fontSize: "0.88rem", color: design === d.value ? "#F4A623" : "white", fontWeight: 600, margin: 0 }}>{d.label}</p>
                    <p style={{ fontFamily: F, fontSize: "0.72rem", color: "#888", margin: "2px 0 0" }}>{d.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(2)} style={{ width: "100%", marginTop: 16, padding: 12, background: "#F4A623", color: "#0a0a0a", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.88rem", fontWeight: 700, cursor: "pointer" }}>Siguiente →</button>
          </>
        )}

        {/* Step 2: Size */}
        {step === 2 && (
          <>
            <p style={{ fontFamily: F, fontSize: "0.72rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Elige el tamaño</p>
            <div style={{ display: "flex", gap: 8 }}>
              {(["small", "medium", "large"] as Size[]).map((s) => {
                const cfg = SIZE_CONFIG[s];
                return (
                  <button key={s} onClick={() => setSize(s)} style={{
                    flex: 1, padding: "16px 10px", textAlign: "center",
                    background: size === s ? "rgba(244,166,35,0.1)" : "rgba(255,255,255,0.03)",
                    border: size === s ? "1.5px solid rgba(244,166,35,0.4)" : "1px solid #2A2A2A",
                    borderRadius: 12, cursor: "pointer",
                  }}>
                    <p style={{ fontFamily: F, fontSize: "0.88rem", color: size === s ? "#F4A623" : "white", fontWeight: 600, margin: 0 }}>{cfg.label}</p>
                    <p style={{ fontFamily: F, fontSize: "0.72rem", color: "#888", margin: "4px 0 0" }}>{cfg.cmLabel}</p>
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 16 }}>
              <p style={{ fontFamily: F, fontSize: "0.72rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>¿Cuántos QR?</p>
              <input type="number" min={1} max={50} value={quantity} onChange={(e) => setQuantity(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                style={{ width: "100%", padding: "12px 16px", background: "#111", border: "1px solid #2A2A2A", borderRadius: 8, color: "white", fontFamily: F, fontSize: "1rem", textAlign: "center", outline: "none", boxSizing: "border-box" }}
              />
              <p style={{ fontFamily: F, fontSize: "0.68rem", color: "#666", marginTop: 6, textAlign: "center" }}>
                {(() => {
                  const cfg = SIZE_CONFIG[size];
                  const cols = Math.floor((210 - 20) / cfg.mmPerUnit);
                  const rows = Math.floor((297 - 20) / cfg.mmPerUnit);
                  const perPage = cols * rows;
                  const pages = Math.ceil(quantity / perPage);
                  return `${perPage} por hoja · ${pages} ${pages === 1 ? "página" : "páginas"} A4`;
                })()}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => setStep(1)} style={{ padding: "12px 16px", background: "none", border: "1px solid #2A2A2A", borderRadius: 8, color: "#888", fontFamily: F, fontSize: "0.82rem", cursor: "pointer" }}>← Atrás</button>
              <button onClick={generatePDF} disabled={generating} style={{ flex: 1, padding: 12, background: "#F4A623", color: "#0a0a0a", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.88rem", fontWeight: 700, cursor: generating ? "wait" : "pointer", opacity: generating ? 0.6 : 1 }}>
                {generating ? "Generando..." : "Descargar PDF"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
