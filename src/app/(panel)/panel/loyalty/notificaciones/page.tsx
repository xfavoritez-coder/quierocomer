"use client";

import { useState, useEffect, useCallback } from "react";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import { toast } from "sonner";
import { CreditCard, Bell, Send } from "lucide-react";
import LoyaltyNav from "../LoyaltyNav";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  boxSizing: "border-box",
  background: "var(--adm-card)",
  border: "1px solid var(--adm-card-border)",
  borderRadius: 8,
  color: "var(--adm-text)",
  fontFamily: FB,
  fontSize: "0.88rem",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: F,
  fontSize: "0.78rem",
  fontWeight: 600,
  color: "var(--adm-text2)",
  marginBottom: 6,
};

interface Broadcast {
  id: string;
  title: string;
  body: string;
  recipients: number;
  createdAt: string;
}

export default function LoyaltyNotifyPage() {
  const { selectedRestaurantId, loading } = usePanelSession();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [history, setHistory] = useState<Broadcast[]>([]);

  const loadHistory = useCallback(() => {
    if (!selectedRestaurantId) return;
    fetch(`/api/loyalty/notify?restaurantId=${selectedRestaurantId}`)
      .then((r) => r.json())
      .then((d) => setHistory(d.history || []))
      .catch(() => {});
  }, [selectedRestaurantId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const send = async () => {
    if (!selectedRestaurantId || !body.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/loyalty/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: selectedRestaurantId, title, body }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error");
      toast.success(`📣 Notificación enviada · ${d.appleDevices} iPhone${d.google ? " + Android" : ""}`);
      setTitle("");
      setBody("");
      setConfirm(false);
      loadHistory();
    } catch (e: any) {
      toast.error(e.message || "Error al enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ maxWidth: 620 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
          <CreditCard size={20} color="var(--adm-text3)" /> Fidelidad
        </h1>
        <p style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
          Envía una notificación push a todas las tarjetas de tus clientes (iPhone y Android).
        </p>
      </div>

      <LoyaltyNav />

      {loading ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", fontSize: "0.85rem" }}>Cargando…</p>
      ) : (
        <>
          {/* Redactar */}
          <div style={{ padding: 16, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12 }}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Título <span style={{ color: "var(--adm-text3)", fontWeight: 400 }}>(opcional)</span></label>
              <input type="text" value={title} maxLength={80} onChange={(e) => { setTitle(e.target.value); setConfirm(false); }} placeholder="Ej: ¡Promo del finde!" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Mensaje</label>
              <textarea value={body} maxLength={300} rows={3} onChange={(e) => { setBody(e.target.value); setConfirm(false); }} placeholder="Ej: Este sábado 2x1 en hand rolls. ¡Te esperamos!" style={{ ...inputStyle, resize: "none" }} />
              <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "6px 0 0", textAlign: "right" }}>{body.length}/300</p>
            </div>

            {/* Vista previa de la notificación */}
            {body.trim() && (
              <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Bell size={16} color={GOLD} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  {title.trim() && <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>{title}</p>}
                  <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: "1px 0 0", lineHeight: 1.4 }}>{body}</p>
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, gap: 10, alignItems: "center" }}>
              {confirm ? (
                <>
                  <span style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text3)" }}>¿Enviar a todos?</span>
                  <button type="button" onClick={() => setConfirm(false)} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "var(--adm-card)", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
                  <button type="button" onClick={send} disabled={sending} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", opacity: sending ? 0.6 : 1 }}>
                    {sending ? "Enviando…" : "Sí, enviar"}
                  </button>
                </>
              ) : (
                <button type="button" disabled={!body.trim()} onClick={() => setConfirm(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 8, border: `1.5px solid ${GOLD}`, background: GOLD, color: "#1a1a1a", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: body.trim() ? "pointer" : "not-allowed", opacity: body.trim() ? 1 : 0.5 }}>
                  <Send size={16} /> Enviar notificación
                </button>
              )}
            </div>
          </div>

          {/* Historial */}
          {history.length > 0 && (
            <div style={{ marginTop: 26 }}>
              <p style={{ fontFamily: F, fontSize: "0.8rem", fontWeight: 700, color: "var(--adm-text2)", margin: "0 0 10px" }}>Enviadas</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {history.map((b) => (
                  <li key={b.id} style={{ padding: 12, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 10 }}>
                    {b.title && <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>{b.title}</p>}
                    <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: "1px 0 0", lineHeight: 1.4 }}>{b.body}</p>
                    <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "6px 0 0" }}>
                      {new Date(b.createdAt).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {b.recipients} destinatario{b.recipients !== 1 ? "s" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
