"use client";
import { useState, useRef } from "react";
import { Upload, Link, Camera, X, Loader2 } from "lucide-react";

const F = "var(--font-display)";

interface Props {
  restaurantId: string;
  onClose: () => void;
  onDone: (result: { dishes: number; categories: number }) => void;
}

type Mode = "link" | "photo";

export default function ImportMenuModal({ restaurantId, onClose, onDone }: Props) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    setLoading(true);
    setError("");
    setProgress("Extrayendo platos de tu carta...");

    try {
      let res: Response;

      if (mode === "link") {
        if (!url.trim()) { setError("Pega el link de tu carta"); setLoading(false); return; }
        res = await fetch("/api/admin/import-menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId, cartaUrl: url.trim() }),
        });
      } else {
        if (!files.length) { setError("Selecciona un archivo"); setLoading(false); return; }

        // Upload each photo individually to avoid body size limits
        const urls: string[] = [];
        for (let i = 0; i < files.length; i++) {
          setProgress(`Subiendo foto ${i + 1} de ${files.length}...`);
          const fd = new FormData();
          fd.append("file", files[i]);
          const upRes = await fetch("/api/admin/upload-menu-photo", { method: "POST", body: fd });
          const upData = await upRes.json();
          if (!upRes.ok) throw new Error(upData.error || `Error subiendo foto ${i + 1}`);
          urls.push(upData.url);
        }

        setProgress("Extrayendo platos de tu carta...");
        res = await fetch("/api/admin/import-menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId, urls }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al importar");

      onDone({ dishes: data.dishes, categories: data.categories });
    } catch (err: any) {
      setError(err?.message || "Error al importar la carta");
      setLoading(false);
    }
  };

  const modes: { key: Mode; icon: React.ReactNode; label: string; desc: string }[] = [
    { key: "link", icon: <Link size={20} />, label: "Link", desc: "Pega la URL de tu carta online" },
    { key: "photo", icon: <Camera size={20} />, label: "Fotos", desc: "Sube fotos de tu carta" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => { if (!loading) onClose(); }}>
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 20, width: "100%", maxWidth: 420, padding: "24px 20px", position: "relative" }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} disabled={loading} style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", color: "var(--adm-text3)", cursor: "pointer" }}><X size={18} /></button>

        <h2 style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px" }}>Importar mi carta</h2>
        <p style={{ fontFamily: F, fontSize: "0.82rem", color: "var(--adm-text3)", margin: "0 0 20px", lineHeight: 1.4 }}>
          Sube tu carta y digitalizamos tus platos automáticamente. Los platos que tengas ahora serán reemplazados por los tuyos.
        </p>

        {!mode ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {modes.map(m => (
              <button key={m.key} onClick={() => setMode(m.key)} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", borderRadius: 14,
                cursor: "pointer", textAlign: "left", fontFamily: F,
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(244,166,35,.1)", display: "grid", placeItems: "center", color: "#F4A623", flexShrink: 0 }}>{m.icon}</div>
                <div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--adm-text)" }}>{m.label}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--adm-text3)" }}>{m.desc}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <>
            <button onClick={() => { if (!loading) { setMode(null); setError(""); setFiles([]); setUrl(""); } }} style={{
              background: "none", border: "none", color: "var(--adm-text3)", fontFamily: F, fontSize: "0.8rem", cursor: "pointer", marginBottom: 14, padding: 0,
            }}>← Cambiar método</button>

            {mode === "link" && (
              <input
                placeholder="https://tucarta.cl/menu"
                value={url}
                onChange={e => setUrl(e.target.value)}
                disabled={loading}
                style={{
                  width: "100%", padding: "12px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-card-border)",
                  borderRadius: 12, color: "var(--adm-text)", fontFamily: F, fontSize: "0.9rem", outline: "none", boxSizing: "border-box",
                }}
              />
            )}

            {mode === "photo" && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  multiple
                  onChange={e => {
                    if (!e.target.files) return;
                    const selected = Array.from(e.target.files).slice(0, 15);
                    setFiles(selected);
                  }}
                  style={{ display: "none" }}
                />
                <div
                  onClick={() => { if (!loading) fileRef.current?.click(); }}
                  style={{
                    border: "2px dashed var(--adm-card-border)", borderRadius: 14, padding: "20px 16px",
                    textAlign: "center", cursor: loading ? "wait" : "pointer", background: files.length ? "rgba(244,166,35,.05)" : "transparent",
                  }}
                >
                  {files.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: "left" }}>
                      {files.map((f, i) => (
                        <div key={i} style={{ fontSize: "0.82rem", color: "var(--adm-text)", fontFamily: F, display: "flex", justifyContent: "space-between" }}>
                          <span>📷 {f.name}</span>
                          <span style={{ color: "var(--adm-text3)" }}>{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                        </div>
                      ))}
                      {mode === "photo" && (
                        <div style={{ fontSize: "0.75rem", color: "var(--adm-text3)", fontFamily: F, marginTop: 4 }}>
                          Toca para agregar más (máx. 15)
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <Upload size={24} color="var(--adm-text3)" style={{ marginBottom: 8 }} />
                      <div style={{ fontSize: "0.85rem", color: "var(--adm-text3)", fontFamily: F }}>
                        Sube fotos de tu carta
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {error && (
              <div style={{ marginTop: 10, padding: "10px 14px", background: "rgba(232,80,80,.08)", border: "1px solid rgba(232,80,80,.2)", borderRadius: 10, fontSize: "0.82rem", color: "#e85d5d", fontFamily: F }}>
                {error}
              </div>
            )}

            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, color: "var(--adm-text3)", fontFamily: F, fontSize: "0.82rem" }}>
                <Loader2 size={16} className="animate-spin" style={{ animation: "spin 1s linear infinite" }} />
                {progress}
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={loading || (mode === "link" ? !url.trim() : !files.length)}
              style={{
                width: "100%", marginTop: 16, padding: "13px 16px",
                background: loading ? "var(--adm-input)" : "#F4A623", color: loading ? "var(--adm-text3)" : "#fff",
                border: "none", borderRadius: 12, fontFamily: F, fontSize: "0.9rem", fontWeight: 700,
                cursor: loading ? "wait" : "pointer", opacity: loading || (mode === "link" ? !url.trim() : !files.length) ? 0.5 : 1,
              }}
            >
              {loading ? "Procesando..." : "Importar carta"}
            </button>
          </>
        )}

        <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg); } }` }} />
      </div>
    </div>
  );
}
