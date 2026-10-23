"use client";

import { useState } from "react";

export default function FilaForm({ slug, name, logoUrl, accent, enabled }: { slug: string; name: string; logoUrl: string | null; accent: string; enabled: boolean }) {
  const [fName, setFName] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fParty, setFParty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ number: number; when?: string; already?: boolean } | null>(null);

  const submit = async () => {
    setErr(null);
    if (!fName.trim() || fPhone.replace(/\D/g, "").length < 8) { setErr("Ingresa tu nombre y un teléfono válido."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/queue/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, name: fName.trim(), phone: fPhone.trim(), partySize: Number(fParty) || 1 }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error || "No se pudo registrar"); setBusy(false); return; }
      setDone({ number: d.number, when: d.when, already: d.already });
    } catch { setErr("Error de conexión"); }
    setBusy(false);
  };

  const wrap: React.CSSProperties = { minHeight: "100dvh", background: "#f6f6f6", display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Arial" };
  const card: React.CSSProperties = { width: "100%", maxWidth: 420, background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 10px 40px rgba(0,0,0,0.06)" };
  const input: React.CSSProperties = { width: "100%", padding: "13px 14px", background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 12, fontSize: "1rem", outline: "none", boxSizing: "border-box", color: "#111" };

  return (
    <div style={wrap}>
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        {logoUrl ? <img src={logoUrl} alt={name} style={{ width: 72, height: 72, borderRadius: 18, objectFit: "cover", margin: "0 auto 10px" }} /> : null}
        <h1 style={{ fontSize: "1.4rem", fontWeight: 900, color: "#111", margin: 0 }}>{name}</h1>
        <p style={{ fontSize: "0.9rem", color: "#6b7280", margin: "4px 0 0" }}>Fila virtual de espera</p>
      </div>

      <div style={card}>
        {!enabled ? (
          <p style={{ textAlign: "center", color: "#6b7280", fontSize: "0.95rem", margin: "12px 0" }}>La fila virtual no está disponible en este momento. Acércate al local para tomar tu turno.</p>
        ) : done ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 28 }}>🎫</div>
            <p style={{ fontSize: "1rem", color: "#111", fontWeight: 700, margin: "0 0 4px" }}>{done.already ? "Ya estabas en la fila" : "¡Registrado!"}</p>
            <p style={{ fontSize: "0.9rem", color: "#6b7280", margin: "0 0 14px" }}>Tu número de turno es</p>
            <div style={{ fontSize: "3rem", fontWeight: 900, color: accent, lineHeight: 1 }}>{done.number}</div>
            {done.when && <p style={{ fontSize: "0.82rem", color: "#9ca3af", margin: "10px 0 0" }}>Registro: {done.when}</p>}
            <p style={{ fontSize: "0.86rem", color: "#6b7280", margin: "16px 0 0", lineHeight: 1.5 }}>Mantente cerca. El personal te avisará cuando se aproxime tu turno.</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Tu nombre" style={input} />
              <input value={fPhone} onChange={(e) => setFPhone(e.target.value)} placeholder="Tu teléfono (+56 9 …)" inputMode="tel" style={input} />
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
