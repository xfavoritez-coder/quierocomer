"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";

const F = "var(--font-display)";

type Row = { variant: string; eventType: string; count: number };

function rate(num: number, den: number) {
  if (!den) return "—";
  return `${((num / den) * 100).toFixed(1)}%`;
}

function VariantCard({ variant, rows, color }: { variant: string; rows: Row[]; color: string }) {
  const get = (evt: string) => rows.find(r => r.variant === variant && r.eventType === evt)?.count ?? 0;
  const impressions = get("impression");
  const clicks = get("click");
  const leads = get("lead");

  return (
    <div style={{ background: "#1A1A1A", border: `1px solid ${color}33`, borderRadius: 16, padding: "24px 28px", flex: 1, minWidth: 260 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <span style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 800, color, letterSpacing: "-.02em" }}>
          Variante {variant}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", background: `${color}22`, color, borderRadius: 6, padding: "2px 8px" }}>
          {variant === "A" ? "Título actual" : "Tu restaurante puede vender más"}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {[
          { label: "Impresiones", value: impressions.toLocaleString("es-CL"), sub: "" },
          { label: "Clicks CTA", value: clicks.toLocaleString("es-CL"), sub: `CTR ${rate(clicks, impressions)}` },
          { label: "Leads", value: leads.toLocaleString("es-CL"), sub: `Conv. ${rate(leads, impressions)}` },
        ].map(({ label, value, sub }) => (
          <div key={label} style={{ background: "#111", borderRadius: 10, padding: "14px 16px" }}>
            <p style={{ fontFamily: F, fontSize: "1.5rem", fontWeight: 800, color: "#fff", margin: "0 0 2px" }}>{value}</p>
            <p style={{ fontFamily: F, fontSize: "0.7rem", color: "#666", margin: 0 }}>{label}</p>
            {sub && <p style={{ fontFamily: F, fontSize: "0.68rem", color, margin: "4px 0 0" }}>{sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AbTestPage() {
  const { isSuper } = useAdminSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/ab", { credentials: "include" })
      .then(r => r.json())
      .then(data => { setRows(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (!isSuper) return null;

  const totalImpressions = rows.filter(r => r.eventType === "impression").reduce((s, r) => s + r.count, 0);
  const totalClicks = rows.filter(r => r.eventType === "click").reduce((s, r) => s + r.count, 0);

  return (
    <div style={{ padding: "32px 28px", fontFamily: "Inter, sans-serif", color: "#fff", maxWidth: 900 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-.03em", margin: "0 0 6px" }}>
          A/B Test — Hero Landing
        </h1>
        <p style={{ color: "#666", fontSize: 14, margin: 0 }}>
          Variante A = título actual · Variante B = "Tu restaurante puede vender más"
        </p>
      </div>

      {loading ? (
        <p style={{ color: "#555" }}>Cargando…</p>
      ) : (
        <>
          {/* Resumen global */}
          <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
            {[
              { label: "Total impresiones", value: totalImpressions.toLocaleString("es-CL") },
              { label: "Total clicks CTA", value: totalClicks.toLocaleString("es-CL") },
              { label: "CTR global", value: rate(totalClicks, totalImpressions) },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: "#161616", border: "1px solid #2A2A2A", borderRadius: 12, padding: "14px 20px", flex: 1 }}>
                <p style={{ fontFamily: F, fontSize: "1.4rem", fontWeight: 700, color: "#F4A623", margin: "0 0 4px" }}>{value}</p>
                <p style={{ fontFamily: F, fontSize: "0.72rem", color: "#555", margin: 0 }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Cards por variante */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <VariantCard variant="A" rows={rows} color="#60A5FA" />
            <VariantCard variant="B" rows={rows} color="#F4A623" />
          </div>

          {/* Winner badge */}
          {(() => {
            const aClicks = rows.find(r => r.variant === "A" && r.eventType === "click")?.count ?? 0;
            const bClicks = rows.find(r => r.variant === "B" && r.eventType === "click")?.count ?? 0;
            const aImpr = rows.find(r => r.variant === "A" && r.eventType === "impression")?.count ?? 1;
            const bImpr = rows.find(r => r.variant === "B" && r.eventType === "impression")?.count ?? 1;
            const aCTR = aClicks / aImpr;
            const bCTR = bClicks / bImpr;
            if (!aClicks && !bClicks) return null;
            const winner = aCTR >= bCTR ? "A" : "B";
            const diff = Math.abs(aCTR - bCTR);
            const pct = bImpr + aImpr > 40 && diff > 0.01;
            return (
              <div style={{ marginTop: 24, background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 20 }}>🏆</span>
                <div>
                  <p style={{ fontFamily: F, fontWeight: 700, fontSize: "0.95rem", margin: "0 0 2px" }}>
                    Variante {winner} lidera {pct ? `(+${(diff * 100).toFixed(1)} pp de CTR)` : "(datos aún insuficientes)"}
                  </p>
                  <p style={{ fontFamily: F, fontSize: "0.72rem", color: "#555", margin: 0 }}>
                    Se recomienda significancia estadística con al menos 200 impresiones por variante.
                  </p>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
