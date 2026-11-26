"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Bell, ChevronLeft, ChevronRight, CreditCard, Handshake, Heart, Maximize2, Minimize2, ShoppingBag, StickyNote, X } from "lucide-react";
import type { ChapterId, DemoData, LiveOrder } from "./types";
import { SELLER_NOTES } from "./notes";
import { EASE, LocalLogo, clp } from "./ui";
import { demoPrize } from "./dishes";
import Intro from "./chapters/Intro";
import CartaQR, { cartaSteps } from "./chapters/CartaQR";
import Loyalty from "./chapters/Loyalty";
import Ecommerce, { ecommerceSteps } from "./chapters/Ecommerce";
import Pos, { posSteps } from "./chapters/Pos";
import Planes, { planesSteps } from "./chapters/Planes";
import CloseBar from "./CloseBar";
import { recommendPlanId, withRecommendation, type InterestModule } from "./recommend";

export type ChapterProps = { data: DemoData; step: number; onStart?: () => void; onQr?: () => void; live?: { orders: LiveOrder[] } };

/** Datos del lead que solo ve el vendedor (cierre e intereses). */
export type SellerContext = { email: string; whatsapp: string; interests: string[] };

// Módulo que se marca como "le interesó" en cada capítulo.
const CHAPTER_MODULE: Partial<Record<ChapterId, InterestModule>> = { carta: "carta_qr", loyalty: "loyalty", ecommerce: "ecommerce", pos: "pos" };

// QR por capítulo: abre en el celular del dueño la versión real de ese módulo.
type ChapterQr = { path: (slug: string) => string; kicker: string; title: (name: string) => string; hint: string };
const QR_CARTA: ChapterQr = { path: (s) => `/qr/${s}`, kicker: "Pruébalo en tu celular", title: (n) => `Escanea y abre la carta de ${n}`, hint: "Toca la campana para llamar al garzón y mira esta pantalla." };
const QR_STORE: ChapterQr = { path: (s) => `/ecommerce/${s}`, kicker: "Haz un pedido de prueba", title: (n) => `La tienda de ${n}`, hint: "Pide desde tu celular (retiro, pago en efectivo) y mira cómo llega aquí. No se cobra nada." };
const QR_LOYALTY: ChapterQr = { path: (s) => `/fidelidad/${s}`, kicker: "Inscríbete tú mismo", title: (n) => `Tu tarjeta de ${n}`, hint: "Escanea, inscríbete y mira cómo aparece aquí al instante." };
type Chapter = { id: ChapterId; title: string; steps: number | ((d: DemoData) => number); dark: boolean; Comp: ComponentType<ChapterProps>; qr: ChapterQr };

const CHAPTERS: Chapter[] = [
  { id: "inicio", title: "Inicio", steps: 2, dark: true, Comp: Intro, qr: QR_CARTA },
  { id: "carta", title: "Carta QR", steps: cartaSteps, dark: false, Comp: CartaQR, qr: QR_CARTA },
  { id: "loyalty", title: "Fidelización", steps: 4, dark: true, Comp: Loyalty, qr: QR_LOYALTY },
  { id: "ecommerce", title: "Tienda online", steps: ecommerceSteps, dark: false, Comp: Ecommerce, qr: QR_STORE },
  { id: "pos", title: "POS", steps: posSteps, dark: true, Comp: Pos, qr: QR_CARTA },
  { id: "planes", title: "Planes", steps: planesSteps, dark: false, Comp: Planes, qr: QR_CARTA },
];

const IDLE_MS = 3000;

