"use client";
import { useEffect, useState } from "react";

const ORANGE = "#F5A01E";

export default function DescargarAppPage() {
  const [cfg, setCfg] = useState<{ apk_url: string; latest_version: string; release_notes: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/driver/app-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.config) setCfg(d.config); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hasApk = !!cfg?.apk_url;

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f5f7", fontFamily: "system-ui, -apple-system, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 24, padding: "32px 26px", boxShadow: "0 8px 40px rgba(0,0,0,0.08)", textAlign: "center" }}>
        <div style={{ width: 96, height: 96, borderRadius: 24, background: ORANGE, margin: "0 auto 18px", display: "grid", placeItems: "center", boxShadow: "0 6px 20px rgba(245,160,30,0.4)" }}>
          <span style={{ fontSize: 52 }}>🛵</span>
        </div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 900, color: "#111", margin: "0 0 4px" }}>QuieroComer Delivery</h1>
        <p style={{ fontSize: "0.9rem", color: "#666", margin: "0 0 22px" }}>App para repartidores</p>

        {loading ? (
          <p style={{ color: "#999" }}>Cargando…</p>
        ) : hasApk ? (
          <>
            <a href={cfg!.apk_url} download style={{ display: "block", padding: "16px", borderRadius: 14, background: ORANGE, color: "#fff", fontWeight: 800, fontSize: "1.05rem", textDecoration: "none", marginBottom: 12 }}>
              ⬇ Descargar app (Android)
            </a>
            {cfg!.latest_version && <p style={{ fontSize: "0.78rem", color: "#999", margin: "0 0 20px" }}>Versión {cfg!.latest_version}</p>}
            {cfg!.release_notes && <p style={{ fontSize: "0.82rem", color: "#555", margin: "0 0 20px", lineHeight: 1.5 }}>{cfg!.release_notes}</p>}

            <div style={{ textAlign: "left", background: "#faf7f0", borderRadius: 14, padding: "16px 18px", border: "1px solid #f0e6d2" }}>
              <p style={{ fontSize: "0.82rem", fontWeight: 800, color: "#111", margin: "0 0 8px" }}>Cómo instalar</p>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: "0.82rem", color: "#555", lineHeight: 1.6 }}>
                <li>Toca <strong>Descargar app</strong> y abre el archivo cuando termine.</li>
                <li>Si Android lo pide, permite <strong>“Instalar apps desconocidas”</strong> desde tu navegador.</li>
                <li>Instala y abre <strong>QuieroComer Delivery</strong>.</li>
                <li>Inicia sesión con el <strong>usuario y clave</strong> de tu local.</li>
              </ol>
            </div>
          </>
        ) : (
          <p style={{ color: "#999", fontSize: "0.9rem" }}>La app aún no está disponible para descargar. Vuelve pronto.</p>
        )}
      </div>
    </div>
  );
}
