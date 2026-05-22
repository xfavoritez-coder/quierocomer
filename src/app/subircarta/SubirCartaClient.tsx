"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";
import { trackCartaUpload } from "@/lib/metaPixel";
import PlanesModal from "@/components/PlanesModal";
import NavHamburger from "@/components/NavHamburger";
import { trackFunnelEvent } from "@/lib/funnelTracker";
import { initAdTracker, resumeAdTracker, linkAdSessionToLead } from "@/lib/adTracker";
import { normalizePhone } from "@/lib/normalizePhone";

type Mode = "pdf" | "link" | "photo" | null;

/** AbortSignal.timeout polyfill for older WebViews (Instagram Android, etc.) */
function safeTimeout(ms: number): AbortSignal {
  try {
    return AbortSignal.timeout(ms);
  } catch {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException("TimeoutError", "TimeoutError")), ms);
    return controller.signal;
  }
}

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
  useEffect(() => {
    window.scrollTo(0, 0);
    const params = new URLSearchParams(window.location.search);
    // Fallback chain: URL params → referrer params → sessionStorage (adTracker)
    let refParams: URLSearchParams | null = null;
    try { if (document.referrer) refParams = new URL(document.referrer).searchParams; } catch {}
    let ssUtms: Record<string, string | null> = {};
    try { const raw = sessionStorage.getItem("ad_session"); if (raw) ssUtms = JSON.parse(raw); } catch {}
    const get = (key: string) => params.get(key) || refParams?.get(key) || null;
    // For UTM fields, also check sessionStorage keys (adTracker stores as camelCase)
    const utmMap: Record<string, string> = { utm_source: "utmSource", utm_medium: "utmMedium", utm_campaign: "utmCampaign", utm_content: "utmContent", utm_term: "utmTerm", fbclid: "fbclid" };
    const getUtm = (key: string) => get(key) || (ssUtms as any)[utmMap[key] || key] || null;
    const utmSource = getUtm("utm_source");
    const fbclid = getUtm("fbclid");
    const gclid = get("gclid");
    fetch("/api/funnel/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page: "subircarta",
        referrer: document.referrer || null,
        utmSource: utmSource || (fbclid ? "facebook" : gclid ? "google" : null),
        utmMedium: getUtm("utm_medium") || (fbclid ? "paid" : gclid ? "cpc" : null),
        utmCampaign: getUtm("utm_campaign"),
        utmContent: getUtm("utm_content"),
        utmTerm: getUtm("utm_term"),
        fbclid,
      }),
      keepalive: true,
    }).catch(() => {});
    // Continue existing ad session from landing, or start new one if direct visit
    if (!resumeAdTracker()) initAdTracker();
  }, []);
  const [mode, setMode] = useState<Mode>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  // Fallback form — shown when navigation to paso2 fails
  const [fallbackLeadId, setFallbackLeadId] = useState<string | null>(null);
  const [fbLocalName, setFbLocalName] = useState("");
  const [fbOwnerName, setFbOwnerName] = useState("");
  const [fbEmail, setFbEmail] = useState("");
  const [fbWhatsapp, setFbWhatsapp] = useState("");
  const [fbLoading, setFbLoading] = useState(false);
  const [fbError, setFbError] = useState("");
  const [fbDone, setFbDone] = useState(false);
  const formatFbPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 9);
    if (d.length <= 1) return d;
    if (d.length <= 5) return `${d[0]} ${d.slice(1)}`;
    return `${d[0]} ${d.slice(1, 5)} ${d.slice(5)}`;
  };

  const normalizedUrl = linkUrl.trim() && !linkUrl.trim().match(/^https?:\/\//) ? `https://${linkUrl.trim()}` : linkUrl.trim();
  const isLinkValid = mode === "link" && (() => {
    try {
      const u = new URL(normalizedUrl);
      // Must be http/https and have a real domain (contains a dot)
      return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
    } catch { return false; }
  })();

  const hasFile = (mode === "pdf" || mode === "photo") && !!fileName;
  const ctaEnabled = mode === "link" ? isLinkValid : hasFile;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (mode === "photo") {
      // Accumulate photos instead of replacing
      const newFiles = Array.from(files);
      setPhotoFiles(prev => {
        const combined = [...prev, ...newFiles];
        if (combined.length > 10) { setError("Máximo 10 fotos."); return prev; }
        const totalSize = combined.reduce((sum, f) => sum + f.size, 0);
        if (totalSize > 50 * 1024 * 1024) { setError("El peso total excede 50MB. Intenta con menos fotos o más livianas."); return prev; }
        const totalMB = (totalSize / 1024 / 1024).toFixed(1);
        setFileName(combined.length === 1 ? combined[0].name : `${combined.length} fotos (${totalMB}MB)`);
        setError("");
        return combined;
      });
      // Reset input so the same file can be re-selected or camera triggered again
      e.target.value = "";
    } else {
      // PDF mode — single file, replace
      const totalSize = Array.from(files).reduce((sum, f) => sum + f.size, 0);
      if (totalSize > 50 * 1024 * 1024) { setError("El peso total excede 50MB."); return; }
      setPdfFile(files[0]);
      setFileName(files[0].name);
      setError("");
    }
  };

  /** Try router.push → wait 1s → try location.href → wait 1s → show fallback form */
  const navigateToPaso2 = (leadId: string) => {
    const url = `/subircarta/paso2?id=${leadId}`;
    setUploadProgress("Preparando tu carta");
    // Also detect if SPA navigation fires by checking pathname after delay
    try { router.push(url); } catch { /* ignore */ }
    setTimeout(() => {
      // Check if SPA navigation worked (pathname changed)
      if (window.location.pathname.includes("/paso2")) return;
      // Fallback: hard navigation
      trackFunnelEvent(leadId, "paso2_nav_fallback", { method: "location" });
      try { window.location.href = url; } catch { /* ignore */ }
      // Final fallback: if still here after 1s, show inline form
      setTimeout(() => {
        if (window.location.pathname.includes("/paso2")) return;
        trackFunnelEvent(leadId, "paso2_nav_failed", { method: "fallback_form" });
        setUploadProgress("");
        setFallbackLeadId(leadId);
        setLoading(false);
      }, 1000);
    }, 1000);
  };

  const handleFallbackSubmit = async () => {
    if (fbLoading || !fallbackLeadId) return;
    if (!fbLocalName.trim() || !fbOwnerName.trim() || !fbEmail.trim() || !fbWhatsapp.trim()) {
      setFbError("Completa todos los campos.");
      return;
    }
    setFbLoading(true);
    setFbError("");
    try {
      const res = await fetch(`/api/subircarta/${fallbackLeadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localName: fbLocalName.trim(),
          ownerName: fbOwnerName.trim(),
          email: fbEmail.trim(),
          whatsapp: fbWhatsapp.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setFbError(data.error || "Error al guardar.");
        return;
      }
      // Trigger processing
      fetch("/api/subircarta/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: fallbackLeadId }),
      }).catch(() => {});
      trackFunnelEvent(fallbackLeadId, "paso2_completed", { via: "fallback_form" });
      setFbDone(true);
    } catch {
      setFbError("Error de conexión. Intenta de nuevo.");
    } finally {
      setFbLoading(false);
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
        trackCartaUpload();
        linkAdSessionToLead(data.id);
        navigateToPaso2(data.id);
      } else {
        const filesToUpload = mode === "photo" ? photoFiles : Array.from(fileRef.current?.files || []);
        if (filesToUpload.length === 0) { setError("Selecciona un archivo primero."); return; }

        // Compress and upload files one by one with progress
        const total = Math.min(filesToUpload.length, 10);
        let leadId = "";
        for (let i = 0; i < total; i++) {
          const label = mode === "pdf" ? "archivo" : "foto";
          setUploadProgress(total > 1 ? `Procesando ${label} ${i + 1} de ${total}` : `Procesando ${label}`);
          const compressed = await compressImage(filesToUpload[i]);
          const formData = new FormData();
          formData.append("file", compressed);
          if (leadId) formData.append("leadId", leadId);
          const res = await fetch("/api/subircarta/upload", {
            method: "POST",
            body: formData,
            signal: safeTimeout(30000),
          });
          const data = await res.json();
          if (!res.ok) {
            trackFunnelEvent(leadId || data.id, "upload_error", { file: i + 1, of: total, error: data.error, fileName: filesToUpload[i].name });
            setError(data.error || `Error al subir ${filesToUpload[i].name}`); setUploadProgress(""); return;
          }
          if (!leadId) leadId = data.id;
        }
        trackFunnelEvent(leadId, "paso1_completed", { mode, files: total, totalMB: +(filesToUpload.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1) });
        trackCartaUpload();
        linkAdSessionToLead(leadId);
        setUploadProgress("");
        navigateToPaso2(leadId);
      }
    } catch (err: any) {
      const msg = err?.name === "TimeoutError" ? "La subida tardó demasiado. Intenta con menos fotos o más livianas."
        : err?.name === "AbortError" ? "Se canceló la subida."
        : `Error: ${err?.message || "conexión fallida"}`;
      setError(msg);
    } finally {
      // Don't setLoading(false) here — navigateToPaso2 handles it if fallback fires
      if (!fallbackLeadId) setLoading(false);
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
          <NavHamburger />
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
            <h1>Sube gratis tu carta y ve cómo <span>mejora.</span></h1>
          </div>

          <div className="form-side centered-form">
            {/* Method selector */}
            <div className="methods" data-track="metodos">
              {(["photo", "link", "pdf"] as const).map((m) => (
                <button
                  key={m}
                  className={`method${mode === m ? " active" : ""}`}
                  type="button"
                  onClick={() => { setMode(m); setError(""); setFileName(""); setPdfFile(null); setPhotoFiles([]); }}
                >
                  {m === "pdf" && (
                    <><svg viewBox="0 0 64 64" fill="none"><path d="M20 8h18l10 10v38H20V8z" stroke="currentColor" strokeWidth="3"/><path d="M38 8v12h10M26 32h16M26 40h16" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg><strong>Tengo PDF</strong><span>o archivo</span></>
                  )}
                  {m === "link" && (
                    <><svg viewBox="0 0 64 64" fill="none"><path d="M26 38l12-12M28 18l3-3a11 11 0 0 1 16 16l-4 4M36 46l-3 3a11 11 0 0 1-16-16l4-4" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg><strong>Tengo link</strong><span>de mi carta QR o web</span></>
                  )}
                  {m === "photo" && (
                    <><svg viewBox="0 0 64 64" fill="none"><path d="M16 22h8l4-6h8l4 6h8v26H16V22z" stroke="currentColor" strokeWidth="3"/><circle cx="32" cy="35" r="8" stroke="currentColor" strokeWidth="3"/></svg><strong>Tengo foto</strong><span>de mi carta física</span></>
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
                {/* PDF file preview */}
                {pdfFile && (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, padding: "12px 14px", background: "rgba(255,255,255,.04)", border: "1px solid var(--line)", borderRadius: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(232,163,61,.1)", border: "1px solid rgba(232,163,61,.25)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M8 2h8l4 4v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke="var(--amber-2)" strokeWidth="1.8"/><path d="M16 2v4h4M10 10h4M10 14h4" stroke="var(--amber-2)" strokeWidth="1.8" strokeLinecap="round"/></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cream)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pdfFile.name}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{(pdfFile.size / 1024 / 1024).toFixed(1)} MB</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setPdfFile(null); setFileName(""); if (fileRef.current) fileRef.current.value = ""; }}
                      style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(255,255,255,.08)", border: "none", color: "var(--cream-2)", fontSize: 14, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}
                    >×</button>
                  </div>
                )}
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
                    {photoFiles.length > 0 ? (
                      <>
                        <div className="upload-title" style={{ color: "var(--amber-2)" }}>{fileName}</div>
                        <div style={{ color: "var(--cream-2, #d4c8b8)", fontSize: "0.8rem", fontWeight: 400, marginTop: 4 }}>Toca para agregar más fotos</div>
                      </>
                    ) : (
                      <>
                        <div className="upload-title">Sube fotos de tu menú</div>
                        <div className="upload-link">Pueden ser fotos tomadas con el celular</div>
                        <div className="formats">JPG o PNG · Máx. 10MB</div>
                      </>
                    )}
                  </div>
                </div>
                {/* Photo thumbnails */}
                {photoFiles.length > 0 && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, justifyContent: "center" }}>
                    {photoFiles.map((f, i) => (
                      <div key={`${f.name}-${i}`} style={{ position: "relative", width: 64, height: 64, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,.12)" }}>
                        <img src={URL.createObjectURL(f)} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button
                          onClick={(e) => { e.stopPropagation(); setPhotoFiles(prev => { const next = prev.filter((_, j) => j !== i); setFileName(next.length === 0 ? "" : next.length === 1 ? next[0].name : `${next.length} fotos (${(next.reduce((s, f2) => s + f2.size, 0) / 1024 / 1024).toFixed(1)}MB)`); return next; }); }}
                          style={{ position: "absolute", top: 2, right: 2, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,.7)", border: "none", color: "#fff", fontSize: 12, cursor: "pointer", display: "grid", placeItems: "center", lineHeight: 1 }}
                        >×</button>
                      </div>
                    ))}
                    {photoFiles.length < 10 && (
                      <div
                        onClick={(e) => { e.stopPropagation(); photoRef.current?.click(); }}
                        style={{ width: 64, height: 64, borderRadius: 10, border: "1px dashed rgba(255,255,255,.2)", display: "grid", placeItems: "center", cursor: "pointer", color: "rgba(255,255,255,.4)", fontSize: 24 }}
                      >+</div>
                    )}
                  </div>
                )}
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
              {loading ? <><span>{uploadProgress || "Subiendo"}</span><span className="loading-dots" /><span> </span></> : "Subir mi carta"} <span>→</span>
            </button>

          </div>
        </section>

        {/* Social proof — restaurants that already transformed */}
        <section className="social-proof" data-track="Social proof">
          <p className="social-proof-title">Ellos ya transformaron su carta</p>
          <div className="social-proof-logos">
            {[
              { slug: "hand-roll", name: "Hand Roll", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/restaurants/hand-roll/logo.png", color: "#dc2626" },
              { slug: "horusvegan", name: "Horus Vegan", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/restaurants/horusvegan/logo.png", color: "#1a5f3f" },
              { slug: "alleria-pizza", name: "Alleria Pizza", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1777477859043-9ibluljyt89.png", color: "#c0392b" },
              { slug: "juana-la-brava", name: "Juana la Brava", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1779212065016-vn71iczuzue.jpg", color: "#7c2d12" },
            ].map((r) => (
              <a key={r.slug} href={`/qr/${r.slug}?showcase=1`} target="_blank" rel="noopener noreferrer" className="social-proof-logo" title={`Ver carta de ${r.name}`}>
                <img src={r.logo} alt={r.name} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling!.removeAttribute("style"); }} />
                <span className="social-proof-fallback" style={{ display: "none", background: r.color }}>{r.name.split(" ").map(w => w[0]).join("").slice(0, 2)}</span>
              </a>
            ))}
          </div>
          <p className="social-proof-sub">Toca un logo para ver su carta en vivo</p>
        </section>

        {/* Fallback form — shown when navigation to paso2 fails */}
        {fallbackLeadId && !fbDone && (
          <section className="shell centered-shell" style={{ marginTop: 24, animation: "fallbackReveal 0.6s cubic-bezier(0.16,1,0.3,1) both" }}>
            <div className="centered-form">
              <div style={{ textAlign: "center", marginBottom: 18 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(67,209,123,.12)", border: "1px solid rgba(67,209,123,.3)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
                  <svg viewBox="0 0 24 24" fill="none" width="28" height="28"><path d="M5 13l4 4L19 7" stroke="#43d17b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 7vw, 36px)", lineHeight: 1, fontWeight: 500, letterSpacing: "-.03em", marginBottom: 8 }}>
                  ¡Tu carta se subió <span style={{ color: "var(--amber-2)", fontStyle: "italic" }}>correctamente</span>!
                </h2>
                <p style={{ color: "var(--cream-2)", fontSize: 14, lineHeight: 1.45, maxWidth: 380, margin: "0 auto" }}>
                  Déjanos tus datos para enviarte tu nueva carta digital lista.
                </p>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, color: "var(--muted)", marginBottom: 4, paddingLeft: 2, fontWeight: 700, textAlign: "left" }}>Nombre del local</label>
                  <input type="text" placeholder="Ej: Mi Restaurante" value={fbLocalName} onChange={(e) => { setFbLocalName(e.target.value); setFbError(""); }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, color: "var(--muted)", marginBottom: 4, paddingLeft: 2, fontWeight: 700, textAlign: "left" }}>Tu nombre</label>
                  <input type="text" placeholder="Ej: Juan Pérez" value={fbOwnerName} onChange={(e) => { setFbOwnerName(e.target.value); setFbError(""); }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, color: "var(--muted)", marginBottom: 4, paddingLeft: 2, fontWeight: 700, textAlign: "left" }}>Correo electrónico</label>
                  <input type="email" placeholder="tu@correo.com" value={fbEmail} onChange={(e) => { setFbEmail(e.target.value); setFbError(""); }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, color: "var(--muted)", marginBottom: 4, paddingLeft: 2, fontWeight: 700, textAlign: "left" }}>WhatsApp</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 10px", background: "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, color: "#E8DDC8", fontSize: 14, flexShrink: 0 }}>
                      <svg width="20" height="14" viewBox="0 0 20 14" style={{ borderRadius: 2, flexShrink: 0 }}><rect width="20" height="7" fill="#fff"/><rect y="7" width="20" height="7" fill="#D52B1E"/><rect width="7" height="7" fill="#0039A6"/><polygon points="3.5,1.5 4.1,3.3 6,3.3 4.5,4.4 5,6.2 3.5,5.1 2,6.2 2.5,4.4 1,3.3 2.9,3.3" fill="#fff"/></svg>
                      <span style={{ fontWeight: 600 }}>+56</span>
                    </div>
                    <input type="tel" placeholder="9 1234 5678" value={fbWhatsapp} onChange={(e) => { setFbWhatsapp(formatFbPhone(e.target.value)); setFbError(""); }} style={{ flex: 1 }} />
                  </div>
                </div>
              </div>

              {fbError && (
                <div style={{ color: "#e85d5d", fontSize: 14, textAlign: "center", marginTop: 10 }}>
                  {fbError}
                </div>
              )}

              <button type="button" className="cta" onClick={handleFallbackSubmit} disabled={fbLoading} style={{ opacity: fbLoading ? 0.6 : 1 }}>
                {fbLoading ? "Enviando..." : "Recibir mi nueva carta"} <span>→</span>
              </button>
              <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, marginTop: 10 }}>Solo usaremos tus datos para enviar tu nueva carta.</p>
            </div>
          </section>
        )}

        {/* Fallback success */}
        {fbDone && (
          <section className="shell centered-shell" style={{ marginTop: 24, animation: "fallbackReveal 0.6s cubic-bezier(0.16,1,0.3,1) both" }}>
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(67,209,123,.12)", border: "1px solid rgba(67,209,123,.3)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
                <svg viewBox="0 0 24 24" fill="none" width="32" height="32"><path d="M5 13l4 4L19 7" stroke="#43d17b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 7vw, 36px)", lineHeight: 1, fontWeight: 500, letterSpacing: "-.03em", marginBottom: 10 }}>
                ¡Recibimos tu carta!
              </h2>
              <p style={{ color: "var(--cream-2)", fontSize: 15, lineHeight: 1.5, maxWidth: 400, margin: "0 auto" }}>
                Estamos preparando tu nueva carta digital. Te enviaremos todo listo a <strong style={{ color: "var(--cream)" }}>{fbEmail}</strong>.
              </p>
              <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 14 }}>Puedes cerrar esta página.</p>
            </div>
          </section>
        )}
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
.steps { display: flex; align-items: center; justify-content: center; gap: 0; margin: 8px auto 12px; max-width: 480px; }
.step { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 13px; }
.step-line { width: 28px; height: 1px; background: rgba(232,163,61,.15); margin: 0 6px; }
.step-number { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 600; border: 1px solid rgba(232,163,61,.2); background: transparent; color: var(--muted); }
.step.active { color: var(--amber-2); }
.step.active .step-number { color: var(--amber-2); border-color: var(--amber); background: rgba(232,163,61,.1); }
.shell { border: 1px solid var(--line); background: linear-gradient(180deg, rgba(14,11,8,.86), rgba(14,11,8,.62)); border-radius: 28px; padding: 24px; box-shadow: 0 28px 90px rgba(0,0,0,.38); backdrop-filter: blur(14px); position: relative; overflow: hidden; }
.centered-shell { max-width: 760px; margin: 0 auto; text-align: center; }
.shell::before { content: ''; position: absolute; width: 360px; height: 360px; right: -140px; top: 140px; border-radius: 50%; background: radial-gradient(circle, rgba(232,163,61,.16), transparent 70%); filter: blur(8px); pointer-events: none; }
h1 { font-family: var(--font-display); font-size: clamp(44px, 11.8vw, 67px); line-height: .94; font-weight: 500; letter-spacing: -.035em; margin-bottom: 18px; }
h1 span { color: var(--amber-2); font-style: italic; }
.method-title { text-align: center; margin: 28px 0 14px; color: var(--cream-2); }
.first-title { margin-top: 0; color: var(--cream-2); font-weight: 500; font-size: 19px; }
.centered-form { max-width: 620px; margin: 0 auto; }
.methods { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.method { border: 1px solid var(--line); background: rgba(255,255,255,.035); border-radius: 14px; padding: 12px 8px; text-align: center; min-height: 100px; display: grid; align-content: center; gap: 6px; color: var(--cream); cursor: pointer; transition: border-color .2s ease, background .2s ease, transform .2s ease; }
.method strong { margin-bottom: -4px; }
.method span { line-height: 1.1; }
.method:hover, .method.active { transform: translateY(-2px); border-color: var(--line-strong); background: rgba(232,163,61,.075); }
.method svg { width: 26px; height: 26px; margin: 0 auto; color: var(--amber-2); }
.method span { font-size: 13px; color: var(--cream-2); }
.input-panel { margin-top: 18px; }
.upload-card { margin-top: 20px; border: 1px dashed rgba(244,189,105,.75); background: radial-gradient(circle at 50% 0%, rgba(232,163,61,.12), transparent 42%), rgba(255,255,255,.035); border-radius: 24px; min-height: 230px; display: grid; place-items: center; text-align: center; padding: 32px 20px; box-shadow: inset 0 0 50px rgba(232,163,61,.055), 0 0 34px rgba(232,163,61,.08); transition: transform .22s ease, border-color .22s ease, background .22s ease; }
.compact-upload { margin-top: 18px; min-height: 160px; padding: 24px 20px; }
.upload-card:hover { transform: translateY(-2px); border-color: var(--amber-2); background: radial-gradient(circle at 50% 0%, rgba(232,163,61,.18), transparent 44%), rgba(255,255,255,.052); }
.upload-icon { width: 50px; height: 50px; margin: 0 auto 2px; display: grid; place-items: center; color: var(--amber-2); }
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
@media (min-width: 860px) { .page { padding-top: 80px; } .steps { width: 560px; margin: 0 auto 16px; } .shell { padding: 46px; } h1 { font-size: 64px; } .methods { gap: 14px; } }
@media (max-width: 390px) { h1 { font-size: 40px; } .methods { grid-template-columns: 1fr; } .method { min-height: 98px; } }
@keyframes loadingDots { 0% { content: '.'; } 33% { content: '..'; } 66% { content: '...'; } }
.loading-dots::after { content: '.'; animation: loadingDots 1.2s steps(1) infinite; }
@keyframes fallbackReveal { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
.social-proof { text-align: center; margin: 32px auto 0; max-width: 620px; }
.social-proof-title { font-family: var(--font-display); font-size: 20px; color: var(--cream-2); font-weight: 500; letter-spacing: -.01em; margin-bottom: 16px; }
.social-proof-logos { display: flex; justify-content: center; align-items: center; gap: 14px; flex-wrap: wrap; }
.social-proof-logo { width: 52px; height: 52px; border-radius: 14px; overflow: hidden; border: 1px solid rgba(242,229,207,.1); background: rgba(255,255,255,.04); display: grid; place-items: center; transition: transform .2s, border-color .2s; }
.social-proof-logo:hover { transform: scale(1.1); border-color: rgba(232,163,61,.4); }
.social-proof-logo img { width: 100%; height: 100%; object-fit: cover; }
.social-proof-fallback { width: 100%; height: 100%; display: grid; place-items: center; color: #fff; font-size: 14px; font-weight: 700; letter-spacing: .03em; }
.social-proof-sub { font-size: 11px; color: rgba(136,123,104,.65); margin-top: 10px; }
`;
