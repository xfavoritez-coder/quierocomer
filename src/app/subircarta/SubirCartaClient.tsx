"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";
import PlanesModal from "@/components/PlanesModal";
import { trackFunnelEvent } from "@/lib/funnelTracker";

type Mode = "pdf" | "link" | "photo" | null;

/** Compress image in browser via canvas — returns JPEG blob at max 1600px */
async function compressImage(file: File, maxSize = 1600, quality = 0.85): Promise<File> {
  // Skip non-image files (PDF, etc)
  if (!file.type.startsWith("image/")) return file;

  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
          } else {
            resolve(file); // Keep original if compression didn't help
          }
        },
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

export default function SubirCartaClient() {
  const router = useRouter();
  const [planesOpen, setPlanesOpen] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const [mode, setMode] = useState<Mode>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const normalizedUrl = linkUrl.trim() && !linkUrl.trim().match(/^https?:\/\//) ? `https://${linkUrl.trim()}` : linkUrl.trim();
  const isLinkValid = mode === "link" && (() => {
    try { new URL(normalizedUrl); return true; } catch { return false; }
  })();

  const hasFile = (mode === "pdf" || mode === "photo") && !!fileName;
  const ctaEnabled = mode === "link" ? isLinkValid : hasFile;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (files.length > 10) { setError("Máximo 10 fotos."); return; }
      const totalSize = Array.from(files).reduce((sum, f) => sum + f.size, 0);
      if (totalSize > 50 * 1024 * 1024) { setError("El peso total excede 50MB. Intenta con menos fotos o más livianas."); return; }
      const totalMB = (totalSize / 1024 / 1024).toFixed(1);
      setFileName(files.length === 1 ? files[0].name : `${files.length} fotos (${totalMB}MB)`);
      setError("");
    }
  };

  const handleSubmit = async () => {
    if (!ctaEnabled || loading) return;

    setLoading(true);
    setError("");

    try {
      if (mode === "link") {
        const res = await fetch("/api/subircarta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartaType: "LINK", cartaUrl: normalizedUrl }),
        });
        const data = await res.json();
        if (!res.ok) { trackFunnelEvent(data.id, "paso1_error", { mode, error: data.error }); setError(data.error || "Error al procesar tu carta."); return; }
        trackFunnelEvent(data.id, "paso1_completed", { mode: "link", url: normalizedUrl });
        router.push(`/subircarta/paso2?id=${data.id}`);
      } else {
        const inputRef = mode === "pdf" ? fileRef : photoRef;
        const files = inputRef.current?.files;
        if (!files || files.length === 0) { setError("Selecciona un archivo primero."); return; }

        // Compress and upload files one by one with progress
        const total = Math.min(files.length, 10);
        let leadId = "";
        for (let i = 0; i < total; i++) {
          const label = mode === "pdf" ? "archivo" : "foto";
          setUploadProgress(total > 1 ? `Procesando ${label} ${i + 1} de ${total}` : `Procesando ${label}`);
          const compressed = await compressImage(files[i]);
          const formData = new FormData();
          formData.append("file", compressed);
          if (leadId) formData.append("leadId", leadId);
          const res = await fetch("/api/subircarta/upload", {
            method: "POST",
            body: formData,
            signal: AbortSignal.timeout(30000),
          });
          const data = await res.json();
          if (!res.ok) {
            trackFunnelEvent(leadId || data.id, "upload_error", { file: i + 1, of: total, error: data.error, fileName: files[i].name });
            setError(data.error || `Error al subir ${files[i].name}`); setUploadProgress(""); return;
          }
          if (!leadId) leadId = data.id;
        }
        trackFunnelEvent(leadId, "paso1_completed", { mode, files: total, totalMB: +(Array.from(files).reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1) });
        setUploadProgress("");
        router.push(`/subircarta/paso2?id=${leadId}`);
      }
    } catch (err: any) {
      const msg = err?.name === "TimeoutError" ? "La subida tardó demasiado. Intenta con menos fotos o más livianas."
        : err?.name === "AbortError" ? "Se canceló la subida."
        : `Error: ${err?.message || "conexión fallida"}`;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <div className="grain" />

      <main className="page">
        <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, padding: "20px clamp(22px,4vw,64px)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(9,8,6,.72)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
          <a href="/landing" style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "var(--cream)", display: "flex", alignItems: "center", gap: 10, letterSpacing: ".02em", textDecoration: "none" }}>
            <img src="/landing/logo.png" alt="" style={{ height: 20, width: "auto", marginRight: -8 }} />
            QuieroComer
          </a>
          <a href="mailto:hola@quierocomer.cl" style={{ color: "var(--cream-2)", fontSize: 13, textDecoration: "none", letterSpacing: ".04em" }}>Ayuda</a>
        </nav>

        <section className="steps" aria-label="Progreso">
          <div className="step active"><div className="step-number">1</div><span>Subir carta</span></div>
          <div className="step-line" />
          <div className="step"><div className="step-number">2</div><span>Transformación</span></div>
          <div className="step-line" />
          <div className="step"><div className="step-number">3</div><span>Carta viva</span></div>
        </section>

        <section className="shell centered-shell">
          <div className="center-copy">
            <h1>Sube tu carta y ve cómo <span>mejora.</span></h1>
          </div>

          <div className="form-side centered-form">
            {/* Method selector */}
            <div className="methods">
              {(["photo", "link", "pdf"] as const).map((m) => (
                <button
                  key={m}
                  className={`method${mode === m ? " active" : ""}`}
                  type="button"
                  onClick={() => { setMode(m); setError(""); setFileName(""); }}
                >
                  {m === "pdf" && (
                    <><svg viewBox="0 0 64 64" fill="none"><path d="M20 8h18l10 10v38H20V8z" stroke="currentColor" strokeWidth="3"/><path d="M38 8v12h10M26 32h16M26 40h16" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg><strong>Tengo PDF</strong><span>o archivo</span></>
                  )}
                  {m === "link" && (
                    <><svg viewBox="0 0 64 64" fill="none"><path d="M26 38l12-12M28 18l3-3a11 11 0 0 1 16 16l-4 4M36 46l-3 3a11 11 0 0 1-16-16l4-4" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg><strong>Tengo link</strong><span>de mi carta QR</span></>
                  )}
                  {m === "photo" && (
                    <><svg viewBox="0 0 64 64" fill="none"><path d="M16 22h8l4-6h8l4 6h8v26H16V22z" stroke="currentColor" strokeWidth="3"/><circle cx="32" cy="35" r="8" stroke="currentColor" strokeWidth="3"/></svg><strong>Tengo foto</strong><span>del menú físico</span></>
                  )}
                </button>
              ))}
            </div>

            {/* PDF panel */}
            {mode === "pdf" && (
              <div className="input-panel">
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" style={{ display: "none" }} onChange={handleFileSelect} />
                <div className="upload-card compact-upload" role="button" tabIndex={0} onClick={() => fileRef.current?.click()} onKeyDown={(e) => { if (e.key === "Enter") fileRef.current?.click(); }}>
                  <div>
                    <div className="upload-icon">
                      <svg viewBox="0 0 64 64" fill="none"><path d="M22 46H18a12 12 0 0 1-1.2-23.9A16 16 0 0 1 48 26a10 10 0 0 1-2 20h-4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><path d="M32 46V26M24 34l8-8 8 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    {fileName ? (
                      <>
                        <div className="upload-title" style={{ color: "var(--amber-2)" }}>{fileName}</div>
                        <div style={{ color: "var(--cream-2, #d4c8b8)", fontSize: "0.8rem", fontWeight: 400, marginTop: 4 }}>Haz clic para cambiar archivo</div>
                      </>
                    ) : (
                      <>
                        <div className="upload-title">Sube tu carta en PDF</div>
                        <div className="upload-link">Haz clic para seleccionar archivo</div>
                        <div className="formats">PDF, Word, Excel · Máx. 10MB</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Link panel */}
            {mode === "link" && (
              <div className="input-panel">
                <div className="upload-card compact-upload" style={{ minHeight: 160 }}>
                  <div style={{ width: "100%" }}>
                    <div className="upload-icon">
                      <svg viewBox="0 0 64 64" fill="none"><path d="M26 38l12-12M28 18l3-3a11 11 0 0 1 16 16l-4 4M36 46l-3 3a11 11 0 0 1-16-16l4-4" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
                    </div>
                    <div className="upload-title">Pega el link de tu carta actual</div>
                    <div className="upload-link" style={{ marginBottom: 12 }}>Ya sea tu web o link de tu QR</div>
                    <input
                      type="url"
                      placeholder="https://turestaurante.cl/carta"
                      style={{ maxWidth: 420, margin: "0 auto" }}
                      value={linkUrl}
                      onChange={(e) => { setLinkUrl(e.target.value); setError(""); }}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Photo panel */}
            {mode === "photo" && (
              <div className="input-panel">
                <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple style={{ display: "none" }} onChange={handleFileSelect} />
                <div className="upload-card compact-upload" role="button" tabIndex={0} onClick={() => photoRef.current?.click()} onKeyDown={(e) => { if (e.key === "Enter") photoRef.current?.click(); }}>
                  <div>
                    <div className="upload-icon">
                      <svg viewBox="0 0 64 64" fill="none"><path d="M16 22h8l4-6h8l4 6h8v26H16V22z" stroke="currentColor" strokeWidth="3"/><circle cx="32" cy="35" r="8" stroke="currentColor" strokeWidth="3"/></svg>
                    </div>
                    {fileName ? (
                      <>
                        <div className="upload-title" style={{ color: "var(--amber-2)" }}>{fileName}</div>
                        <div style={{ color: "var(--cream-2, #d4c8b8)", fontSize: "0.8rem", fontWeight: 400, marginTop: 4 }}>Haz clic para cambiar foto</div>
                      </>
                    ) : (
                      <>
                        <div className="upload-title">Sube fotos de tu menú</div>
                        <div className="upload-link">Puede ser una foto tomada con el celular</div>
                        <div className="formats">JPG o PNG · Máx. 10MB</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div style={{ marginTop: 12, color: "#e85d5d", fontSize: 14, textAlign: "center" }}>
                {error}
              </div>
            )}

            {/* CTA */}
            <button
              className="cta"
              type="button"
              onClick={handleSubmit}
              disabled={!ctaEnabled || loading}
              style={{
                opacity: ctaEnabled && !loading ? 1 : 0.45,
                cursor: ctaEnabled && !loading ? "pointer" : "default",
              }}
            >
              {loading ? <><span>{uploadProgress || "Analizando"}</span><span className="loading-dots" /><span> </span></> : "Analizar mi carta"} <span>→</span>
            </button>

            <div className="trust below-cta">
              <svg viewBox="0 0 24 24" fill="none" style={{ width: 16, height: 16, flexShrink: 0, color: "var(--amber-2)" }}><path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6V11z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
              Tu información está protegida
            </div>
          </div>
        </section>
      </main>

      <Footer onPlanesClick={() => setPlanesOpen(true)} />
      {planesOpen && <PlanesModal onClose={() => setPlanesOpen(false)} />}
    </>
  );
}

const STYLES = `
:root {
  --black: #090806;--black-2: #120f0b;--card: rgba(18, 14, 10, .76);--card-2: rgba(255, 255, 255, .045);
  --line: rgba(242, 229, 207, .14);--line-strong: rgba(232, 163, 61, .44);
  --amber: #E8A33D;--amber-2: #E8A33D;--amber-3: #B8801A;
  --cream: #F2E5CF;--cream-2: #CDBB9D;--muted: #887B68;
  --font-display: 'Cormorant Garamond', serif;--font-body: 'Inter', sans-serif;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { min-height: 100vh!important; background: linear-gradient(180deg, rgba(9,8,6,.72), rgba(9,8,6,.96)), url('/landing/fondo.png') center/cover no-repeat!important; background-size: cover!important; background-attachment: fixed!important; color: var(--cream)!important; font-family: var(--font-body)!important; line-height: 1.55!important; -webkit-font-smoothing: antialiased; overflow-x: hidden!important; }
.grain { position: fixed; inset: 0; pointer-events: none; z-index: 30; opacity: .13; mix-blend-mode: overlay; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.6'/%3E%3C/svg%3E"); }
a { color: inherit; text-decoration: none; }
.page { width: min(100% - 28px, 1120px); margin: 0 auto; padding: 80px 0 34px; position: relative; z-index: 2; }
.steps { display: flex; align-items: center; justify-content: center; gap: 0; margin: 24px auto 34px; max-width: 480px; }
.step { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 13px; }
.step-line { width: 28px; height: 1px; background: rgba(232,163,61,.15); margin: 0 6px; }
.step-number { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 600; border: 1px solid rgba(232,163,61,.2); background: transparent; color: var(--muted); }
.step.active { color: var(--amber-2); }
.step.active .step-number { color: var(--amber-2); border-color: var(--amber); background: rgba(232,163,61,.1); }
.shell { border: 1px solid var(--line); background: linear-gradient(180deg, rgba(14,11,8,.86), rgba(14,11,8,.62)); border-radius: 28px; padding: 24px; box-shadow: 0 28px 90px rgba(0,0,0,.38); backdrop-filter: blur(14px); position: relative; overflow: hidden; }
.centered-shell { max-width: 760px; margin: 0 auto; text-align: center; }
.shell::before { content: ''; position: absolute; width: 360px; height: 360px; right: -140px; top: 140px; border-radius: 50%; background: radial-gradient(circle, rgba(232,163,61,.16), transparent 70%); filter: blur(8px); pointer-events: none; }
h1 { font-family: var(--font-display); font-size: clamp(36px, 9vw, 54px); line-height: .94; font-weight: 500; letter-spacing: -.035em; margin-bottom: 18px; }
h1 span { color: var(--amber-2); font-style: italic; }
.method-title { text-align: center; margin: 28px 0 14px; color: var(--cream-2); }
.first-title { margin-top: 0; color: var(--cream-2); font-weight: 500; font-size: 19px; }
.centered-form { max-width: 620px; margin: 0 auto; }
.methods { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.method { border: 1px solid var(--line); background: rgba(255,255,255,.035); border-radius: 18px; padding: 16px 10px; text-align: center; min-height: 128px; display: grid; align-content: center; gap: 9px; color: var(--cream); cursor: pointer; transition: border-color .2s ease, background .2s ease, transform .2s ease; }
.method:hover, .method.active { transform: translateY(-2px); border-color: var(--line-strong); background: rgba(232,163,61,.075); }
.method svg { width: 32px; height: 32px; margin: 0 auto; color: var(--amber-2); }
.method span { font-size: 13px; color: var(--cream-2); }
.input-panel { margin-top: 18px; }
.upload-card { margin-top: 20px; border: 1px dashed rgba(244,189,105,.75); background: radial-gradient(circle at 50% 0%, rgba(232,163,61,.12), transparent 42%), rgba(255,255,255,.035); border-radius: 24px; min-height: 230px; display: grid; place-items: center; text-align: center; padding: 32px 20px; box-shadow: inset 0 0 50px rgba(232,163,61,.055), 0 0 34px rgba(232,163,61,.08); transition: transform .22s ease, border-color .22s ease, background .22s ease; }
.compact-upload { margin-top: 18px; min-height: 160px; padding: 24px 20px; }
.upload-card:hover { transform: translateY(-2px); border-color: var(--amber-2); background: radial-gradient(circle at 50% 0%, rgba(232,163,61,.18), transparent 44%), rgba(255,255,255,.052); }
.upload-icon { width: 52px; height: 52px; margin: 0 auto 12px; display: grid; place-items: center; color: var(--amber-2); }
.upload-title { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
.upload-link { color: var(--amber-2); font-weight: 600; }
.formats { margin-top: 16px; color: var(--muted); font-size: 13px; }
.field-label { display: block; text-align: left; margin: 0 0 8px; color: var(--amber-2); font-size: 13px; font-weight: 700; }
input { width: 100%; height: 56px; border-radius: 16px; border: 1px solid var(--line); background: rgba(0,0,0,.32); color: var(--cream); padding: 0 16px; font: inherit; outline: none; }
input::placeholder { color: rgba(136,123,104,.5) !important; }
input:focus { border-color: var(--amber); box-shadow: 0 0 0 3px rgba(232,163,61,.1); }
.trust { display: flex; justify-content: center; align-items: center; gap: 6px; color: var(--cream-2); font-size: 13px; margin: 22px 0 18px; }
.trust svg { flex-shrink: 0; color: var(--amber-2); width: 16px; height: 16px; }
.below-cta { margin: 10px auto 0; max-width: 520px; }
.cta { width: 100%; min-height: 62px; border: 0; border-radius: 18px; background: var(--amber); color: #160e06; font-size: 17px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 18px 58px rgba(232,163,61,.24); cursor: pointer; transition: transform .2s ease, box-shadow .2s ease, opacity .3s ease; margin-top: 20px; }
.cta:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 24px 72px rgba(232,163,61,.32); }
@media (min-width: 860px) { .page { padding-top: 80px; } .steps { width: 560px; margin: 0 auto 36px; } .shell { padding: 46px; } h1 { font-size: 52px; } .methods { gap: 14px; } }
@media (max-width: 390px) { h1 { font-size: 34px; } .methods { grid-template-columns: 1fr; } .method { min-height: 98px; } }
@keyframes loadingDots { 0% { content: '.'; } 33% { content: '..'; } 66% { content: '...'; } }
.loading-dots::after { content: '.'; animation: loadingDots 1.2s steps(1) infinite; }
`;
