"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";

const F = "var(--font-display)";
const GOLD = "#F4A623";

/** Quita los puntos de un RUT dejando solo el guión: 12.345.678-9 → 12345678-9 */
function cleanRut(rut: string): string {
  return rut.replace(/\./g, "");
}

interface InvoiceInfo {
  id: string;
  pdfUrl: string | null;
  emittedAt: string;
  emailSentAt: string | null;
}

interface RestaurantRow {
  id: string;
  name: string;
  slug: string;
  billingRut: string | null;
  billingCompanyName: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  plan: string;
  amountNet: number;
  amountGross: number;
  invoice: InvoiceInfo | null;
}

const MONTHS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

function periodoLabel(p: string): string {
  const [year, month] = p.split("-");
  return `${MONTHS[parseInt(month, 10) - 1] ?? month} ${year}`;
}

function currentPeriodo(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function stepPeriodo(p: string, dir: 1 | -1): string {
  const [y, m] = p.split("-").map(Number);
  const d = new Date(y, m - 1 + dir);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmt(n: number): string {
  return `$${n.toLocaleString("es-CL")}`;
}

const PLAN_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  SILVER:  { text: "#94a3b8", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.3)" },
  GOLD:    { text: GOLD,      bg: "rgba(244,166,35,0.12)",  border: "rgba(244,166,35,0.3)" },
  PREMIUM: { text: "#c4b5fd", bg: "rgba(196,181,253,0.12)", border: "rgba(196,181,253,0.3)" },
};

function PlanBadge({ plan }: { plan: string }) {
  const c = PLAN_COLORS[plan] ?? { text: "#666", bg: "rgba(100,100,100,0.12)", border: "#333" };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "3px 8px",
      borderRadius: 20, background: c.bg, color: c.text,
      border: `1px solid ${c.border}`, letterSpacing: "0.04em",
      whiteSpace: "nowrap", fontFamily: F,
    }}>
      {plan}
    </span>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button
      onClick={copy}
      title="Copiar RUT"
      style={{
        marginLeft: 7, padding: "2px 8px", fontSize: 11,
        border: `1px solid ${copied ? "#4ade80" : "#333"}`,
        borderRadius: 6,
        background: copied ? "rgba(74,222,128,0.12)" : "#1a1a1a",
        color: copied ? "#4ade80" : "#666",
        cursor: "pointer", transition: "all 0.15s",
        fontWeight: copied ? 700 : 400,
      }}
    >
      {copied ? "✓" : "Copiar"}
    </button>
  );
}

