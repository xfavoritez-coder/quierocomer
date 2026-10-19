"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";

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
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function periodoLabel(p: string): string {
  const [year, month] = p.split("-");
  return `${MONTHS[parseInt(month, 10) - 1]} ${year}`;
}

function currentPeriodo(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function prevPeriodo(p: string): string {
  const [y, m] = p.split("-").map(Number);
  const d = new Date(y, m - 2);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextPeriodo(p: string): string {
  const [y, m] = p.split("-").map(Number);
  const d = new Date(y, m);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmt(n: number): string {
  return `$${n.toLocaleString("es-CL")}`;
}

const PLAN_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  SILVER:  { text: "#475569", bg: "#F1F5F9", border: "#94a3b8" },
  GOLD:    { text: "#92400e", bg: "#FFF8E7", border: "#F4A623" },
  PREMIUM: { text: "#6d28d9", bg: "#F3E8FF", border: "#c4b5fd" },
};

function PlanBadge({ plan }: { plan: string }) {
  const c = PLAN_COLORS[plan] ?? { text: "#888", bg: "#f4f4f4", border: "#ddd" };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 8px",
      borderRadius: 20, background: c.bg, color: c.text,
      border: `1px solid ${c.border}`, letterSpacing: "0.02em",
      whiteSpace: "nowrap",
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
        marginLeft: 6, padding: "2px 7px", fontSize: 11,
        border: "1px solid #ddd", borderRadius: 6,
        background: copied ? "#e6f4ea" : "#f9f9f9",
        color: copied ? "#2d6a4f" : "#666",
        cursor: "pointer", transition: "all 0.15s",
        fontWeight: copied ? 600 : 400,
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
  const [uploading, setUploading] = useState<string | null>(null); // restaurantId uploading
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
    setTimeout(() => setToast(null), 4000);
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
        data.emailTo
          ? `Factura subida y enviada a ${data.emailTo}`
          : "Factura subida (sin email de dueño)",
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
    if (res.ok) {
      showToast("Factura eliminada", "ok");
      load(periodo);
    } else {
      showToast("Error al eliminar", "err");
    }
  };

  const facturadas = rows.filter(r => r.invoice?.pdfUrl);
  const pendientes = rows.filter(r => !r.invoice?.pdfUrl);
  const total = rows.length;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f5f2", padding: "32px 24px" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          padding: "12px 20px", borderRadius: 10, fontWeight: 500, fontSize: 14,
          background: toast.type === "ok" ? "#e6f4ea" : "#fdecea",
          color: toast.type === "ok" ? "#1e4d2b" : "#7f1d1d",
          border: `1px solid ${toast.type === "ok" ? "#a3d9b1" : "#f5c6cb"}`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          transition: "all 0.2s",
        }}>
          {toast.type === "ok" ? "✓ " : "✕ "}{toast.msg}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Header */}
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#1a1a1a" }}>
              Facturación
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#888" }}>
              Sube las facturas PDF a cada local activo
            </p>
          </div>
        </div>

        {/* Period selector */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          marginBottom: 24, background: "#fff",
          border: "1px solid #e8e2d9", borderRadius: 12,
          padding: "12px 16px", width: "fit-content",
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}>
          <button
            onClick={() => setPeriodo(prevPeriodo(periodo))}
            style={{ border: "none", background: "none", cursor: "pointer", fontSize: 18, color: "#888", padding: "0 4px" }}
          >
            ‹
          </button>
          <span style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a", minWidth: 160, textAlign: "center" }}>
            {periodoLabel(periodo)}
          </span>
          <button
            onClick={() => setPeriodo(nextPeriodo(periodo))}
            disabled={periodo >= currentPeriodo()}
            style={{
              border: "none", background: "none", cursor: periodo >= currentPeriodo() ? "default" : "pointer",
              fontSize: 18, color: periodo >= currentPeriodo() ? "#ddd" : "#888", padding: "0 4px",
            }}
          >
            ›
          </button>
        </div>

        {/* Stats */}
        {!loading && (
          <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
            <StatPill label="Activos" value={total} color="#888" />
            <StatPill label="Facturados" value={facturadas.length} color="#2d6a4f" bg="#e6f4ea" border="#a3d9b1" />
            <StatPill label="Pendientes" value={pendientes.length} color="#92400e" bg="#FFF8E7" border="#F4A623" />
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: 60, color: "#aaa", fontSize: 15 }}>
            Cargando...
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div style={{
            textAlign: "center", padding: 60, color: "#aaa", fontSize: 15,
            background: "#fff", borderRadius: 12, border: "1px solid #e8e2d9",
          }}>
            No hay locales activos para este período.
          </div>
        )}

        {/* PENDIENTES */}
        {!loading && pendientes.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#92400e", letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 10px" }}>
              Pendientes ({pendientes.length})
            </h2>
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8e2d9", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #f0ede8" }}>
                    <Th>Local</Th>
                    <Th>RUT</Th>
                    <Th center>Plan</Th>
                    <Th right>Neto</Th>
                    <Th right>Total c/IVA</Th>
                    <Th center>Acción</Th>
                  </tr>
                </thead>
                <tbody>
                  {pendientes.map((r, i) => (
                    <tr
                      key={r.id}
                      style={{ borderBottom: i < pendientes.length - 1 ? "1px solid #f7f5f2" : "none" }}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600, color: "#1a1a1a" }}>{r.name}</div>
                        {r.billingCompanyName && r.billingCompanyName !== r.name && (
                          <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>{r.billingCompanyName}</div>
                        )}
                        {r.ownerEmail && (
                          <div style={{ fontSize: 12, color: "#bbb", marginTop: 1 }}>{r.ownerEmail}</div>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        {r.billingRut ? (
                          <span style={{ fontFamily: "monospace", fontSize: 13 }}>
                            {r.billingRut}
                            <CopyBtn text={r.billingRut} />
                          </span>
                        ) : (
                          <span style={{ color: "#ddd", fontSize: 12 }}>Sin RUT</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <PlanBadge plan={r.plan} />
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {fmt(r.amountNet)}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#666" }}>
                        {fmt(r.amountGross)}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <button
                          onClick={() => triggerUpload(r.id)}
                          disabled={uploading === r.id}
                          style={{
                            padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                            border: "1px solid #e8930a", background: uploading === r.id ? "#f9f0e3" : "#e8930a",
                            color: uploading === r.id ? "#c47a2a" : "#fff",
                            cursor: uploading === r.id ? "default" : "pointer",
                            transition: "all 0.15s", whiteSpace: "nowrap",
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
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#2d6a4f", letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 10px" }}>
              Facturadas ({facturadas.length})
            </h2>
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #d4edda", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #edf7f0" }}>
                    <Th>Local</Th>
                    <Th>RUT</Th>
                    <Th center>Plan</Th>
                    <Th right>Neto</Th>
                    <Th right>Total c/IVA</Th>
                    <Th center>Factura</Th>
                  </tr>
                </thead>
                <tbody>
                  {facturadas.map((r, i) => (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom: i < facturadas.length - 1 ? "1px solid #f0faf4" : "none",
                        opacity: 0.75,
                      }}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600, color: "#4b7a5e", textDecoration: "line-through", textDecorationColor: "#a3d9b1" }}>
                          {r.name}
                        </div>
                        {r.billingCompanyName && r.billingCompanyName !== r.name && (
                          <div style={{ fontSize: 12, color: "#bbb", marginTop: 2 }}>{r.billingCompanyName}</div>
                        )}
                        {r.ownerEmail && (
                          <div style={{ fontSize: 12, color: "#bbb", marginTop: 1 }}>{r.ownerEmail}</div>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        {r.billingRut ? (
                          <span style={{ fontFamily: "monospace", fontSize: 13, color: "#7a9e8a" }}>
                            {r.billingRut}
                            <CopyBtn text={r.billingRut} />
                          </span>
                        ) : (
                          <span style={{ color: "#ddd", fontSize: 12 }}>Sin RUT</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <PlanBadge plan={r.plan} />
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#7a9e8a" }}>
                        {fmt(r.amountNet)}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#aaa" }}>
                        {fmt(r.amountGross)}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            fontSize: 12, fontWeight: 600, color: "#2d6a4f",
                            padding: "3px 8px", borderRadius: 20,
                            background: "#e6f4ea", border: "1px solid #a3d9b1",
                          }}>
                            ✓ {r.invoice?.emailSentAt ? "Enviada" : "Subida"}
                          </span>
                          {r.invoice?.pdfUrl && (
                            <a
                              href={r.invoice.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: 12, color: "#666", padding: "3px 8px",
                                borderRadius: 20, border: "1px solid #e0e0e0",
                                textDecoration: "none", background: "#f9f9f9",
                              }}
                            >
                              Ver PDF
                            </a>
                          )}
                          <button
                            onClick={() => r.invoice && handleDelete(r.invoice.id, r.name)}
                            title="Eliminar factura"
                            style={{
                              border: "none", background: "none", cursor: "pointer",
                              color: "#ccc", fontSize: 15, padding: "0 2px",
                              lineHeight: 1,
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
    </div>
  );
}

function Th({ children, center, right }: { children: React.ReactNode; center?: boolean; right?: boolean }) {
  return (
    <th style={{
      padding: "10px 16px", textAlign: center ? "center" : right ? "right" : "left",
      fontSize: 11, fontWeight: 700, color: "#aaa", letterSpacing: "0.05em",
      textTransform: "uppercase", background: "#fafaf8",
    }}>
      {children}
    </th>
  );
}

function StatPill({
  label, value, color = "#555", bg = "#f4f4f4", border = "#e0e0e0",
}: {
  label: string; value: number; color?: string; bg?: string; border?: string;
}) {
  return (
    <div style={{
      padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600,
      background: bg, color, border: `1px solid ${border}`,
      display: "flex", alignItems: "center", gap: 6,
    }}>
      <span style={{ fontSize: 18, fontWeight: 700 }}>{value}</span>
      <span style={{ fontWeight: 500 }}>{label}</span>
    </div>
  );
}