export default function DemoShell({ data: baseData, mode = "seller", exitHref, seller }: { data: DemoData; mode?: "seller" | "shared"; exitHref?: string; seller?: SellerContext }) {
  const reduce = useReducedMotion();
  const [ci, setCi] = useState(0);
  const [step, setStep] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [idle, setIdle] = useState(false);
  const canClose = mode === "seller" && !!baseData.leadId && !!seller;
  const [closeOpen, setCloseOpen] = useState(false);

  // ── Intereses del dueño → plan recomendado ──
  const [interests, setInterests] = useState<string[]>(seller?.interests ?? []);
  const planId = useMemo(() => recommendPlanId(baseData.plans, interests), [baseData.plans, interests]);
  const data = useMemo(() => ({ ...baseData, plans: withRecommendation(baseData.plans, planId) }), [baseData, planId]);
  const toggleInterest = useCallback((m: InterestModule) => {
    if (!canClose) return;
    const nextList = interests.includes(m) ? interests.filter((x) => x !== m) : [...interests, m];
    setInterests(nextList);
    const pid = recommendPlanId(baseData.plans, nextList);
    fetch(`/api/ventas/leads/${baseData.leadId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interestModules: nextList, recommendedPlan: pid ?? "" }) }).catch(() => {});
  }, [canClose, interests, baseData.plans, baseData.leadId]);

  const chapter = CHAPTERS[ci];
  const chapterModule = CHAPTER_MODULE[chapter.id];
  const liked = !!chapterModule && interests.includes(chapterModule);
  const stepsOf = useCallback((c: Chapter) => (typeof c.steps === "function" ? c.steps(data) : c.steps), [data]);
  const chapterSteps = stepsOf(chapter);

  // ── Registro de eventos (solo vendedor con lead real) ──
  const track = useCallback((body: object, beacon = false) => {
    if (mode !== "seller" || !data.leadId) return;
    const url = `/api/ventas/leads/${data.leadId}/events`;
    const payload = JSON.stringify(body);
    if (beacon && navigator.sendBeacon) navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
    else fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
  }, [mode, data.leadId]);

  const chapterStart = useRef(0);
  const lastChapter = useRef<ChapterId>("inicio");
  const started = useRef(false);
  useEffect(() => {
    chapterStart.current = Date.now();
    if (started.current) return; // una sola vez (React en desarrollo ejecuta los efectos dos veces)
    started.current = true;
    track({ type: "demo_started" });
    // Deja listo el local demo (garzón, tarjeta, tienda) y refresca su carta en caché.
    if (mode === "seller" && data.leadId && data.slug) {
      fetch(`/api/ventas/leads/${data.leadId}/prepare`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ color: data.color, prize: demoPrize(data)?.name ?? null }) }).catch(() => {});
    }
  }, [track, mode, data]);
  useEffect(() => {
    const prev = lastChapter.current;
    if (prev !== chapter.id) {
      track({ type: "chapter_viewed", chapter: prev, durationMs: Date.now() - chapterStart.current });
      lastChapter.current = chapter.id;
      chapterStart.current = Date.now();
    }
  }, [chapter.id, track]);
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") track({ type: "chapter_viewed", chapter: lastChapter.current, durationMs: Date.now() - chapterStart.current }, true); };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [track]);

  // ── En vivo: lo que el dueño hace en su celular (llamar garzón, inscribirse) ──
  const [toasts, setToasts] = useState<LiveEvent[]>([]);
  const [liveOrders, setLiveOrders] = useState<LiveOrder[]>([]);
  useEffect(() => {
    if (mode !== "seller" || !data.leadId || !data.slug) return;
    let since = new Date().toISOString();
    const seen = new Set<string>();
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch(`/api/ventas/leads/${data.leadId}/live?since=${encodeURIComponent(since)}`, { cache: "no-store" });
        if (!r.ok || !alive) return;
        const { events } = (await r.json()) as { events: LiveEvent[] };
        for (const ev of events) {
          if (seen.has(ev.id)) continue;
          seen.add(ev.id);
          if (ev.at > since) since = ev.at;
          setToasts((t) => [...t.slice(-2), ev]);
          if (ev.type === "test_order" && ev.order) {
            const o = ev.order;
            setLiveOrders((list) => [...list, { id: ev.id, number: o.number, customer: o.customer, phone: o.phone, payment: o.payment, note: o.note, lines: o.lines, total: o.total, at: ev.at }]);
          }
          setTimeout(() => setToasts((t) => t.filter((x) => x.id !== ev.id)), 7000);
          chime();
          track({ type: ev.type, payload: { label: ev.label } });
        }
      } catch { /* reintenta en el próximo ciclo */ }
    };
    const iv = setInterval(poll, 2000);
    return () => { alive = false; clearInterval(iv); };
  }, [mode, data.leadId, data.slug, track]);

  // Al llegar al cierre de Planes aparece la barra de cierre.
  const atEnd = ci === CHAPTERS.length - 1 && step === chapterSteps - 1;
  const [autoShown, setAutoShown] = useState(false);
  if (atEnd && canClose && !autoShown) { setAutoShown(true); setCloseOpen(true); }

  // ── Navegación ──
  const next = useCallback(() => {
    if (step < chapterSteps - 1) setStep((s) => s + 1);
    else if (ci < CHAPTERS.length - 1) { setCi((c) => c + 1); setStep(0); }
  }, [step, chapterSteps, ci]);
  const prev = useCallback(() => {
    if (step > 0) setStep((s) => s - 1);
    else if (ci > 0) { setCi((c) => c - 1); setStep(stepsOf(CHAPTERS[ci - 1]) - 1); }
  }, [step, ci, stepsOf]);
  const goTo = useCallback((i: number) => { setCi(i); setStep(0); }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);
  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown" || e.key === "Enter") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp" || e.key === "Backspace") { e.preventDefault(); prev(); }
      else if ((e.key === "n" || e.key === "N") && mode === "seller") setNotesOpen((v) => !v);
      else if (e.key === "f" || e.key === "F") toggleFullscreen();
      else if (e.key === "q" || e.key === "Q") setQrOpen((v) => !v);
      else if ((e.key === "c" || e.key === "C") && canClose) setCloseOpen((v) => !v);
      else if ((e.key === "i" || e.key === "I") && chapterModule) toggleInterest(chapterModule);
      else if (e.key === "Escape") { setNotesOpen(false); setQrOpen(false); setCloseOpen(false); }
      else if (/^[1-6]$/.test(e.key)) goTo(Number(e.key) - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, goTo, toggleFullscreen, mode, canClose, chapterModule, toggleInterest]);

  // Modo presentación: cursor y controles se ocultan tras 3 s sin movimiento.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const wake = () => { setIdle(false); clearTimeout(t); t = setTimeout(() => setIdle(true), IDLE_MS); };
    wake();
    window.addEventListener("mousemove", wake);
    window.addEventListener("touchstart", wake);
    return () => { clearTimeout(t); window.removeEventListener("mousemove", wake); window.removeEventListener("touchstart", wake); };
  }, []);
  const hideChrome = idle && !notesOpen && !qrOpen && !closeOpen;

  // Deslizar en celular.
  const touchX = useRef<number | null>(null);

  const ink = chapter.dark ? "#F5F5F7" : "#111";
  const sub = chapter.dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.5)";
  const qrUrl = data.slug && typeof window !== "undefined" ? `${window.location.origin}${chapter.qr.path(data.slug)}` : null;

  return (
    <div
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touchX.current == null) return; const dx = e.changedTouches[0].clientX - touchX.current; touchX.current = null; if (Math.abs(dx) > 50) (dx < 0 ? next : prev)(); }}
      style={{
        position: "fixed", inset: 0, overflow: "hidden", userSelect: "none",
        fontFamily: "var(--demo-sans)", color: ink, cursor: hideChrome && fullscreen ? "none" : "default",
        ["--demo-sans" as string]: "'Inter', ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        ["--demo-mono" as string]: "'IBM Plex Mono', ui-monospace, monospace",
      }}
    >
      {/* Fondo que cambia de claro a oscuro según el capítulo */}
      <motion.div aria-hidden initial={false} animate={{ backgroundColor: chapter.dark ? "#050505" : "#FBFAF7" }} transition={{ duration: 0.8, ease: EASE }} style={{ position: "absolute", inset: 0 }} />

      {/* Escenario: clic avanza */}
      <div onClick={next} style={{ position: "absolute", inset: 0 }}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={chapter.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, filter: "blur(14px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.04, filter: "blur(14px)" }}
            transition={{ duration: reduce ? 0.2 : 0.85, ease: EASE }}
            style={{ position: "absolute", inset: 0 }}
          >
            <chapter.Comp data={data} step={step} onStart={canClose ? () => setCloseOpen(true) : undefined} live={{ orders: liveOrders }} onQr={data.slug ? () => setQrOpen(true) : undefined} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Barra superior: local + capítulos ── */}
      <motion.header initial={false} animate={{ opacity: hideChrome ? 0 : 1, y: hideChrome ? -12 : 0 }} transition={{ duration: 0.4 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", pointerEvents: hideChrome ? "none" : "auto", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <LocalLogo data={data} size={30} />
          <span style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180, color: ink }} className="demo-hide-sm">{data.name}</span>
        </div>
        <div className="demo-only-sm" style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: 14, color: ink }}>{chapter.title}</div>
        <nav className="demo-hide-sm" style={{ flex: 1, display: "flex", justifyContent: "center", gap: 4, overflowX: "auto", scrollbarWidth: "none" }}>
          {CHAPTERS.map((c, i) => (
            <button key={c.id} onClick={(e) => { e.stopPropagation(); goTo(i); }} style={{
              border: "none", cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, padding: "7px 13px", borderRadius: 99, whiteSpace: "nowrap",
              background: i === ci ? (chapter.dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.07)") : "transparent",
              color: i === ci ? ink : sub, backdropFilter: "blur(12px)",
            }}>{c.title}</button>
          ))}
        </nav>
        <div style={{ display: "flex", gap: 6 }}>
          {canClose && chapterModule && <IconBtn dark={chapter.dark} label={liked ? "Le interesó (I)" : "Marcar que le interesó (I)"} onClick={() => toggleInterest(chapterModule)} active={liked}><Heart size={17} fill={liked ? "currentColor" : "none"} /></IconBtn>}
          {mode === "seller" && <IconBtn dark={chapter.dark} label="Notas (N)" onClick={() => setNotesOpen((v) => !v)} active={notesOpen}><StickyNote size={17} /></IconBtn>}
          {canClose && <IconBtn dark={chapter.dark} label="Cierre (C)" onClick={() => setCloseOpen((v) => !v)} active={closeOpen}><Handshake size={17} /></IconBtn>}
          <IconBtn dark={chapter.dark} label={fullscreen ? "Salir de pantalla completa (F)" : "Pantalla completa (F)"} onClick={toggleFullscreen}>{fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</IconBtn>
          {exitHref && <IconBtn dark={chapter.dark} label="Salir de la demo" onClick={() => { window.location.href = exitHref; }}><X size={17} /></IconBtn>}
        </div>
      </motion.header>

      {/* ── Flechas laterales ── */}
      <motion.div initial={false} animate={{ opacity: hideChrome ? 0 : 1 }} style={{ pointerEvents: hideChrome ? "none" : "auto" }} className="demo-hide-sm">
        {(ci > 0 || step > 0) && <SideArrow side="left" dark={chapter.dark} onClick={prev} />}
        {(ci < CHAPTERS.length - 1 || step < chapterSteps - 1) && <SideArrow side="right" dark={chapter.dark} onClick={next} />}
      </motion.div>

      {/* ── Progreso ── */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", gap: 4, padding: "0 18px 14px", zIndex: 10, pointerEvents: "none" }}>
        {CHAPTERS.map((c, i) => (
          <div key={c.id} style={{ flex: stepsOf(c), height: 3, borderRadius: 3, background: chapter.dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)", overflow: "hidden" }}>
            <motion.div initial={false} animate={{ width: i < ci ? "100%" : i > ci ? "0%" : `${((step + 1) / stepsOf(c)) * 100}%` }} transition={{ duration: 0.6, ease: EASE }}
              style={{ height: "100%", background: data.color, borderRadius: 3 }} />
          </div>
        ))}
      </div>

      <AnimatePresence>
        {qrOpen && (
          <motion.div key="qr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setQrOpen(false)}
            style={{ position: "absolute", inset: 0, zIndex: 30, background: "rgba(0,0,0,.6)", backdropFilter: "blur(18px)", display: "grid", placeItems: "center", padding: 20 }}>
            <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.45, ease: EASE }} onClick={(e) => e.stopPropagation()}
              style={{ background: "#fff", color: "#111", borderRadius: 32, padding: "36px 40px", textAlign: "center", maxWidth: 440, width: "100%", boxShadow: "0 40px 120px -20px rgba(0,0,0,.6)" }}>
              {qrUrl ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 700, color: data.color, letterSpacing: ".08em", textTransform: "uppercase" }}>{chapter.qr.kicker}</div>
                  <div style={{ fontSize: 26, fontWeight: 750, letterSpacing: "-.03em", margin: "6px 0 22px" }}>{chapter.qr.title(data.name)}</div>
                  <div style={{ display: "inline-block", padding: 16, borderRadius: 22, background: "#fff", boxShadow: "0 0 0 1px rgba(0,0,0,.08)" }}>
                    <QRCodeSVG value={qrUrl} size={280} level="M" fgColor="#111" />
                  </div>
                  <div style={{ fontSize: 15, color: "#666", marginTop: 18 }}>{chapter.qr.hint}</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 24, fontWeight: 750, letterSpacing: "-.03em", marginBottom: 8 }}>QR no disponible</div>
                  <p style={{ color: "#666", fontSize: 15, margin: 0 }}>El QR abre la carta real del local. Disponible cuando el local se captura con su carta.</p>
                </>
              )}
              <button onClick={() => setQrOpen(false)} style={{ marginTop: 22, border: "none", background: "#f1f1f1", borderRadius: 99, padding: "10px 22px", fontWeight: 700, cursor: "pointer", font: "inherit" }}>Cerrar</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Avisos en vivo desde el celular del dueño ── */}
      <div style={{ position: "absolute", top: 70, left: "50%", transform: "translateX(-50%)", zIndex: 25, display: "grid", gap: 10, width: "min(440px, calc(100vw - 32px))", pointerEvents: "none" }}>
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, y: -30, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -16, scale: 0.96 }} transition={{ duration: 0.55, ease: EASE }}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 22, background: "rgba(255,255,255,.94)", color: "#111", backdropFilter: "blur(24px)", boxShadow: `0 30px 80px -20px rgba(0,0,0,.5), 0 0 0 1px rgba(0,0,0,.05), 0 0 0 4px ${data.color}33` }}>
              <motion.div animate={{ rotate: [0, -14, 12, -8, 6, 0] }} transition={{ duration: 0.9, repeat: 2, repeatDelay: 0.6 }}
                style={{ width: 48, height: 48, borderRadius: 15, flexShrink: 0, display: "grid", placeItems: "center", background: data.color, color: "#fff" }}>
                {t.type === "waiter_called" ? <Bell size={24} /> : t.type === "test_order" ? <ShoppingBag size={24} /> : <CreditCard size={24} />}
              </motion.div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-.01em" }}>
                  {t.type === "waiter_called" ? `${t.label} llama al garzón` : t.type === "test_order" ? `Nuevo pedido · ${clp(t.total ?? 0)}` : `¡${t.label} se inscribió!`}
                </div>
                <div style={{ fontSize: 14, color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.type === "waiter_called" ? "Recién, desde su celular" : t.type === "test_order" ? (t.detail || t.label) : `Tarjeta de ${data.name} · en su celular`}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Barra de cierre (tecla C) ── */}
      {canClose && seller && (
        <CloseBar leadId={baseData.leadId!} color={data.color} open={closeOpen} onClose={() => setCloseOpen(false)}
          initialEmail={seller.email} initialWhatsapp={seller.whatsapp} planId={planId} localName={data.name} />
      )}

      {/* ── Notas del vendedor (tecla N) ── */}
      <AnimatePresence>
        {notesOpen && mode === "seller" && (
          <motion.aside key="notes" initial={{ x: 380, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 380, opacity: 0 }} transition={{ duration: 0.45, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            style={{ position: "absolute", top: 70, right: 16, bottom: 100, width: "min(360px, calc(100vw - 32px))", zIndex: 20, overflowY: "auto", borderRadius: 22, padding: "20px 22px", background: "rgba(20,20,22,.92)", color: "#f5f5f7", backdropFilter: "blur(24px)", boxShadow: "0 30px 80px -20px rgba(0,0,0,.6)", fontSize: 14, lineHeight: 1.5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <b style={{ fontSize: 15 }}>Notas · {chapter.title}</b>
              <button onClick={() => setNotesOpen(false)} aria-label="Cerrar notas" style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {canClose && chapterModule && (
              <button onClick={() => toggleInterest(chapterModule)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", marginBottom: 8, borderRadius: 14, border: "none", cursor: "pointer", font: "inherit", fontWeight: 700, fontSize: 14, background: liked ? data.color : "rgba(255,255,255,.08)", color: "#fff" }}>
                <Heart size={16} fill={liked ? "currentColor" : "none"} /> {liked ? "Le interesó este módulo" : "¿Le interesó? Márcalo (I)"}
              </button>
            )}
            <NotesList title="Frases clave" items={SELLER_NOTES[chapter.id].frases} />
            <NotesList title="Preguntas" items={SELLER_NOTES[chapter.id].preguntas} />
            {SELLER_NOTES[chapter.id].objeciones.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#8e8e93", marginBottom: 6 }}>Objeciones</div>
                {SELLER_NOTES[chapter.id].objeciones.map((o) => (
                  <div key={o.o} style={{ marginBottom: 10 }}><div style={{ color: "#ff9f0a", fontWeight: 600 }}>“{o.o}”</div><div style={{ color: "#d1d1d6" }}>{o.r}</div></div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 16, fontSize: 12, color: "#8e8e93" }}>← → avanzar · 1–6 capítulos · F pantalla completa · Q código QR · I le interesó · C cierre</div>
          </motion.aside>
        )}
      </AnimatePresence>

      <style>{`.demo-only-sm{display:none}@media (max-width: 700px){.demo-hide-sm{display:none !important}.demo-only-sm{display:block}}`}</style>
    </div>
  );
}

type LiveEvent = {
  id: string; type: "waiter_called" | "loyalty_enrolled" | "test_order"; label: string; at: string; detail?: string; total?: number;
  order?: { number: number | null; customer: string; phone: string; payment: string; note: string | null; lines: { name: string; qty: number; price: number }[]; total: number };
};

/** Sonido corto de dos tonos (sin archivos). Requiere una interacción previa (tecla o clic). */
function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [[880, 0], [1320, 0.13]].forEach(([f, t]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.45);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.5);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch { /* sin audio */ }
}

function IconBtn({ children, label, onClick, dark, active }: { children: React.ReactNode; label: string; onClick: () => void; dark: boolean; active?: boolean }) {
  return (
    <button aria-label={label} title={label} onClick={(e) => { e.stopPropagation(); onClick(); }} style={{
      width: 36, height: 36, borderRadius: 12, border: "none", cursor: "pointer", display: "grid", placeItems: "center", backdropFilter: "blur(12px)",
      background: active ? (dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.12)") : dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)", color: dark ? "#f5f5f7" : "#111",
    }}>{children}</button>
  );
}

function SideArrow({ side, dark, onClick }: { side: "left" | "right"; dark: boolean; onClick: () => void }) {
  return (
    <button aria-label={side === "left" ? "Anterior" : "Siguiente"} onClick={(e) => { e.stopPropagation(); onClick(); }} style={{
      position: "absolute", top: "50%", [side]: 14, transform: "translateY(-50%)", zIndex: 10, width: 44, height: 44, borderRadius: 99, border: "none", cursor: "pointer",
      display: "grid", placeItems: "center", background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)", color: dark ? "#f5f5f7" : "#111", backdropFilter: "blur(12px)",
    }}>{side === "left" ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}</button>
  );
}

function NotesList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#8e8e93", marginBottom: 6 }}>{title}</div>
      {items.map((t) => <div key={t} style={{ marginBottom: 6 }}>• {t}</div>)}
    </div>
  );
}