export default function FacturasPage() {
  useAdminSession();

  const [periodo, setPeriodo] = useState(currentPeriodo());
  const [rows, setRows] = useState<RestaurantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);

  const load = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/facturas?periodo=${p}`);
      const data = await res.json();
      setRows(data.restaurants ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(periodo); }, [periodo, load]);

  const showToast = (msg: string, type: "ok" | "err") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  const triggerUpload = (restaurantId: string) => {
    uploadTargetRef.current = restaurantId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const restaurantId = uploadTargetRef.current;
    if (!file || !restaurantId) return;
    e.target.value = "";

    setUploading(restaurantId);
    try {
      const fd = new FormData();
      fd.append("restaurantId", restaurantId);
      fd.append("periodo", periodo);
      fd.append("file", file);

      const res = await fetch("/api/admin/facturas", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok || data.error) {
        showToast(data.error || "Error al subir", "err");
        return;
      }
      showToast(
        data.emailTo ? `Subida y enviada a ${data.emailTo}` : "Factura subida (dueño sin email)",
        "ok"
      );
      await load(periodo);
    } catch (err: any) {
      showToast(err?.message || "Error desconocido", "err");
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (invoiceId: string, restaurantName: string) => {
    if (!confirm(`¿Eliminar factura de "${restaurantName}"?`)) return;
    const res = await fetch(`/api/admin/facturas?invoiceId=${invoiceId}`, { method: "DELETE" });
    if (res.ok) { showToast("Eliminada", "ok"); load(periodo); }
    else showToast("Error al eliminar", "err");
  };

  const facturadas = rows.filter(r => r.invoice?.pdfUrl);
  const pendientes = rows.filter(r => !r.invoice?.pdfUrl);

  return (
    <div style={{ padding: "0 0 60px", color: "#fff" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          padding: "12px 20px", borderRadius: 10, fontWeight: 600, fontSize: 13,
          background: toast.type === "ok" ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)",
          color: toast.type === "ok" ? "#4ade80" : "#f87171",
          border: `1px solid ${toast.type === "ok" ? "rgba(74,222,128,0.4)" : "rgba(248,113,113,0.4)"}`,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          fontFamily: F,
        }}>
          {toast.type === "ok" ? "✓ " : "✕ "}{toast.msg}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: 28, fontWeight: 500, color: "#fff", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
            Facturación
          </h1>
          <p style={{ color: "#888", fontSize: 13, margin: 0 }}>
            Sube las facturas PDF a cada local activo
          </p>
        </div>

        {/* Period selector */}
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          background: "#1a1a1a", border: "1px solid #2a2a2a",
          borderRadius: 10, padding: "6px 10px",
        }}>
          <button
            onClick={() => setPeriodo(p => stepPeriodo(p, -1))}
            style={{ border: "none", background: "none", cursor: "pointer", color: "#888", fontSize: 18, padding: "0 6px", lineHeight: 1 }}
          >‹</button>
          <span style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: "#fff", minWidth: 150, textAlign: "center" }}>
            {periodoLabel(periodo)}
          </span>
          <button
            onClick={() => setPeriodo(p => stepPeriodo(p, 1))}
            disabled={periodo >= currentPeriodo()}
            style={{
              border: "none", background: "none",
              cursor: periodo >= currentPeriodo() ? "default" : "pointer",
              color: periodo >= currentPeriodo() ? "#333" : "#888",
              fontSize: 18, padding: "0 6px", lineHeight: 1,
            }}
          >›</button>
        </div>
      </div>

      {/* Stats */}
      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 24 }}>
          <StatCard label="Activos" value={rows.length} color="#fff" />
          <StatCard label="Facturados" value={facturadas.length} color="#4ade80" />
          <StatCard label="Pendientes" value={pendientes.length} color={GOLD} />
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: 80, color: "#555", fontFamily: F }}>
          Cargando…
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div style={{
          textAlign: "center", padding: 60, color: "#555", fontFamily: F, fontSize: 14,
          background: "#1a1a1a", borderRadius: 12, border: "1px solid #2a2a2a",
        }}>
          No hay locales activos en este período.
        </div>
      )}

      {/* PENDIENTES */}
      {!loading && pendientes.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: GOLD, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Pendientes
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 99,
              background: "rgba(244,166,35,0.15)", color: GOLD, border: "1px solid rgba(244,166,35,0.3)",
            }}>{pendientes.length}</span>
          </div>

          <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #2a2a2a" }}>
                  <TH>Local</TH>
                  <TH>RUT</TH>
                  <TH center>Plan</TH>
                  <TH right>Neto</TH>
                  <TH right>c/IVA</TH>
                  <TH center>Acción</TH>
                </tr>
              </thead>
              <tbody>
                {pendientes.map((r, i) => (
                  <tr
                    key={r.id}
                    style={{ borderBottom: i < pendientes.length - 1 ? "1px solid #222" : "none" }}
                  >
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ fontWeight: 600, color: "#fff", fontFamily: F }}>{r.name}</div>
                      {r.billingCompanyName && r.billingCompanyName !== r.name && (
                        <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{r.billingCompanyName}</div>
                      )}
                      {r.ownerEmail && (
                        <div style={{ fontSize: 11, color: "#555", marginTop: 1 }}>{r.ownerEmail}</div>
                      )}
                    </td>
                    <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }}>
                      {r.billingRut ? (
                        <span style={{ fontFamily: "monospace", fontSize: 13, color: "#ccc" }}>
                          {cleanRut(r.billingRut)}
                          <CopyBtn text={cleanRut(r.billingRut)} />
                        </span>
                      ) : (
                        <span style={{ color: "#444", fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "13px 16px", textAlign: "center" }}>
                      <PlanBadge plan={r.plan} />
                    </td>
                    <td style={{ padding: "13px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#ccc" }}>
                      {fmt(r.amountNet)}
                    </td>
                    <td style={{ padding: "13px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#666" }}>
                      {fmt(r.amountGross)}
                    </td>
                    <td style={{ padding: "13px 16px", textAlign: "center" }}>
                      <button
                        onClick={() => triggerUpload(r.id)}
                        disabled={uploading === r.id}
                        style={{
                          padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                          border: "none", background: uploading === r.id ? "#2a2a2a" : GOLD,
                          color: uploading === r.id ? "#666" : "#000",
                          cursor: uploading === r.id ? "default" : "pointer",
                          fontFamily: F, whiteSpace: "nowrap",
                          transition: "opacity 0.15s",
                        }}
                      >
                        {uploading === r.id ? "Subiendo…" : "↑ Subir PDF"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* FACTURADAS */}
      {!loading && facturadas.length > 0 && (
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: "#4ade80", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Facturadas
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 99,
              background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)",
            }}>{facturadas.length}</span>
          </div>

          <div style={{ background: "#1a1a1a", border: "1px solid #1e3a2a", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1e3a2a" }}>
                  <TH>Local</TH>
                  <TH>RUT</TH>
                  <TH center>Plan</TH>
                  <TH right>Neto</TH>
                  <TH right>c/IVA</TH>
                  <TH center>Estado</TH>
                </tr>
              </thead>
              <tbody>
                {facturadas.map((r, i) => (
                  <tr
                    key={r.id}
                    style={{ borderBottom: i < facturadas.length - 1 ? "1px solid #1a2e20" : "none", opacity: 0.7 }}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 600, color: "#4a7a5a", fontFamily: F, textDecoration: "line-through", textDecorationColor: "#2d5a3a" }}>
                        {r.name}
                      </div>
                      {r.ownerEmail && (
                        <div style={{ fontSize: 11, color: "#3a5a44", marginTop: 1 }}>{r.ownerEmail}</div>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                      {r.billingRut ? (
                        <span style={{ fontFamily: "monospace", fontSize: 13, color: "#4a7a5a" }}>
                          {r.billingRut}
                          <CopyBtn text={r.billingRut} />
                        </span>
                      ) : (
                        <span style={{ color: "#333", fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <PlanBadge plan={r.plan} />
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#4a7a5a" }}>
                      {fmt(r.amountNet)}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#3a5a44" }}>
                      {fmt(r.amountGross)}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 99,
                          background: "rgba(74,222,128,0.12)", color: "#4ade80",
                          border: "1px solid rgba(74,222,128,0.3)", fontFamily: F,
                        }}>
                          ✓ {r.invoice?.emailSentAt ? "Enviada" : "Subida"}
                        </span>
                        {r.invoice?.pdfUrl && (
                          <a
                            href={r.invoice.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: 11, color: "#666", padding: "3px 8px",
                              borderRadius: 99, border: "1px solid #2a2a2a",
                              textDecoration: "none", background: "#111",
                            }}
                          >
                            PDF
                          </a>
                        )}
                        <button
                          onClick={() => r.invoice && handleDelete(r.invoice.id, r.name)}
                          title="Eliminar"
                          style={{
                            border: "none", background: "none", cursor: "pointer",
                            color: "#333", fontSize: 16, padding: "0 2px", lineHeight: 1,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function TH({ children, center, right }: { children: React.ReactNode; center?: boolean; right?: boolean }) {
  return (
    <th style={{
      padding: "9px 16px", textAlign: center ? "center" : right ? "right" : "left",
      fontSize: 10, fontWeight: 700, color: "#555", letterSpacing: "0.07em",
      textTransform: "uppercase", background: "#161616", fontFamily: "var(--font-display)",
    }}>
      {children}
    </th>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: "#1a1a1a", border: "1px solid #2a2a2a",
      borderRadius: 12, padding: "14px 16px", textAlign: "center",
    }}>
      <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "var(--font-display)" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{label}</div>
    </div>
  );
}
