"use client";
import { useEffect, useState } from "react";
import { Bell, Send } from "lucide-react";
import { useSessionContext } from "@/lib/admin/SessionContext";

const F = "var(--font-display)";
const FB = "var(--font-body)";

export default function NotificacionesPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId || "";

  const [count, setCount] = useState<{ total: number; ios: number; android: number } | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    setCount(null);
    fetch(`/api/panel/ecommerce/app-push?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setCount({ total: d.count ?? 0, ios: d.ios ?? 0, android: d.android ?? 0 }); })
      .catch(() => {});
  }, [restaurantId]);

  async function enviar() {
    if (!title.trim() || !body.trim()) { setResult("Completa el título y el mensaje."); return; }
    if (!window.confirm(`¿Enviar esta notificación a ${count?.total ?? 0} dispositivo(s)?`)) return;
    setSending(true); setResult(null);
    try {
      const r = await fetch(`/api/panel/ecommerce/app-push`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, title: title.trim(), body: body.trim(), url: url.trim() || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setResult(d.error || "No se pudo enviar"); return; }
      setResult(`✓ Enviadas: ${d.sent} · Fallidas: ${d.failed}${d.invalid ? ` · Dados de baja: ${d.invalid}` : ""}`);
      setTitle(""); setBody(""); setUrl("");
    } catch { setResult("Error de conexión"); }
    finally { setSending(false); }
  }

  const card: React.CSSProperties = { background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: 20 };
  const label: React.CSSProperties = { display: "block", fontFamily: F, fontSize: "0.8rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 6 };
  const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "var(--adm-hover)", color: "var(--adm-text)", fontFamily: FB, fontSize: "0.9rem" };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px", display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Bell size={20} color="#6366f1" />
        </div>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Notificaciones</h1>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Envía promos a los clientes que tienen la app.</p>
        </div>
      </div>

      <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: FB, fontSize: "0.86rem", color: "var(--adm-text2)" }}>Dispositivos suscritos</span>
        <span style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 800, color: "var(--adm-text)" }}>
          {count ? `${count.total}` : "…"}
          {count && count.total > 0 && <span style={{ fontFamily: FB, fontSize: "0.72rem", fontWeight: 500, color: "var(--adm-text3)", marginLeft: 8 }}>({count.ios} iOS · {count.android} Android)</span>}
        </span>
      </div>

      <div style={{ ...card, display: "grid", gap: 14 }}>
        <div>
          <label style={label}>Título</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Ej. 🔥 2x1 en rolls solo hoy" style={input} />
        </div>
        <div>
          <label style={label}>Mensaje</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={180} rows={3} placeholder="Ej. Pide desde la app y aprovecha el 2x1 en toda la carta hasta las 23:00." style={{ ...input, resize: "vertical" }} />
        </div>
        <div>
          <label style={label}>Link al tocar <span style={{ fontWeight: 400, color: "var(--adm-text3)" }}>(opcional)</span></label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/  (inicio) o una ruta, ej. /checkout" style={input} />
          <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "6px 2px 0" }}>Al tocar la notificación, la app abre esa ruta. Vacío = abre el inicio.</p>
        </div>

        <button
          onClick={enviar}
          disabled={sending || !restaurantId || !title.trim() || !body.trim() || (count?.total ?? 0) === 0}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 12, border: "none", background: "#6366f1", color: "#fff", fontFamily: F, fontSize: "0.92rem", fontWeight: 800, cursor: sending ? "default" : "pointer", opacity: sending || (count?.total ?? 0) === 0 ? 0.55 : 1 }}
        >
          <Send size={16} /> {sending ? "Enviando…" : `Enviar a ${count?.total ?? 0} dispositivo(s)`}
        </button>
        {(count?.total ?? 0) === 0 && <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", textAlign: "center", margin: 0 }}>Aún no hay dispositivos suscritos. Se registran cuando los clientes abren la app con las notificaciones activadas.</p>}
        {result && <p style={{ fontFamily: F, fontSize: "0.86rem", fontWeight: 700, textAlign: "center", color: result.startsWith("✓") ? "var(--jade, #16a34a)" : "#ef4444", margin: 0 }}>{result}</p>}
      </div>
    </div>
  );
}
