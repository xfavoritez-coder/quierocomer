"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Botón para eliminar el local (con confirmación). */
export default function DeleteLead({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const del = async () => {
    if (!window.confirm(`¿Eliminar "${name}"? Se borra el local, su carta de demo y su historial. No se puede deshacer.`)) return;
    setBusy(true); setErr(null);
    const r = await fetch(`/api/ventas/leads/${id}`, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setBusy(false); setErr(d.error || "No se pudo eliminar"); return; }
    router.push("/ventas");
    router.refresh();
  };
  return (
    <div style={{ textAlign: "center" }}>
      <button onClick={del} disabled={busy} style={{ background: "none", border: "none", color: "#dc2626", font: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", padding: 8 }}>
        {busy ? "Eliminando…" : "Eliminar este local"}
      </button>
      {err && <p style={{ color: "#dc2626", fontSize: 13, margin: "4px 0 0" }}>{err}</p>}
    </div>
  );
}
