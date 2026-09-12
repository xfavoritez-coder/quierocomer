"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { normalizePhone } from "@/lib/normalizePhone";
import { trackCartaInfo, trackLead } from "@/lib/metaPixel";
import { trackFunnelEvent } from "@/lib/funnelTracker";
import { resumeAdTracker } from "@/lib/adTracker";
import Footer from "@/components/Footer";
import PlanesModal from "@/components/PlanesModal";

const PROGRESS_STEPS = [
  { label: "Detectando platos y categorías", duration: 3500 },
  { label: "Ordenando la información de tu carta", duration: 4500 },
  { label: "Preparando tu nueva carta", duration: 6000 },
];

/** Non-linear easing — slows down around 40% and 75% to feel like real processing */
function easeProgress(linear: number): number {
  if (linear < 0.35) return linear * 1.1;
  if (linear < 0.45) return 0.385 + (linear - 0.35) * 0.35;  // slow zone ~40%
  if (linear < 0.7) return 0.42 + (linear - 0.45) * 1.12;
  if (linear < 0.8) return 0.7 + (linear - 0.7) * 0.5;       // slow zone ~75%
  return 0.75 + (linear - 0.8) * 1.25;
}

export default function Paso2Client() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const leadId = searchParams.get("id");

  const [cartaUrl, setCartaUrl] = useState<string | null>(null);
  const [pillMetaIndex, setPillMetaIndex] = useState(0);
  const [cartaFileUrl, setCartaFileUrl] = useState<string | null>(null);
  const [cartaType, setCartaType] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(0);
  const [animDone, setAnimDone] = useState(false);

  const [localName, setLocalName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 9);
    if (d.length <= 1) return d;
    if (d.length <= 5) return `${d[0]} ${d.slice(1)}`;
    return `${d[0]} ${d.slice(1, 5)} ${d.slice(5)}`;
  };
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phoneWarning, setPhoneWarning] = useState("");
  const [emailWarning, setEmailWarning] = useState("");
  const [emailWarningType, setEmailWarningType] = useState<"active" | "demo" | null>(null);
  const [emailWarningDismissed, setEmailWarningDismissed] = useState(false);
  const [planesOpen, setPlanesOpen] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const formSectionRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Force scroll to top — blast through every timing slot Next.js might use to restore scroll
  useLayoutEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);
  useEffect(() => {
    document.documentElement.style.scrollBehavior = "auto";
    const scrollUp = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    scrollUp();
    // Hammer scroll-to-top across multiple frames and rAF to beat async scroll restoration
    const times = [0, 16, 50, 100, 200, 400, 800];
    const ids = times.map(ms => setTimeout(() => {
      scrollUp();
      if (ms === times[times.length - 1]) document.documentElement.style.scrollBehavior = "";
    }, ms));
    // Also use rAF chain for the first few frames
    let rafCount = 0;
    const raf = () => { scrollUp(); if (++rafCount < 5) requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    trackFunnelEvent(leadId, "paso2_loaded");
    resumeAdTracker();
    return () => ids.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!leadId) return;

    // Fire only preview here (~15s with Haiku)
    // Full process fires from confirmation page to avoid blocking PATCH
    fetch("/api/subircarta/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId }),
    }).catch(() => {});

    fetch(`/api/subircarta/${leadId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.email) {
          router.replace(`/subircarta/confirmacion?id=${leadId}`);
          return;
        }
        if (data.cartaUrl) setCartaUrl(data.cartaUrl);
        if (data.cartaFileUrl) setCartaFileUrl(data.cartaFileUrl);
        if (data.cartaType) setCartaType(data.cartaType);
      })
      .catch(() => {});
  }, [leadId, router]);

  // Progress animation — skip if already seen for this lead
  useEffect(() => {
    const storageKey = `subircarta_anim_${leadId}`;
    if (sessionStorage.getItem(storageKey)) {
      setProgress(100);
      setCompletedSteps(PROGRESS_STEPS.length);
      setAnimDone(true);
      return;
    }

    let cancelled = false;
    const totalDuration = PROGRESS_STEPS.reduce((s, st) => s + st.duration, 0);
    const startTime = Date.now();

    const tick = () => {
      if (cancelled) return;
      const elapsed = Date.now() - startTime;
      const linear = Math.min(elapsed / totalDuration, 1);
      const eased = easeProgress(linear);
      setProgress(Math.min(Math.round(eased * 100), 100));

      let done = 0;
      let acc = 0;
      for (const step of PROGRESS_STEPS) {
        acc += step.duration;
        if (elapsed >= acc + 800) done++;
      }
      setCompletedSteps(done);

      if (linear < 1) {
        requestAnimationFrame(tick);
      } else {
        setTimeout(() => {
          if (!cancelled) {
            setCompletedSteps(PROGRESS_STEPS.length);
            sessionStorage.setItem(storageKey, "1");
            setTimeout(() => { if (!cancelled) setAnimDone(true); }, 600);
          }
        }, 900);
      }
    };

    requestAnimationFrame(tick);
    return () => { cancelled = true; };
  }, []);

  // Rotate pill meta text during animation
  useEffect(() => {
    if (animDone) return;
    const interval = setInterval(() => setPillMetaIndex((i) => i + 1), 2800);
    return () => clearInterval(interval);
  }, [animDone]);

  // When animation done, scroll to form and focus
  useEffect(() => {
    if (!animDone) return;
    const t = setTimeout(() => {
      const el = formSectionRef.current;
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top, behavior: "smooth" });
      }
      setTimeout(() => firstInputRef.current?.focus(), 400);
    }, 300);
    return () => clearTimeout(t);
  }, [animDone]);

  // Exit-intent modal — custom message when user tries to leave
  const [submitted, setSubmitted] = useState(false);
  const [exitModal, setExitModal] = useState(false);
  const exitShownRef = useRef(false);
  useEffect(() => {
    if (!animDone || submitted) return;
    // Desktop: mouse leaves viewport from the top
    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 5 && !exitShownRef.current) {
        exitShownRef.current = true;
        setExitModal(true);
      }
    };
    // Mobile: tab hidden / app switch
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && !exitShownRef.current) {
        exitShownRef.current = true;
        setExitModal(true);
      }
    };
    // Fallback: native beforeunload
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [animDone, submitted]);

  const handleSubmit = async () => {
    if (loading) return;
    if (!localName.trim() || !ownerName.trim() || !email.trim()) {
      setError("Completa todos los campos.");
      return;
    }

    setLoading(true);
    setError("");
    setPhoneWarning("");

    // Check for duplicate email (active non-demo restaurant)
    if (!emailWarningDismissed) {
      try {
        const checkRes = await fetch(`/api/subircarta/check-email?email=${encodeURIComponent(email.trim())}`);
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.hasActive) {
            setEmailWarning("Ya tienes una carta activa con este correo.");
            setEmailWarningType("active");
            setLoading(false);
            return;
          }
          if (checkData.isDemo) {
            setEmailWarning("Ya tienes una carta en proceso con este correo.");
            setEmailWarningType("demo");
            setLoading(false);
            return;
          }
        }
      } catch {
        // If check fails, proceed anyway
      }
    }

    const rawWa = whatsapp.trim();
    if (!rawWa) {
      setError("El WhatsApp es obligatorio.");
      setLoading(false);
      return;
    }
    const normalizedWa = normalizePhone(rawWa);
    if (!normalizedWa) {
      setError("El número de WhatsApp no es válido. Ingresa los 9 dígitos.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/subircarta/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localName: localName.trim(),
          ownerName: ownerName.trim(),
          email: email.trim(),
          whatsapp: rawWa || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        trackFunnelEvent(leadId, "paso2_error", { error: data.error });
        setError(data.error || "Error al guardar.");
        return;
      }

      trackFunnelEvent(leadId, "paso2_completed");
      trackCartaInfo();
      trackLead({ content_name: localName.trim() });
      setSubmitted(true);
      router.push(`/subircarta/confirmacion?id=${leadId}`);
    } catch (err: any) {
      trackFunnelEvent(leadId, "paso2_error", { error: err?.message || "conexión" });
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (!leadId) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: STYLES }} />
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
          <p>No se encontró la referencia. <a href="/subircarta" style={{ color: "#F59E1B" }}>Volver al paso 1</a></p>
        </div>
      </>
    );
  }

  const displayUrl = cartaUrl
    ? (() => { try { return new URL(cartaUrl).hostname; } catch { return cartaUrl; } })()
    : null;

  const displayFileName = cartaFileUrl
    ? decodeURIComponent(cartaFileUrl.split("/").pop() || "archivo")
    : null;

  const pillLabelBase = cartaType === "LINK" ? displayUrl : displayFileName;

  // Try to extract local name from URL path
  const localNameFromUrl = (() => {
    if (!cartaUrl) return null;
    try {
      const url = new URL(cartaUrl);
      const parts = url.pathname.split("/").filter(Boolean);
      // Skip generic paths like "pedir", "qr-menu", "store", "cl"
      const skip = new Set(["pedir", "qr-menu", "menu", "store", "cl", "es", "en"]);
      const candidate = parts.find(p => !skip.has(p) && p.length > 2 && !p.includes("?"));
      if (candidate) {
        return candidate.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      }
      // Fallback: use subdomain or domain name
      const host = url.hostname.replace(/^www\./, "").replace(/^menu\./, "").replace(/^coffee\./, "");
      const domainName = host.split(".")[0];
      if (domainName.length > 2) return domainName.charAt(0).toUpperCase() + domainName.slice(1);
    } catch {}
    return null;
  })();

  const pillLabelTexts = [
    pillLabelBase ? `Revisando ${pillLabelBase}` : "Revisando",
    localNameFromUrl ? `Leyendo carta de ${localNameFromUrl}` : "Leyendo tu carta",
    "Extrayendo platos y precios",
    "Traduciendo a otros idiomas",
    "Seleccionando platos destacados",
    "Configurando vistas",
  ];
  const pillLabel = animDone ? pillLabelBase : pillLabelTexts[pillMetaIndex % pillLabelTexts.length];
  const pillMetaTexts = [
    cartaType === "LINK" ? "Link recibido · listo para analizar" : cartaType === "PHOTO" ? "Foto recibida · lista para analizar" : "Archivo recibido · listo para analizar",
    "Accediendo a tu carta...",
    "Detectando categorías...",
    "Preparando tu nueva carta...",
  ];
  const pillMeta = animDone ? pillMetaTexts[0] : pillMetaTexts[pillMetaIndex % pillMetaTexts.length];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <main className="page">
        <nav className="nav-bar">
          <a href="/" className="nav-logo">
            <img src="/logo.png" alt="" style={{ height: 22, width: 22, objectFit: "contain" }} />
            QuieroComer
          </a>
          <a href="/panel" className="nav-ingresar">Ingresar</a>
        </nav>

        {/* Steps — step 1 done, step 2 active */}
        <section className="steps" aria-label="Progreso">
          <div className="step done"><div className="step-number">&#10003;</div><span>Subir carta</span></div>
          <div className="step-line" />
          <div className="step active"><div className="step-number">2</div><span>Transformación</span></div>
          <div className="step-line" />
          <div className="step"><div className="step-number">3</div><span>Carta viva</span></div>
        </section>

        <section className="shell centered-shell">
          <div className="center-copy">
            <h1 key={Math.min(completedSteps, 2)} style={{ animation: "titleFade .5s ease" }}>
              {animDone || completedSteps >= 2
                ? "Tu carta está lista"
                : completedSteps === 1
                ? "Transformando tu carta"
                : "Estamos revisando tu carta"}
            </h1>
            <p className="subcopy">
              {animDone ? "Lista para recibir. Solo faltan tus datos." : "Estamos leyendo tu carta y preparando una nueva versión."}
            </p>
          </div>

          <div className="centered-form">
            {/* File pill */}
            {pillLabel && (
              <div className="file-pill">
                <div className="file-ico">
                  {cartaType === "LINK" ? (
                    <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  ) : cartaType === "PHOTO" ? (
                    <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M6 8h3l2-3h2l2 3h3v12H6V8z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="14" r="3.5" stroke="currentColor" strokeWidth="1.8"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M8 2h8l4 4v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.8"/><path d="M16 2v4h4M10 10h4M10 14h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  )}
                </div>
                <div>
                  <div className="file-name" key={`title-${pillMetaIndex}`} style={{ animation: animDone ? "none" : "pillMetaFade 0.4s ease" }}>{pillLabel}</div>
                  <div className="file-meta" key={pillMetaIndex} style={{ animation: "pillMetaFade 0.4s ease" }}>{pillMeta}</div>
                </div>
              </div>
            )}

            {/* Progress */}
            <div className="progress-area">
              <div className="progress-head">
                <strong>Preparando tu carta</strong>
                <span>{progress}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="checks">
                {PROGRESS_STEPS.map((step, i) => (
                  <div key={i} className={`check${i < completedSteps ? "" : " pending"}`}>
                    {i < completedSteps ? (
                      <svg viewBox="0 0 20 20" width="15" height="15" fill="none"><circle cx="10" cy="10" r="10" fill="#43d17b"/><path d="M6 10.5l2.5 2.5L14 8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    ) : (
                      <svg viewBox="0 0 20 20" width="15" height="15" fill="none"><circle cx="10" cy="10" r="9" stroke="#F59E1B" strokeWidth="2"/><path d="M10 6v4l2 2" stroke="#F59E1B" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    )}
                    {step.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Form — hidden until animation completes, then slides up */}
            {animDone && (
            <div ref={formSectionRef} className="form-section form-reveal">

              {/* Blurred preview tease */}
              <div style={{ marginBottom: 24, textAlign: "center" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(67,209,123,.1)", border: "1px solid rgba(67,209,123,.3)", color: "#2d9e5f", fontSize: 13, fontWeight: 700, padding: "6px 16px", borderRadius: 999, marginBottom: 14 }}>
                  <svg viewBox="0 0 20 20" width="14" height="14" fill="none"><circle cx="10" cy="10" r="10" fill="#43d17b"/><path d="M6 10.5l2.5 2.5L14 8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Tu carta está lista
                </div>
                <div style={{ position: "relative", border: "1.5px solid var(--line)", borderRadius: 16, overflow: "hidden", background: "var(--white)", textAlign: "left" }}>
                  {/* Blurred fake menu content */}
                  <div style={{ padding: 16, filter: "blur(5px)", userSelect: "none", pointerEvents: "none" }}>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: "#E9E8E3", flexShrink: 0 }} />
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ height: 13, width: 130, borderRadius: 5, background: "#E9E8E3" }} />
                        <div style={{ height: 9, width: 80, borderRadius: 5, background: "#F0EFEA" }} />
                      </div>
                    </div>
                    {/* Category pills */}
                    <div style={{ display: "flex", gap: 7, marginBottom: 16, flexWrap: "wrap" }}>
                      {["Entrantes", "Principales", "Postres", "Bebidas"].map(c => (
                        <div key={c} style={{ height: 28, padding: "0 13px", borderRadius: 999, background: "#F59E1B", opacity: .75, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", color: "#fff" }}>{c}</div>
                      ))}
                    </div>
                    {/* Fake dish rows */}
                    {[1,2,3].map(i => (
                      <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
                        <div style={{ width: 58, height: 58, borderRadius: 10, background: i === 1 ? "#DDD" : i === 2 ? "#E5E0DA" : "#E9E5E0", flexShrink: 0 }} />
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
                          <div style={{ height: 11, width: `${[82,68,75][i-1]}%`, borderRadius: 4, background: "#E9E8E3" }} />
                          <div style={{ height: 9, width: `${[55,45,60][i-1]}%`, borderRadius: 4, background: "#F0EFEA" }} />
                          <div style={{ height: 10, width: 52, borderRadius: 4, background: "#F59E1B", opacity: .35 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Overlay con candado */}
                  <div style={{ position: "absolute", inset: 0, background: "rgba(252,251,247,.55)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1.5px solid #EAE8E1", borderRadius: 999, padding: "10px 22px", fontSize: 13, fontWeight: 700, color: "#111", boxShadow: "0 4px 20px rgba(0,0,0,.1)" }}>
                      <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><rect x="3" y="11" width="18" height="11" rx="2" stroke="#111" strokeWidth="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#111" strokeWidth="2" strokeLinecap="round"/></svg>
                      Ingresa tus datos para desbloquear
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-title">
                <h2>¿A dónde te la enviamos?</h2>
                <p className="form-sub">Déjanos tus datos y te mandamos el link de tu carta al instante.</p>
              </div>

              <form ref={formRef} onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
                <div className="field-row">
                  <label style={{ display: "block", fontSize: 15, color: "var(--muted)", marginBottom: 5, paddingLeft: 2, fontWeight: 700, textAlign: "left" as const }}>Nombre del local</label>
                  <input ref={firstInputRef} type="text" placeholder="Ej: Mi Restaurante" value={localName} onChange={(e) => { setLocalName(e.target.value); setError(""); }} />
                </div>
                <div className="field-row">
                  <label style={{ display: "block", fontSize: 15, color: "var(--muted)", marginBottom: 5, paddingLeft: 2, fontWeight: 700, textAlign: "left" as const }}>Tu nombre</label>
                  <input type="text" placeholder="Ej: Juan Pérez" value={ownerName} onChange={(e) => { setOwnerName(e.target.value); setError(""); }} />
                </div>
                <div className="field-row">
                  <label style={{ display: "block", fontSize: 15, color: "var(--muted)", marginBottom: 5, paddingLeft: 2, fontWeight: 700, textAlign: "left" as const }}>Correo electrónico</label>
                  <input type="email" placeholder="tu@correo.com" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} />
                </div>
                <div className="field-row">
                  <label style={{ display: "block", fontSize: 15, color: "var(--muted)", marginBottom: 5, paddingLeft: 2, fontWeight: 700, textAlign: "left" as const }}>WhatsApp</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 10px", background: "#F5F5F3", border: "1.5px solid #EAE8E1", borderRadius: 10, color: "#111", fontSize: 14, flexShrink: 0 }}>
                      <svg width="20" height="14" viewBox="0 0 20 14" style={{ borderRadius: 2, flexShrink: 0 }}><rect width="20" height="7" fill="#fff"/><rect y="7" width="20" height="7" fill="#D52B1E"/><rect width="7" height="7" fill="#0039A6"/><polygon points="3.5,1.5 4.1,3.3 6,3.3 4.5,4.4 5,6.2 3.5,5.1 2,6.2 2.5,4.4 1,3.3 2.9,3.3" fill="#fff"/></svg>
                      <span style={{ fontWeight: 600 }}>+56</span>
                    </div>
                    <input type="tel" placeholder="9 1234 5678" value={whatsapp} onChange={(e) => { setWhatsapp(formatPhone(e.target.value)); setError(""); setPhoneWarning(""); }} style={{ flex: 1 }} />
                  </div>
                  {phoneWarning && (
                    <div style={{ color: "#F59E1B", fontSize: 12, marginTop: 4, textAlign: "left", paddingLeft: 4 }}>
                      {phoneWarning}
                    </div>
                  )}
                </div>

                {emailWarning && !emailWarningDismissed && (
                  <div style={{ background: "#FFF7EA", border: "1.5px solid rgba(245,158,27,.3)", borderRadius: 14, padding: "14px 16px", marginBottom: 12, textAlign: "left", fontSize: 14, color: "#111", lineHeight: 1.5 }}>
                    <div style={{ fontWeight: 600 }}>{emailWarning}</div>
                    {emailWarningType === "active" && (
                      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                        <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Si quieres acceder a tu panel, recupera tu contraseña.</p>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <a href="/panel/forgot-password" style={{
                            display: "inline-block", padding: "8px 16px", borderRadius: 10,
                            background: "#F59E1B", color: "#fff",
                            fontSize: 13, fontWeight: 700, textDecoration: "none",
                          }}>Recuperar contraseña</a>
                          <button type="button" onClick={() => { setEmailWarningDismissed(true); setEmailWarning(""); }} style={{
                            background: "none", border: "1.5px solid #EAE8E1", borderRadius: 10,
                            padding: "8px 14px", color: "#73736D", fontSize: 13, cursor: "pointer",
                          }}>Crear otro local</button>
                        </div>
                      </div>
                    )}
                    {emailWarningType === "demo" && (
                      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                        <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Revisa tu correo, ya te enviamos un link para ver tu carta.</p>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <a href="/panel" style={{
                            display: "inline-block", padding: "8px 16px", borderRadius: 10,
                            background: "#F59E1B", color: "#fff",
                            fontSize: 13, fontWeight: 700, textDecoration: "none",
                          }}>Ir a mi panel</a>
                          <button type="button" onClick={() => { setEmailWarningDismissed(true); setEmailWarning(""); }} style={{
                            background: "none", border: "1.5px solid #EAE8E1", borderRadius: 10,
                            padding: "8px 14px", color: "#73736D", fontSize: 13, cursor: "pointer",
                          }}>Crear otro local</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <div style={{ color: "#e85d5d", fontSize: 14, textAlign: "center", marginBottom: 8 }}>
                    {error}
                  </div>
                )}

                <button type="submit" className="cta" disabled={loading} style={{ opacity: loading ? 0.6 : 1 }}>
                  {loading ? "Enviando..." : "Recibir mi nueva carta"} <span>→</span>
                </button>
              </form>

              <p style={{ textAlign: "center", color: "#A8A8A2", fontSize: 12, marginTop: 10 }}>Solo usaremos tus datos para enviar tu nueva carta.</p>

            </div>
            )}
          </div>
        </section>
      </main>

      <Footer onPlanesClick={() => setPlanesOpen(true)} />
      {planesOpen && <PlanesModal onClose={() => setPlanesOpen(false)} />}

      {/* Exit-intent modal */}
      {exitModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10000,
          background: "rgba(17,17,17,.5)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div style={{
            background: "#fff", border: "1.5px solid #EAE8E1",
            borderRadius: 24, maxWidth: 360, width: "100%", padding: "32px 24px",
            textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,.18)",
          }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🍽️</div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800, letterSpacing: "-.04em", color: "#111", margin: "0 0 10px", lineHeight: 1.2 }}>
              Tu carta ya casi está lista
            </h2>
            <p style={{ fontSize: "0.9rem", color: "#73736D", lineHeight: 1.5, margin: "0 0 22px" }}>
              Solo faltan tus datos para crearla. Son 30 segundos.
            </p>
            <button
              onClick={() => { setExitModal(false); setTimeout(() => firstInputRef.current?.focus(), 200); }}
              style={{
                width: "100%", padding: "14px 20px", borderRadius: 14, border: "none",
                background: "#F59E1B", color: "#fff",
                fontSize: "1rem", fontWeight: 800, cursor: "pointer",
                boxShadow: "0 8px 24px rgba(245,158,27,.22)",
                marginBottom: 10, letterSpacing: "-.02em",
              }}
            >
              Completar mis datos →
            </button>
            <button
              onClick={() => setExitModal(false)}
              style={{ background: "none", border: "none", color: "#A8A8A2", fontSize: "0.8rem", cursor: "pointer", padding: "6px 0" }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* Minimal light design system — matches landing page */
const STYLES = `
:root {
  --ink: #111111; --muted: #73736D; --muted-light: #A8A8A2;
  --paper: #FCFBF7; --white: #FFFFFF;
  --line: #EAE8E1;
  --yellow: #F59E1B; --yellow-hover: #E08D0C; --yellow-bg: #FFF7EA;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { min-height: 100vh!important; background: var(--paper)!important; color: var(--ink)!important; font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif!important; -webkit-font-smoothing: antialiased; overflow-x: hidden!important; }
a { color: inherit; text-decoration: none; }
.page { width: min(100% - 28px, 760px); margin: 0 auto; padding: 80px 0 64px; }

/* NAV */
.nav-bar { position: fixed; top: 0; left: 0; right: 0; z-index: 50; height: 64px; display: flex; align-items: center; justify-content: space-between; padding: 0 clamp(16px,4vw,48px); background: rgba(252,251,247,.94); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line); }
.nav-logo { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 800; letter-spacing: -.03em; color: var(--ink); }
.nav-ingresar { font-size: 13px; font-weight: 600; color: var(--ink); padding: 7px 16px; border: 1.5px solid var(--line); border-radius: 10px; transition: .15s; }
.nav-ingresar:hover { border-color: #bbb; background: #f5f5f5; }

/* STEPS */
.steps { display: flex; align-items: center; justify-content: center; gap: 0; margin: 0 auto 28px; max-width: 480px; }
.step { display: flex; align-items: center; gap: 8px; color: var(--muted-light); font-size: 13px; font-weight: 500; }
.step-line { width: 28px; height: 1px; background: var(--line); margin: 0 6px; }
.step-number { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 700; border: 1.5px solid var(--line); background: transparent; color: var(--muted-light); }
.step.active { color: var(--ink); }
.step.active .step-number { color: #8F5A05; border-color: var(--yellow); background: var(--yellow-bg); }
.step.done { color: var(--muted); }
.step.done .step-number { background: var(--yellow); color: #fff; border-color: var(--yellow); }

/* SHELL */
.shell { border: 1.5px solid var(--line); background: var(--white); border-radius: 20px; padding: 28px 24px; box-shadow: 0 2px 16px rgba(0,0,0,.05); }
.centered-shell { max-width: 680px; margin: 0 auto; text-align: center; }
.centered-form { max-width: 540px; margin: 0 auto; }

/* H1 */
h1 { font-size: clamp(26px, 6vw, 38px); line-height: 1.1; font-weight: 800; letter-spacing: -.04em; margin-bottom: 10px; color: var(--ink); }
h1 span { color: var(--yellow); }
.subcopy { color: var(--muted); font-size: 15px; line-height: 1.5; margin: 0 auto 22px; max-width: 420px; }

/* FILE PILL */
.file-pill { border: 1.5px solid var(--line); background: var(--paper); border-radius: 14px; padding: 12px 14px; display: flex; align-items: center; gap: 12px; margin-bottom: 16px; text-align: left; }
.file-ico { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; color: var(--yellow); border: 1.5px solid rgba(245,158,27,.3); background: var(--yellow-bg); flex: 0 0 auto; }
.file-name { font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 2px; }
.file-meta { font-size: 11px; color: var(--muted); }

/* PROGRESS */
.progress-area { margin-bottom: 20px; }
.progress-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 14px; color: var(--ink); font-weight: 600; }
.progress-head span { color: var(--yellow); }
.progress-track { height: 6px; background: var(--line); border-radius: 999px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--yellow); border-radius: 999px; transition: width 0.3s ease; }
.checks { display: grid; gap: 7px; margin-top: 12px; color: var(--muted); font-size: 13px; }
.check { display: flex; align-items: center; gap: 8px; }

/* FORM */
.form-section { margin-top: 8px; border-top: 1.5px solid var(--line); padding-top: 24px; }
.form-reveal { animation: formSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
@keyframes formSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pillMetaFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes titleFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
.form-title { text-align: center; margin-bottom: 18px; }
.form-title h2 { font-size: clamp(22px, 5vw, 28px); font-weight: 800; letter-spacing: -.04em; color: var(--ink); margin-bottom: 5px; }
.form-sub { color: var(--muted); font-size: 13px; line-height: 1.4; }
.field-row { margin-bottom: 12px; text-align: left; }
input { width: 100%; height: 52px; border-radius: 12px; border: 1.5px solid var(--line); background: var(--white); color: var(--ink); padding: 0 16px; font: inherit; font-size: 15px; outline: none; transition: border-color .15s; }
input::placeholder { color: #B8B8B2 !important; }
input:focus { border-color: var(--ink); }
.cta { width: 100%; min-height: 54px; border: 0; border-radius: 14px; background: var(--yellow); color: #fff; font-size: 17px; font-weight: 850; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: background .18s, transform .18s; margin-top: 16px; font-family: inherit; letter-spacing: -.02em; box-shadow: 0 8px 24px rgba(245,158,27,.22); }
.cta:hover:not(:disabled) { background: var(--yellow-hover); transform: translateY(-1px); }
.cta:disabled { opacity: .5; cursor: default; }
@media (min-width: 680px) { .page { padding-top: 80px; } .steps { margin-bottom: 32px; } .shell { padding: 40px; } }
@media (max-width: 390px) { h1 { font-size: 24px; } }
`;
