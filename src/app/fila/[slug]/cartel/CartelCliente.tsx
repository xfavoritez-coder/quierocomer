"use client";

import { QRCodeCanvas } from "qrcode.react";
import { Printer } from "lucide-react";

export default function CartelCliente({ name, logoUrl, accent, url }: { name: string; logoUrl: string | null; accent: string; url: string }) {
  return (
    <div style={{ minHeight: "100dvh", background: "#eee", display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Arial" }}>
      <style>{`
        @media print {
          @page { margin: 0; }
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .cartel { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
        }
      `}</style>

      {/* Barra de acciones (no se imprime) */}
      <div className="no-print" style={{ width: "100%", maxWidth: 620, display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => window.print()} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 12, border: "none", background: accent, color: "#fff", fontSize: "0.95rem", fontWeight: 800, cursor: "pointer" }}>
          <Printer size={18} /> Imprimir cartel
        </button>
      </div>

      {/* Cartel A5-ish */}
      <div className="cartel" style={{ width: "100%", maxWidth: 620, background: "#fff", borderRadius: 24, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.12)" }}>
        {/* Cabecera con color de marca */}
        <div style={{ background: accent, color: "#fff", textAlign: "center", padding: "34px 24px 26px" }}>
          {logoUrl ? (
            <img src={logoUrl} alt={name} style={{ width: 84, height: 84, borderRadius: 20, objectFit: "cover", margin: "0 auto 14px", background: "#fff" }} />
          ) : null}
          <h1 style={{ fontSize: "2rem", fontWeight: 900, margin: 0, lineHeight: 1.1 }}>{name}</h1>
          <p style={{ fontSize: "1.05rem", fontWeight: 700, margin: "10px 0 0", opacity: 0.95 }}>📲 Toma tu turno sin esperar de pie</p>
        </div>

        {/* Cuerpo */}
        <div style={{ padding: "30px 28px 34px", textAlign: "center" }}>
          <p style={{ fontSize: "1.25rem", fontWeight: 800, color: "#111", margin: "0 0 6px" }}>Escanea y entra a nuestra fila virtual</p>
          <p style={{ fontSize: "0.98rem", color: "#555", margin: "0 0 22px", lineHeight: 1.5 }}>
            Regístrate con tu celular y <strong>relájate</strong>. Te avisaremos ahí mismo cuando se acerque tu turno. 🎉
          </p>

          {/* QR */}
          <div style={{ display: "inline-block", padding: 16, background: "#fff", border: `3px solid ${accent}`, borderRadius: 20 }}>
            <QRCodeCanvas value={url} size={260} level="H" includeMargin={false} fgColor="#111111" />
          </div>

          {/* Pasos */}
          <div style={{ display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap", margin: "26px 0 6px" }}>
            {[
              { n: "1", t: "Escanea el código" },
              { n: "2", t: "Pon tu nombre" },
              { n: "3", t: "¡Listo! Espera tu aviso" },
            ].map((s) => (
              <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", background: accent, color: "#fff", fontWeight: 900, fontSize: "0.85rem", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{s.n}</span>
                <span style={{ fontSize: "0.86rem", color: "#333", fontWeight: 600 }}>{s.t}</span>
              </div>
            ))}
          </div>

          <p style={{ fontSize: "0.82rem", color: "#9ca3af", margin: "20px 0 0", wordBreak: "break-all" }}>{url.replace(/^https?:\/\//, "")}</p>
        </div>
      </div>

      <p className="no-print" style={{ fontSize: "0.78rem", color: "#9ca3af", marginTop: 14, textAlign: "center" }}>
        Consejo: imprime en tamaño A5 o media carta. El QR apunta a tu fila virtual.
      </p>
    </div>
  );
}
