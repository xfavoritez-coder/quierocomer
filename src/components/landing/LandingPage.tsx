"use client";
import { useState, useRef } from "react";
import LandingFooter from "@/components/landing/LandingFooter";

// ─── Upload helpers ───────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  // Modal state
  const [ucOpen, setUcOpen] = useState(false);
  const [ucStep, setUcStep] = useState<"options" | "link" | "photo" | "scratch">("options");
  const [ucLink, setUcLink] = useState("");
  const [ucFiles, setUcFiles] = useState<File[]>([]);
  const [ucFileName, setUcFileName] = useState("");
  const [ucLoading, setUcLoading] = useState(false);
  const [ucError, setUcError] = useState("");
  const [ucProgress, setUcProgress] = useState("");
  // Scratch (crear desde cero) form
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
  const openModal = () => { setUcOpen(true); resetModal(); document.body.style.overflow = "hidden"; };
  const closeModal = () => { setUcOpen(false); document.body.style.overflow = ""; };

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
    if (ucLoading) return;
    setUcLoading(true); setUcError("");
    try {
      if (ucStep === "scratch") {
        if (!ucScratchName.trim() || !ucScratchEmail.trim() || !ucScratchEmail.includes("@")) {
          setUcError("Completa el nombre del local y el correo."); setUcLoading(false); return;
        }
        const res = await fetch("/api/activar/registrar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            localName: ucScratchName.trim(),
            ownerName: ucScratchOwner.trim() || undefined,
            email: ucScratchEmail.trim(),
            whatsapp: ucScratchWA.trim() ? `+56${ucScratchWA.replace(/\D/g, "")}` : undefined,
          }),
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
        const total = Math.min(ucFiles.length, 10);
        let leadId = "";
        for (let i = 0; i < total; i++) {
          setUcProgress(total > 1 ? `Procesando foto ${i + 1} de ${total}` : "Procesando foto");
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
        : `Error: ${err?.message || "conexión fallida"}`;
      setUcError(msg);
      setUcLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        :root {
          --yellow: #F59E1B;
          --yellow-hover: #E08D0C;
          --ink: #111111;
          --muted: #73736D;
          --paper: #FCFBF7;
          --white: #FFFFFF;
          --line: #EAE8E1;
          --max: 1080px;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }

        body {
          background: var(--paper);
          color: var(--ink);
          font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        a { color: inherit; text-decoration: none; }
        button, input { font: inherit; }

        .lp-container {
          width: min(calc(100% - 32px), var(--max));
          margin: 0 auto;
        }

        /* NAV */
        .lp-header {
          height: 76px;
          display: flex;
          align-items: center;
          border-bottom: 1px solid var(--line);
          background: rgba(252,251,247,.94);
          backdrop-filter: blur(12px);
          position: sticky;
          top: 0;
          z-index: 40;
        }

        .lp-logo {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-size: 22px;
          font-weight: 850;
          letter-spacing: -.04em;
          text-decoration: none;
          color: var(--ink);
        }

        /* HERO */
        .lp-hero { padding: 104px 0 72px; text-align: center; }

        .lp-eyebrow {
          margin-bottom: 18px;
          color: #8A897F;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .lp-hero h1 {
          max-width: 900px;
          margin: 0 auto;
          font-size: clamp(54px, 7vw, 96px);
          line-height: .92;
          letter-spacing: -.07em;
          font-weight: 850;
        }

        .lp-hero-sub {
          max-width: 650px;
          margin: 24px auto 0;
          color: var(--muted);
          font-size: 18px;
          line-height: 1.55;
          letter-spacing: -.01em;
        }

        .lp-hero-cta {
          margin-top: 34px;
          display: flex;
          justify-content: center;
        }

        .lp-btn {
          border: 0;
          border-radius: 16px;
          background: var(--yellow);
          color: #fff;
          min-width: 270px;
          min-height: 64px;
          padding: 0 30px;
          font-size: 18px;
          font-weight: 850;
          letter-spacing: -.02em;
          cursor: pointer;
          box-shadow: 0 12px 34px rgba(245,158,27,.28);
          transition: .18s ease;
        }

        .lp-btn:hover {
          background: var(--yellow-hover);
          transform: translateY(-2px);
          box-shadow: 0 16px 40px rgba(245,158,27,.38);
        }

        .lp-nav-ingresar {
          font-size: 14px;
          font-weight: 600;
          color: var(--ink);
          text-decoration: none;
          padding: 8px 18px;
          border: 1.5px solid var(--line);
          border-radius: 10px;
          background: transparent;
          transition: border-color .15s, background .15s;
          white-space: nowrap;
        }
        .lp-nav-ingresar:hover { border-color: #bbb; background: #f5f5f5; }

        /* VIDEO */
        .lp-video-section {
          background: #F5F2EB;
          padding: 58px 0 86px;
          border-top: 1px solid rgba(0,0,0,.04);
        }
        .lp-video-head {
          text-align: center;
          margin-bottom: 28px;
        }
        .lp-video-head h2 {
          margin: 0;
          font-size: 25px;
          font-weight: 800;
          letter-spacing: -.04em;
          line-height: 1.15;
          color: var(--ink);
        }
        .lp-video-head p {
          margin: 8px 0 0;
          color: #8C8982;
          font-size: 15px;
          letter-spacing: .01em;
        }
        .lp-video-wrap { width: min(100%, 900px); margin: 0 auto; }
        .lp-video-card {
          position: relative;
          overflow: hidden;
          aspect-ratio: 16/9;
          border-radius: 26px;
          background: #111;
          box-shadow: 0 24px 80px rgba(0,0,0,.10);
        }
        .lp-video-placeholder {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at 50% 35%, rgba(255,212,0,.18), transparent 26%),
            linear-gradient(145deg, #202020 0%, #0E0E0E 100%);
          color: white;
        }
        .lp-video-center { max-width: 590px; padding: 34px; text-align: center; }
        .lp-play {
          width: 74px; height: 74px; margin: 0 auto 24px;
          border: 0; border-radius: 50%;
          background: var(--yellow); color: #111;
          display: grid; place-items: center;
          font-size: 22px; cursor: pointer;
          box-shadow: 0 14px 36px rgba(0,0,0,.24);
        }
        .lp-video-center strong {
          display: block;
          font-size: clamp(26px, 3vw, 40px);
          line-height: 1.04;
          letter-spacing: -.045em;
          font-weight: 800;
        }
        .lp-video-center span {
          display: block;
          margin-top: 12px;
          color: rgba(255,255,255,.58);
          font-size: 13px;
        }

        /* MODAL */
        .lp-velo {
          position: fixed;
          inset: 0;
          background: rgba(17,17,17,.58);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 90;
          padding: 24px;
          animation: lpFadeIn .2s ease;
        }
        @keyframes lpFadeIn { from { opacity: 0; } to { opacity: 1; } }

        .lp-modal {
          background: var(--white);
          border-radius: 24px;
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          overflow-y: auto;
          padding: 80px 34px 32px;
          position: relative;
          text-align: center;
          box-shadow: 0 30px 90px rgba(0,0,0,.32);
          animation: lpSlideUp .22s ease;
        }
        @keyframes lpSlideUp { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .lp-modal h3 {
          margin: 0 0 28px;
          font-size: 28px;
          font-weight: 850;
          letter-spacing: -.045em;
          line-height: 1.08;
          color: var(--ink);
        }

        .lp-cerrar {
          position: absolute; top: 20px; right: 20px;
          background: none; border: 0; cursor: pointer;
          font-size: 26px; line-height: 1;
          color: #A09F97;
          width: 38px; height: 38px; border-radius: 50%;
          transition: .15s ease;
          display: flex; align-items: center; justify-content: center;
        }
        .lp-cerrar:hover { background: var(--paper); color: var(--ink); }

        .lp-volver {
          position: absolute; top: 20px; left: 20px;
          background: none; border: 0; cursor: pointer;
          font-size: 14px; font-weight: 700;
          color: var(--muted);
          padding: 9px 12px; border-radius: 10px;
          transition: .15s ease;
        }
        .lp-volver:hover { background: var(--paper); color: var(--ink); }

        .lp-opcion {
          display: flex;
          align-items: center;
          gap: 16px;
          width: 100%;
          text-align: left;
          color: var(--ink);
          background: var(--white);
          border: 1.5px solid var(--line);
          border-radius: 16px;
          padding: 18px 20px;
          margin-bottom: 10px;
          cursor: pointer;
          transition: .15s ease;
        }
        .lp-opcion:hover { border-color: var(--ink); background: var(--paper); transform: translateY(-1px); }
        .lp-opcion svg { flex-shrink: 0; opacity: .7; }
        .lp-opcion-text { display: flex; flex-direction: column; gap: 2px; flex: 1; }
        .lp-opcion-title { font-size: 16px; font-weight: 700; letter-spacing: -.02em; }
        .lp-opcion-sub { font-size: 12px; color: var(--muted); font-weight: 400; }
        .lp-hint { font-size: 13px; color: var(--muted); margin-bottom: 14px; line-height: 1.5; }
        .lp-campo-label { display: block; font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 6px; text-align: left; }
        .lp-scratch-grid { display: grid; gap: 12px; text-align: left; margin-bottom: 14px; }

        /* SHOWCASE */
        .lp-showcase { padding: 96px 0 100px; }
        .lp-showcase-eyebrow {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: #A3A098;
          margin-bottom: 50px;
        }
        .lp-logos-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          max-width: 680px;
          margin: 0 auto;
        }
        .lp-logo-card {
          min-height: 165px;
          border: 1px solid var(--line);
          border-radius: 20px;
          background: rgba(255,255,255,.6);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 18px 12px;
          text-decoration: none;
          transition: .18s ease;
        }
        .lp-logo-card:hover { border-color: #bbb; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.07); }
        .lp-logo-card img { width: 66px; height: 66px; border-radius: 18px; object-fit: cover; }
        .lp-logo-card span { font-size: 14px; font-weight: 500; color: #76736D; text-align: center; line-height: 1.3; }

        .lp-campo {
          width: 100%;
          border: 1.5px solid var(--line);
          border-radius: 14px;
          padding: 18px 20px;
          font-size: 16px;
          background: var(--paper);
          margin-bottom: 14px;
          text-align: left;
          outline: none;
          transition: .15s ease;
          display: block;
        }
        .lp-campo:focus { border-color: var(--ink); background: var(--white); }

        .lp-modal-btn {
          width: 100%;
          min-height: 56px;
          border: 0;
          border-radius: 14px;
          background: var(--yellow);
          color: #fff;
          font-size: 17px;
          font-weight: 850;
          letter-spacing: -.02em;
          cursor: pointer;
          transition: .18s ease;
          box-shadow: 0 8px 24px rgba(245,158,27,.22);
        }
        .lp-modal-btn:hover:not(:disabled) { background: var(--yellow-hover); transform: translateY(-1px); }
        .lp-modal-btn:disabled { opacity: .5; cursor: default; transform: none; }

        .lp-dropzone {
          border: 1.5px dashed rgba(17,17,17,.2);
          background: var(--paper);
          border-radius: 18px;
          padding: 32px 20px;
          margin-bottom: 16px;
          cursor: pointer;
          transition: .18s ease;
          text-align: center;
        }
        .lp-dropzone:hover { border-color: var(--ink); }

        .lp-thumbs { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 10px; }
        .lp-thumb { position: relative; width: 64px; height: 64px; border-radius: 10px; overflow: hidden; border: 1px solid var(--line); flex-shrink: 0; }
        .lp-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .lp-thumb-del {
          position: absolute; top: 2px; right: 2px;
          width: 20px; height: 20px; border-radius: 50%;
          background: rgba(0,0,0,.55); border: none; color: #fff;
          font-size: 12px; cursor: pointer; display: grid; place-items: center; padding: 0;
        }

        .lp-error { color: #e85d5d; font-size: 14px; margin-bottom: 12px; }

        @media (max-width: 760px) {
          .lp-container { width: min(calc(100% - 48px), var(--max)); }
          .lp-header { height: 64px; }
          .lp-logo { font-size: 20px; }
          .lp-logo-mark { width: 30px; height: 30px; }
          .lp-hero { padding: 72px 0 48px; }
          .lp-hero h1 { font-size: clamp(48px, 15vw, 68px); }
          .lp-hero-sub { font-size: 16px; }
          .lp-btn { width: 100%; min-width: 0; min-height: 60px; }
          .lp-video-section { padding: 44px 0 60px; }
          .lp-video-card { border-radius: 20px; aspect-ratio: 4/3; }
          .lp-logos-grid { grid-template-columns: repeat(2, 1fr); }
          .lp-showcase { padding: 72px 0 80px; }
          .lp-video-center { padding: 22px; }
          .lp-play { width: 62px; height: 62px; }
          .lp-modal { padding: 76px 22px 26px; }
          .lp-modal h3 { font-size: 24px; }
        }

        @media (max-width: 420px) {
          .lp-container { width: min(calc(100% - 40px), var(--max)); }
          .lp-hero { padding-top: 58px; }
          .lp-hero h1 { font-size: 48px; }
          .lp-eyebrow { font-size: 10px; }
        }

        @media (prefers-reduced-motion: reduce) {
          * { transition: none !important; animation: none !important; }
          html { scroll-behavior: auto; }
        }

        :focus-visible { outline: 3px solid var(--yellow); outline-offset: 3px; }
      `}</style>

      {/* HEADER */}
      <header className="lp-header">
        <div className="lp-container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="/" className="lp-logo" aria-label="QuieroComer">
            <img src="/logo.png" alt="" style={{ width: 30, height: 30, objectFit: "contain", flexShrink: 0 }} />
            <span>QuieroComer</span>
          </a>
          <a href="/panel" className="lp-nav-ingresar">Ingresar</a>
        </div>
      </header>

      <main style={{ textAlign: "center" }}>

        {/* HERO */}
        <section className="lp-hero">
          <div className="lp-container">
            <h1 style={{ maxWidth: 900, margin: "0 auto", fontSize: "clamp(54px, 7vw, 96px)", lineHeight: .92, letterSpacing: "-.07em", fontWeight: 850 }}>
              Tu local puede vender más.
            </h1>

            <p className="lp-hero-sub">
              Transforma tu carta actual en una herramienta que aumenta tus ventas y mejora la experiencia de tus clientes.
            </p>

            <div className="lp-hero-cta">
              <button className="lp-btn" onClick={openModal}>
                Subir mi carta
              </button>
            </div>
          </div>
        </section>

        {/* VIDEO (placeholder) */}
        <section className="lp-video-section">
          <div className="lp-container">
            <div className="lp-video-head">
              <h2>Mira cómo funciona</h2>
              <p>En menos de 1 minuto.</p>
            </div>
            <div className="lp-video-wrap">
              <div className="lp-video-card">
                <div className="lp-video-placeholder">
                  <div className="lp-video-center">
                    <button className="lp-play" aria-label="Ver cómo funciona">▶</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SHOWCASE */}
        <section className="lp-showcase">
          <div className="lp-container">
            <p className="lp-showcase-eyebrow">Locales que ya usan QuieroComer</p>
            <div className="lp-logos-grid">
              {[
                { name: "Hand Roll", slug: "hand-roll", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/restaurants/hand-roll/logo.png" },
                { name: "Horus Vegan", slug: "horusvegan", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/restaurants/horusvegan/logo.png" },
                { name: "Juana la Brava", slug: "juana-la-brava", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1779212065016-vn71iczuzue.jpg" },
                { name: "Alleria Pizza", slug: "alleria-pizza", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1777477859043-9ibluljyt89.png" },
                { name: "El Menú de la Esquina", slug: "el-menu-de-la-esquina", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1787507811438-ffgc0wfstb.webp" },
                { name: "Guffsushi Nikkei", slug: "guffsushi", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1781291439973-bzmbjnjzwo.webp" },
                { name: "La Oveja Negra", slug: "la-oveja-negra-restaurante", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1781573105032-to2loqezh47.webp" },
                { name: "Alleria Delivery", slug: "alleria-delivery", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1777477859043-9ibluljyt89.png" },
                { name: "Entre Pisco Y Pebre", slug: "entre-pisco-y-pebre", logo: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1785560529971-6n72tdb1cf7.webp" },
                { name: "Avenida Del Sabor", slug: "avenida-del-sabor", logo: "https://fudo-apps-storage.s3.sa-east-1.amazonaws.com/production/368718/images/4a39edf4-2e03-44fd-86c0-195f9762caec" },
                { name: "Haruna", slug: "haruna", logo: "https://bjpqzmzciinnrwpofyrf.supabase.co/storage/v1/object/public/images/270e2313-2be3-4790-85a8-876e64f7bcd1/logos/1778689321363-C109DBC8-DAE3-4CF4-9C5A-E5577B6AAED5--1-.png" },
              ].map((r) => (
                <a key={r.slug} href={`https://quierocomer.com/${r.slug}`} target="_blank" rel="noopener noreferrer" className="lp-logo-card">
                  <img src={r.logo} alt={r.name} loading="lazy" />
                  <span>{r.name}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

      </main>

      <LandingFooter />

      {/* FILE INPUT */}
      <input
        ref={photoRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.pdf"
        multiple
        style={{ display: "none" }}
        onChange={handleFileSelect}
      />

      {/* MODAL */}
      {ucOpen && (
        <div
          className="lp-velo"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="lp-modal" role="dialog" aria-modal="true">
            {ucStep !== "options" && (
              <button
                className="lp-volver"
                onClick={() => { setUcStep("options"); setUcError(""); setUcFiles([]); setUcFileName(""); setUcLink(""); }}
              >
                ← Volver
              </button>
            )}
            <button className="lp-cerrar" onClick={closeModal} aria-label="Cerrar">×</button>

            {/* STEP 1: elegir método */}
            {ucStep === "options" && (
              <>
                <h3>¿Cómo tienes tu carta?</h3>

                <button className="lp-opcion" onClick={() => { setUcStep("link"); setUcError(""); }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round">
                    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/>
                    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>
                  </svg>
                  <span className="lp-opcion-text">
                    <span className="lp-opcion-title">Tengo un link</span>
                    <span className="lp-opcion-sub">De mi carta QR, web o menú online</span>
                  </span>
                </button>

                <button className="lp-opcion" onClick={() => { setUcStep("photo"); setUcError(""); }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span className="lp-opcion-text">
                    <span className="lp-opcion-title">Tengo fotos</span>
                    <span className="lp-opcion-sub">Fotos de la carta física, tomadas con el celular</span>
                  </span>
                </button>

                <button className="lp-opcion" style={{ marginBottom: 0 }} onClick={() => { setUcStep("scratch"); setUcError(""); }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                  </svg>
                  <span className="lp-opcion-text">
                    <span className="lp-opcion-title">Crear desde cero</span>
                    <span className="lp-opcion-sub">Arrancamos con platos de ejemplo y tú la personalizas</span>
                  </span>
                </button>
              </>
            )}

            {/* STEP 2: link */}
            {ucStep === "link" && (
              <>
                <h3>Pega el link de tu carta</h3>
                <p className="lp-hint">Puede ser tu carta web, el link de tu QR, o cualquier menú online.</p>
                <input
                  className="lp-campo"
                  type="url"
                  placeholder="https://turestaurante.cl/carta"
                  value={ucLink}
                  onChange={(e) => { setUcLink(e.target.value); setUcError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                  autoFocus
                />
                {ucError && <div className="lp-error">{ucError}</div>}
                <button
                  className="lp-modal-btn"
                  onClick={handleSubmit}
                  disabled={ucLoading || !ucLink.trim()}
                >
                  {ucLoading ? (ucProgress || "Procesando...") : "Transformar mi carta →"}
                </button>
              </>
            )}

            {/* STEP 3: fotos */}
            {ucStep === "photo" && (
              <>
                <h3>Sube fotos de tu carta</h3>
                <p className="lp-hint">Pueden ser fotos tomadas con el celular de tu carta física o pizarra. JPG, PNG · Máx. 10 fotos · 50MB.</p>
                {ucFiles.length === 0 ? (
                  <div className="lp-dropzone" onClick={() => photoRef.current?.click()}>
                    <div style={{ fontSize: 34, marginBottom: 8 }}>📷</div>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>Toca para seleccionar fotos</div>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>O arrastra aquí los archivos</div>
                  </div>
                ) : (
                  <>
                    <div className="lp-thumbs">
                      {ucFiles.map((f, i) => (
                        <div key={i} className="lp-thumb">
                          {f.type.startsWith("image/") ? (
                            <img src={URL.createObjectURL(f)} alt={f.name} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: "#F5F5F3", fontSize: 10, color: "#666", fontWeight: 700 }}>PDF</div>
                          )}
                          <button
                            className="lp-thumb-del"
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
                    <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>{ucFileName}</div>
                  </>
                )}
                {ucError && <div className="lp-error">{ucError}</div>}
                <button
                  className="lp-modal-btn"
                  onClick={ucFiles.length > 0 ? handleSubmit : () => photoRef.current?.click()}
                  disabled={ucLoading}
                >
                  {ucLoading
                    ? (ucProgress || "Subiendo...")
                    : ucFiles.length > 0 ? "Transformar mi carta →" : "Seleccionar fotos"}
                </button>
              </>
            )}

            {/* STEP 4: crear desde cero */}
            {ucStep === "scratch" && (
              <>
                <h3>Creamos tu carta desde cero</h3>
                <p className="lp-hint">Armamos una carta con platos de ejemplo y tú la editas desde tu panel. Listo en minutos.</p>
                <div className="lp-scratch-grid">
                  <div>
                    <label className="lp-campo-label">Nombre del local *</label>
                    <input
                      className="lp-campo"
                      type="text"
                      placeholder="Ej: Mi Restaurante"
                      value={ucScratchName}
                      onChange={(e) => { setUcScratchName(e.target.value); setUcError(""); }}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="lp-campo-label">Tu nombre</label>
                    <input
                      className="lp-campo"
                      type="text"
                      placeholder="Ej: Juan Pérez"
                      value={ucScratchOwner}
                      onChange={(e) => setUcScratchOwner(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="lp-campo-label">Correo electrónico *</label>
                    <input
                      className="lp-campo"
                      type="email"
                      placeholder="tu@correo.com"
                      value={ucScratchEmail}
                      onChange={(e) => { setUcScratchEmail(e.target.value); setUcError(""); }}
                    />
                  </div>
                  <div>
                    <label className="lp-campo-label">WhatsApp</label>
                    <input
                      className="lp-campo"
                      type="tel"
                      placeholder="9 1234 5678"
                      value={ucScratchWA}
                      onChange={(e) => setUcScratchWA(e.target.value)}
                    />
                  </div>
                </div>
                {ucError && <div className="lp-error">{ucError}</div>}
                <button
                  className="lp-modal-btn"
                  onClick={handleSubmit}
                  disabled={ucLoading || !ucScratchName.trim() || !ucScratchEmail.includes("@")}
                >
                  {ucLoading ? "Creando..." : "Crear mi carta →"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
