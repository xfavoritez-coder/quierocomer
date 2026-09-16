"use client";
import { useState, useRef } from "react";

function safeTimeout(ms: number): AbortSignal {
  try { return AbortSignal.timeout(ms); }
  catch {
    const c = new AbortController();
    setTimeout(() => c.abort(new DOMException("TimeoutError", "TimeoutError")), ms);
    return c.signal;
  }
}

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;
      const maxSize = 1600;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob && blob.size < file.size)
          resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
        else resolve(file);
      }, "image/jpeg", 0.85);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SubirCartaModal({ open, onClose }: Props) {
  const [ucStep, setUcStep] = useState<"options" | "link" | "photo" | "scratch">("options");
  const [ucLink, setUcLink] = useState("");
  const [ucFiles, setUcFiles] = useState<File[]>([]);
  const [ucFileName, setUcFileName] = useState("");
  const [ucLoading, setUcLoading] = useState(false);
  const [ucError, setUcError] = useState("");
  const [ucProgress, setUcProgress] = useState("");
  const [ucScratchName, setUcScratchName] = useState("");
  const [ucScratchOwner, setUcScratchOwner] = useState("");
  const [ucScratchEmail, setUcScratchEmail] = useState("");
  const [ucScratchWA, setUcScratchWA] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);

  const resetModal = () => {
    setUcStep("options"); setUcLink(""); setUcFiles([]); setUcFileName("");
    setUcError(""); setUcProgress("");
    setUcScratchName(""); setUcScratchOwner(""); setUcScratchEmail(""); setUcScratchWA("");
  };

  const handleClose = () => { resetModal(); onClose(); };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    setUcFiles(prev => {
      const combined = [...prev, ...newFiles].slice(0, 10);
      const totalSize = combined.reduce((s, f) => s + f.size, 0);
      if (totalSize > 50 * 1024 * 1024) { setUcError("El peso total excede 50MB."); return prev; }
      const totalMB = (totalSize / 1024 / 1024).toFixed(1);
      setUcFileName(combined.length === 1 ? combined[0].name : `${combined.length} fotos (${totalMB}MB)`);
      setUcError("");
      return combined;
    });
    e.target.value = "";
  };

  const handleSubmit = async () => {
    setUcLoading(true); setUcError("");
    try {
      if (ucStep === "scratch") {
        if (!ucScratchName.trim() || !ucScratchEmail.trim() || !ucScratchEmail.includes("@")) {
          setUcError("Completa el nombre del restaurante y el correo."); setUcLoading(false); return;
        }
        const res = await fetch("/api/subircarta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartaType: "SCRATCH", localName: ucScratchName.trim(), ownerName: ucScratchOwner.trim() || undefined, email: ucScratchEmail.trim(), whatsapp: ucScratchWA.trim() || undefined }),
        });
        let data: any;
        try { data = await res.json(); } catch { setUcError("Error del servidor."); setUcLoading(false); return; }
        if (!res.ok || !data.slug) { setUcError(data?.error || "Error al crear tu carta."); setUcLoading(false); return; }
        window.location.href = `/registrar/${data.slug}?plan=PREMIUM`;
        return;
      }
      if (ucStep === "link") {
        let url = ucLink.trim();
        if (!url.match(/^https?:\/\//)) url = "https://" + url;
        if (url.includes("quierocomer.com")) {
          setUcError("Esta ya es una carta en QuieroComer. Si necesitas editarla, accede a tu panel.");
          setUcLoading(false); return;
        }
        const res = await fetch("/api/subircarta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartaType: "LINK", cartaUrl: url }),
        });
        const data = await res.json();
        if (!res.ok) { setUcError(data.error || "Error al procesar tu carta."); setUcLoading(false); return; }
        window.location.href = `/subircarta/paso2?id=${data.id}`;
      } else if (ucStep === "photo") {
        if (ucFiles.length === 0) { setUcError("Selecciona al menos una foto."); setUcLoading(false); return; }
        let leadId: string | null = null;
        for (let i = 0; i < ucFiles.length; i++) {
          setUcProgress(`Subiendo foto ${i + 1} de ${ucFiles.length}…`);
          const compressed = await compressImage(ucFiles[i]);
          const formData = new FormData();
          formData.append("file", compressed);
          if (leadId) formData.append("leadId", leadId);
          const res = await fetch("/api/subircarta/upload", { method: "POST", body: formData, signal: safeTimeout(30000) });
          let data: any;
          try { data = await res.json(); } catch { setUcError(`Error del servidor (${res.status}).`); setUcLoading(false); return; }
          if (!res.ok) { setUcError(data.error || `Error al subir ${ucFiles[i].name}`); setUcLoading(false); return; }
          if (!leadId) leadId = data.id;
        }
        window.location.href = `/subircarta/paso2?id=${leadId}`;
      }
    } catch (err: any) {
      const msg = err?.name === "TimeoutError"
        ? "La subida tardó demasiado. Intenta con menos fotos o más livianas."
        : "Error inesperado. Intenta de nuevo.";
      setUcError(msg);
    }
    setUcLoading(false);
  };

  if (!open) return null;

  return (
    <>
      <style>{`
        .scm-velo {
          position: fixed; inset: 0;
          background: rgba(17,17,17,.58);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          z-index: 9000; padding: 24px;
          animation: scmFadeIn .2s ease;
        }
        @keyframes scmFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .scm-modal {
          background: #fff; border-radius: 24px;
          width: 100%; max-width: 480px; max-height: 90vh;
          overflow-y: auto; padding: 80px 34px 32px;
          position: relative; text-align: center;
          box-shadow: 0 30px 90px rgba(0,0,0,.32);
          animation: scmSlideUp .22s ease;
        }
        @keyframes scmSlideUp { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .scm-modal h3 { margin: 0 0 28px; font-size: 28px; font-weight: 850; letter-spacing: -.045em; line-height: 1.08; color: #0D0D0D; }
        .scm-cerrar {
          position: absolute; top: 20px; right: 20px;
          background: none; border: 0; cursor: pointer;
          font-size: 26px; line-height: 1; color: #A09F97;
          width: 38px; height: 38px; border-radius: 50%;
          transition: .15s ease; display: flex; align-items: center; justify-content: center;
        }
        .scm-cerrar:hover { background: #F5F2EB; color: #0D0D0D; }
        .scm-volver {
          position: absolute; top: 20px; left: 20px;
          background: none; border: 0; cursor: pointer;
          font-size: 14px; font-weight: 700; color: #8C8982;
          padding: 9px 12px; border-radius: 10px; transition: .15s ease;
        }
        .scm-volver:hover { background: #F5F2EB; color: #0D0D0D; }
        .scm-opcion {
          display: flex; align-items: center; gap: 16px;
          width: 100%; text-align: left; color: #0D0D0D;
          background: #fff; border: 1.5px solid #EAE8E1;
          border-radius: 16px; padding: 18px 20px; margin-bottom: 10px;
          cursor: pointer; transition: .15s ease;
        }
        .scm-opcion:hover { border-color: #0D0D0D; background: #F5F2EB; transform: translateY(-1px); }
        .scm-opcion svg { flex-shrink: 0; opacity: .7; }
        .scm-opcion-text { display: flex; flex-direction: column; gap: 2px; flex: 1; }
        .scm-opcion-title { font-size: 16px; font-weight: 700; letter-spacing: -.02em; }
        .scm-opcion-sub { font-size: 12px; color: #8C8982; font-weight: 400; }
        .scm-hint { font-size: 13px; color: #8C8982; margin-bottom: 14px; line-height: 1.5; }
        .scm-campo {
          width: 100%; border: 1.5px solid #EAE8E1; border-radius: 14px;
          padding: 18px 20px; font-size: 16px; background: #F5F2EB;
          margin-bottom: 14px; text-align: left; outline: none;
          transition: .15s ease; display: block; font-family: inherit;
        }
        .scm-campo:focus { border-color: #0D0D0D; background: #fff; }
        .scm-campo-label { display: block; font-size: 13px; font-weight: 600; color: #0D0D0D; margin-bottom: 6px; text-align: left; }
        .scm-scratch-grid { display: grid; gap: 12px; text-align: left; margin-bottom: 14px; }
        .scm-btn {
          width: 100%; min-height: 56px; border: 0; border-radius: 14px;
          background: #F4A623; color: #fff;
          font-size: 17px; font-weight: 850; letter-spacing: -.02em;
          cursor: pointer; transition: .18s ease; font-family: inherit;
          box-shadow: 0 8px 24px rgba(245,158,27,.22);
        }
        .scm-btn:hover:not(:disabled) { background: #e09515; transform: translateY(-1px); }
        .scm-btn:disabled { opacity: .5; cursor: default; transform: none; }
        .scm-dropzone {
          border: 1.5px dashed rgba(17,17,17,.2); background: #F5F2EB;
          border-radius: 18px; padding: 32px 20px; margin-bottom: 16px;
          cursor: pointer; transition: .18s ease; text-align: center;
        }
        .scm-dropzone:hover { border-color: #0D0D0D; }
        .scm-thumbs { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 10px; }
        .scm-thumb { position: relative; width: 64px; height: 64px; border-radius: 10px; overflow: hidden; border: 1px solid #EAE8E1; flex-shrink: 0; }
        .scm-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .scm-thumb-del {
          position: absolute; top: 2px; right: 2px;
          width: 20px; height: 20px; border-radius: 50%;
          background: rgba(0,0,0,.55); border: none; color: #fff;
          font-size: 12px; cursor: pointer; display: grid; place-items: center; padding: 0;
        }
        .scm-error { color: #e85d5d; font-size: 14px; margin-bottom: 12px; }
        @media (max-width: 420px) { .scm-modal { padding: 76px 22px 26px; } .scm-modal h3 { font-size: 24px; } }
      `}</style>

      <input
        ref={photoRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.pdf"
        multiple
        style={{ display: "none" }}
        onChange={handleFileSelect}
      />

      <div className="scm-velo" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
        <div className="scm-modal" role="dialog" aria-modal="true">
          {ucStep !== "options" && (
            <button className="scm-volver" onClick={() => { setUcStep("options"); setUcError(""); setUcFiles([]); setUcFileName(""); setUcLink(""); }}>
              ← Volver
            </button>
          )}
          <button className="scm-cerrar" onClick={handleClose} aria-label="Cerrar">×</button>

          {ucStep === "options" && (
            <>
              <h3>¿Cómo tienes tu carta?</h3>
              <button className="scm-opcion" onClick={() => { setUcStep("link"); setUcError(""); }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round">
                  <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/>
                  <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>
                </svg>
                <span className="scm-opcion-text">
                  <span className="scm-opcion-title">Tengo un link</span>
                  <span className="scm-opcion-sub">De mi carta QR, web o menú online</span>
                </span>
              </button>
              <button className="scm-opcion" onClick={() => { setUcStep("photo"); setUcError(""); }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <span className="scm-opcion-text">
                  <span className="scm-opcion-title">Tengo fotos</span>
                  <span className="scm-opcion-sub">Fotos de la carta física, tomadas con el celular</span>
                </span>
              </button>
              <button className="scm-opcion" style={{ marginBottom: 0 }} onClick={() => { setUcStep("scratch"); setUcError(""); }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                </svg>
                <span className="scm-opcion-text">
                  <span className="scm-opcion-title">Crear desde cero</span>
                  <span className="scm-opcion-sub">Arrancamos con platos de ejemplo y tú la personalizas</span>
                </span>
              </button>
            </>
          )}

          {ucStep === "link" && (
            <>
              <h3>Pega el link de tu carta</h3>
              <p className="scm-hint">Puede ser tu carta web, el link de tu QR, o cualquier menú online.</p>
              <input
                className="scm-campo"
                type="url"
                placeholder="https://turestaurante.cl/carta"
                value={ucLink}
                onChange={(e) => { setUcLink(e.target.value); setUcError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                autoFocus
              />
              {ucError && <div className="scm-error">{ucError}</div>}
              <button className="scm-btn" onClick={handleSubmit} disabled={ucLoading || !ucLink.trim()}>
                {ucLoading ? (ucProgress || "Procesando...") : "Transformar mi carta →"}
              </button>
            </>
          )}

          {ucStep === "photo" && (
            <>
              <h3>Sube fotos de tu carta</h3>
              <p className="scm-hint">Pueden ser fotos tomadas con el celular de tu carta física o pizarra. JPG, PNG · Máx. 10 fotos · 50MB.</p>
              {ucFiles.length === 0 ? (
                <div className="scm-dropzone" onClick={() => photoRef.current?.click()}>
                  <div style={{ fontSize: 34, marginBottom: 8 }}>📷</div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Toca para seleccionar fotos</div>
                  <div style={{ fontSize: 13, color: "#8C8982" }}>O arrastra aquí los archivos</div>
                </div>
              ) : (
                <>
                  <div className="scm-thumbs">
                    {ucFiles.map((f, i) => (
                      <div key={i} className="scm-thumb">
                        {f.type.startsWith("image/") ? (
                          <img src={URL.createObjectURL(f)} alt={f.name} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: "#F5F5F3", fontSize: 10, color: "#666", fontWeight: 700 }}>PDF</div>
                        )}
                        <button
                          className="scm-thumb-del"
                          onClick={() => setUcFiles(prev => {
                            const next = prev.filter((_, j) => j !== i);
                            setUcFileName(next.length === 0 ? "" : next.length === 1 ? next[0].name : `${next.length} fotos`);
                            return next;
                          })}
                        >×</button>
                      </div>
                    ))}
                    {ucFiles.length < 10 && (
                      <div
                        onClick={() => photoRef.current?.click()}
                        style={{ width: 64, height: 64, borderRadius: 10, border: "1px dashed #DDDDD8", display: "grid", placeItems: "center", cursor: "pointer", color: "#A8A8A2", fontSize: 24 }}
                      >+</div>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "#8C8982", marginBottom: 14 }}>{ucFileName}</div>
                </>
              )}
              {ucError && <div className="scm-error">{ucError}</div>}
              <button className="scm-btn" onClick={ucFiles.length > 0 ? handleSubmit : () => photoRef.current?.click()} disabled={ucLoading}>
                {ucLoading ? (ucProgress || "Subiendo...") : ucFiles.length > 0 ? "Transformar mi carta →" : "Seleccionar fotos"}
              </button>
            </>
          )}

          {ucStep === "scratch" && (
            <>
              <h3>Creamos tu carta desde cero</h3>
              <p className="scm-hint">Armamos una carta con platos de ejemplo y tú la editas desde tu panel. Listo en minutos.</p>
              <div className="scm-scratch-grid">
                <div>
                  <label className="scm-campo-label">Nombre del restaurante *</label>
                  <input className="scm-campo" type="text" placeholder="Ej: Mi Restaurante" value={ucScratchName} onChange={(e) => { setUcScratchName(e.target.value); setUcError(""); }} autoFocus />
                </div>
                <div>
                  <label className="scm-campo-label">Tu nombre</label>
                  <input className="scm-campo" type="text" placeholder="Ej: Juan Pérez" value={ucScratchOwner} onChange={(e) => setUcScratchOwner(e.target.value)} />
                </div>
                <div>
                  <label className="scm-campo-label">Correo electrónico *</label>
                  <input className="scm-campo" type="email" placeholder="tu@correo.com" value={ucScratchEmail} onChange={(e) => { setUcScratchEmail(e.target.value); setUcError(""); }} />
                </div>
                <div>
                  <label className="scm-campo-label">WhatsApp</label>
                  <input className="scm-campo" type="tel" placeholder="9 1234 5678" value={ucScratchWA} onChange={(e) => setUcScratchWA(e.target.value)} />
                </div>
              </div>
              {ucError && <div className="scm-error">{ucError}</div>}
              <button className="scm-btn" onClick={handleSubmit} disabled={ucLoading || !ucScratchName.trim() || !ucScratchEmail.includes("@")}>
                {ucLoading ? "Creando..." : "Crear mi carta →"}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
