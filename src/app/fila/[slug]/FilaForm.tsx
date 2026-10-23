"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Status = "WAITING" | "NEAR" | "CALLED" | "DONE" | "CANCELLED";

export default function FilaForm({ slug, name, logoUrl, accent, enabled, phoneRequired = true }: { slug: string; name: string; logoUrl: string | null; accent: string; enabled: boolean; phoneRequired?: boolean }) {
  const [fName, setFName] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fParty, setFParty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Registro activo del cliente (persiste en el teléfono).
  const storeKey = `qc_fila_${slug}`;
  const [entryId, setEntryId] = useState<string | null>(null);
  const [live, setLive] = useState<{ status: Status; position: number } | null>(null);
  const prevStatus = useRef<Status | null>(null);

  // Recupera el registro guardado al abrir.
  useEffect(() => {
    try { const s = localStorage.getItem(storeKey); if (s) setEntryId(s); } catch {}
  }, [storeKey]);

  const poll = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/queue/status?id=${id}`);
      if (res.status === 404) { try { localStorage.removeItem(storeKey); } catch {}; setEntryId(null); setLive(null); return; }
      const d = await res.json();
      setLive({ status: d.status, position: d.position ?? 0 });
      // Aviso háptico al pasar a "ya es tu turno".
      if (prevStatus.current && prevStatus.current !== "CALLED" && d.status === "CALLED") {
        try { navigator.vibrate?.([200, 100, 200]); } catch {}
      }
      prevStatus.current = d.status;
    } catch {}
  }, [storeKey]);

  useEffect(() => {
    if (!entryId) return;
    poll(entryId);
    const t = setInterval(() => poll(entryId), 8000);
    const onVis = () => { if (document.visibilityState === "visible") poll(entryId); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [entryId, poll]);

  const submit = async () => {
    setErr(null);
    if (!fName.trim()) { setErr("Ingresa tu nombre."); return; }
    if (phoneRequired && fPhone.replace(/\D/g, "").length < 8) { setErr("Ingresa un teléfono válido."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/queue/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, name: fName.trim(), phone: fPhone.trim(), partySize: Number(fParty) || 1 }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error || "No se pudo registrar"); setBusy(false); return; }
      if (d.id) { try { localStorage.setItem(storeKey, d.id); } catch {}; setEntryId(d.id); }
    } catch { setErr("Error de conexión"); }
    setBusy(false);
  };

  const reset = () => { try { localStorage.removeItem(storeKey); } catch {}; setEntryId(null); setLive(null); prevStatus.current = null; setFName(""); setFPhone(""); setFParty("1"); };

  const wrap: React.CSSProperties = { minHeight: "100dvh", background: "#f6f6f6", display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Arial" };
  const card: React.CSSProperties = { width: "100%", maxWidth: 420, background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 10px 40px rgba(0,0,0,0.06)" };
  const input: React.CSSProperties = { width: "100%", padding: "13px 14px", background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 12, fontSize: "1rem", outline: "none", boxSizing: "border-box", color: "#111" };

  // Mensajes por estado. El número grande es la POSICIÓN en la fila (cuántos
  // faltan contándote); baja a 1 y luego pasa a "es tu turno" / atendido.
  const view = (() => {
    if (!live) return null;
    const p = live.position;
    const next = p <= 1;
    switch (live.status) {
      case "WAITING":
      case "NEAR":
        return {
          emoji: next ? "🙌" : "🎫",
          tone: next ? "#2563eb" : "#6b7280",
          big: p,
          bigLabel: next ? "¡Eres el siguiente!" : "faltan por atender (contándote)",
          title: next ? "Prepárate" : (live.status === "NEAR" ? "Tu turno está próximo" : "Estás en la fila"),
          body: next
            ? "Eres el próximo. Mantente atento a tu teléfono, te llamaremos en cualquier momento."
            : "A medida que atienden a los de adelante, tu número va bajando. Te avisaremos cuando sea tu turno.",
        };
      case "CALLED":
        return { emoji: "🔔", tone: "#16a34a", title: "¡Ya es tu turno!", body: "Por favor, dirígete al punto de atención para ser atendido. ¡Gracias por tu espera!" };
      case "DONE":
        return { emoji: "✅", tone: "#6b7280", title: "¡Gracias!", body: "Fuiste atendido. ¡Que lo disfrutes!", final: true };
      case "CANCELLED":
        return { emoji: "⚠️", tone: "#dc2626", title: "Registro cancelado", body: "Tu turno fue cancelado. Si fue un error, vuelve a registrarte o acércate al local.", final: true };
    }
  })();

  return (
    <div style={wrap}>
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        {logoUrl ? <img src={logoUrl} alt={name} style={{ width: 72, height: 72, borderRadius: 18, objectFit: "cover", margin: "0 auto 10px" }} /> : null}
        <h1 style={{ fontSize: "1.4rem", fontWeight: 900, color: "#111", margin: 0 }}>{name}</h1>
        <p style={{ fontSize: "0.9rem", color: "#6b7280", margin: "4px 0 0" }}>Fila virtual de espera</p>
      </div>

      <div style={card}>
        {entryId && view ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: live!.status === "CALLED" ? `${view.tone}1f` : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 34 }}>{view.emoji}</div>
            <p style={{ fontSize: "1.15rem", color: view.tone, fontWeight: 900, margin: "0 0 2px" }}>{view.title}</p>
            {typeof view.big === "number" && (
              <>
                <div style={{ fontSize: "3.6rem", fontWeight: 900, color: accent, lineHeight: 1.05, margin: "8px 0 0" }}>{view.big}</div>
                <p style={{ fontSize: "0.78rem", color: "#9ca3af", fontWeight: 700, margin: "2px 0 0", textTransform: "uppercase", letterSpacing: ".03em" }}>{view.bigLabel}</p>
              </>
            )}
            <p style={{ fontSize: "0.9rem", color: "#4b5563", margin: "14px 0 0", lineHeight: 1.55 }}>{view.body}</p>
            {view.final && (
              <button onClick={reset} style={{ width: "100%", marginTop: 18, padding: "13px", borderRadius: 12, border: `1px solid ${accent}`, background: "transparent", color: accent, fontSize: "0.95rem", fontWeight: 800, cursor: "pointer" }}>Registrarme de nuevo</button>
            )}
            {!view.final && <p style={{ fontSize: "0.72rem", color: "#9ca3af", margin: "16px 0 0" }}>Se actualiza solo · mantén esta pantalla abierta</p>}
          </div>
        ) : !enabled ? (
          <p style={{ textAlign: "center", color: "#6b7280", fontSize: "0.95rem", margin: "12px 0" }}>La fila virtual no está disponible en este momento. Acércate al local para tomar tu turno.</p>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Tu nombre" style={input} />
              <input value={fPhone} onChange={(e) => setFPhone(e.target.value)} placeholder={phoneRequired ? "Tu teléfono (+56 9 …)" : "Tu teléfono (opcional)"} inputMode="tel" style={input} />
              <div>
                <label style={{ fontSize: "0.8rem", color: "#6b7280", display: "block", marginBottom: 6 }}>¿Cuántas personas?</label>
                <input value={fParty} onChange={(e) => setFParty(e.target.value.replace(/\D/g, ""))} inputMode="numeric" style={input} />
              </div>
            </div>
            {err && <p style={{ color: "#dc2626", fontSize: "0.82rem", margin: "10px 0 0" }}>{err}</p>}
            <button onClick={submit} disabled={busy} style={{ width: "100%", marginTop: 16, padding: "14px", borderRadius: 12, border: "none", background: accent, color: "#fff", fontSize: "1rem", fontWeight: 800, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}>
              {busy ? "Registrando…" : "Entrar a la fila"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
