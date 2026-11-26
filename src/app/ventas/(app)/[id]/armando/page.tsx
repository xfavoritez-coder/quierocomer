"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type Status = {
  status: "PENDING" | "PROCESSING" | "READY" | "DELIVERED" | "FAILED";
  error: string | null;
  localName: string;
  preview: { restaurantName?: string; logoUrl?: string | null; totalDishes?: number; totalCategories?: number; sampleDishes?: { name: string; price: number; imageUrl?: string | null; category?: string }[] } | null;
  restaurant: { name: string; logoUrl: string | null } | null;
  dishCount: number;
  categories: { id: string; name: string; dishes: { id: string; name: string; price: number; photo: string | null }[] }[];
};

const clp = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-CL");
const SLOW_MS = 20000;

export default function ArmandoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const reduce = useReducedMotion();
  const [st, setSt] = useState<Status | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const started = useRef(false);

  // Lanza el motor una sola vez (el servidor ignora si ya está procesando o listo).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Igual que /subircarta: vista previa rápida + carta completa en paralelo.
    fetch(`/api/ventas/leads/${id}/preview`, { method: "POST" }).catch(() => {});
    fetch(`/api/ventas/leads/${id}/process`, { method: "POST" }).catch(() => {});
  }, [id]);

  // Consulta el avance cada 1,5 s hasta que termine.
  useEffect(() => {
    let alive = true;
    const t0 = Date.now();
    const tick = async () => {
      try {
        const r = await fetch(`/api/ventas/leads/${id}/status`, { cache: "no-store" });
        if (r.ok && alive) setSt(await r.json());
      } catch { /* reintenta en el próximo tick */ }
    };
    tick();
    const iv = setInterval(() => { setElapsed(Date.now() - t0); tick(); }, 1500);
    return () => { alive = false; clearInterval(iv); };
  }, [id]);

  const done = st?.status === "READY" || st?.status === "DELIVERED";
  const failed = st?.status === "FAILED";

  // Lista de platos a mostrar: los reales cuando ya existen; si no, la muestra del preview.
  const items = useMemo(() => {
    if (st?.categories.length) return st.categories.flatMap((c) => c.dishes.map((d) => ({ key: d.id, name: d.name, price: d.price, photo: d.photo, category: c.name })));
    return (st?.preview?.sampleDishes ?? []).map((d, i) => ({ key: `p${i}`, name: d.name, price: d.price, photo: d.imageUrl ?? null, category: d.category ?? "" }));
  }, [st]);

  // Aparecen de a uno.
  useEffect(() => {
    if (revealed >= items.length) return;
    const t = setTimeout(() => setRevealed((n) => n + 1), reduce ? 0 : 140);
    return () => clearTimeout(t);
  }, [revealed, items.length, reduce]);

  const shown = items.slice(0, revealed);
  const categories = [...new Set(shown.map((d) => d.category).filter(Boolean))];
  const total = Math.max(st?.dishCount ?? 0, st?.preview?.totalDishes ?? 0, shown.length);
  const counter = done ? total : Math.min(total, revealed || total);
  const logo = st?.restaurant?.logoUrl ?? st?.preview?.logoUrl ?? null;
  const name = st?.restaurant?.name ?? st?.preview?.restaurantName ?? st?.localName ?? "";

  const fade = reduce ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35 } };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
      <div style={{ minHeight: 112, display: "grid", placeItems: "center", marginTop: 10 }}>
        <AnimatePresence>
          {logo ? (
            <motion.img key="logo" src={logo} alt={name} {...fade} style={{ width: 104, height: 104, objectFit: "contain", borderRadius: 22, background: "#fff", border: "1px solid var(--line)", padding: 8 }} />
          ) : (done || failed) && name ? (
            <motion.div key="initial" {...fade} style={{ width: 104, height: 104, borderRadius: 22, background: "var(--amber)", color: "#fff", display: "grid", placeItems: "center", fontSize: 48, fontWeight: 800 }}>
              {name.trim().charAt(0).toUpperCase()}
            </motion.div>
          ) : (
            <motion.div key="dots" style={{ display: "flex", gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <motion.span key={i} animate={reduce ? {} : { scale: [0.8, 1.15, 0.8], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.1, delay: i * 0.15 }}
                  style={{ width: 13, height: 13, borderRadius: "50%", background: i === 1 ? "var(--amber)" : "#F4C77E", display: "inline-block" }} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <h1 style={{ fontSize: "clamp(26px, 5vw, 40px)", fontWeight: 800, letterSpacing: "-.03em", margin: "14px 0 4px" }}>{name || "Armando su local…"}</h1>
      <p style={{ color: "var(--ink-3)", margin: 0, fontSize: 15 }}>
        {failed ? "No pudimos leer esta carta. A veces es pasajero: prueba reintentar." : done ? "¡Listo! Su carta ya está en QuieroComer" : elapsed > 25000 ? `Armando la carta completa… ${Math.floor(elapsed / 60000)}:${String(Math.floor(elapsed / 1000) % 60).padStart(2, "0")} · las cartas grandes tardan 1 a 3 minutos` : "Leyendo la carta y armando su local…"}
      </p>

      {failed && st?.error && (
        <p style={{ margin: "10px auto 0", maxWidth: 520, fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--mono, monospace)", wordBreak: "break-word" }}>Detalle: {st.error.slice(0, 240)}</p>
      )}
      <div style={{ margin: "22px 0 18px" }}>
        <div className="ventas-mono" style={{ fontSize: "clamp(44px, 9vw, 64px)", fontWeight: 600, color: "var(--amber)", lineHeight: 1 }}>{counter}</div>
        <div style={{ fontSize: 14, color: "var(--ink-3)", marginTop: 4 }}>platos encontrados{categories.length ? ` · ${categories.length} categorías` : ""}</div>
      </div>

      {categories.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 16 }}>
          <AnimatePresence>
            {categories.map((c) => (
              <motion.span key={c} {...fade} style={{ fontSize: 13, fontWeight: 600, padding: "5px 12px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--line)" }}>{c}</motion.span>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, textAlign: "left" }}>
        <AnimatePresence>
          {shown.slice(-12).map((d) => (
            <motion.div key={d.key} {...fade} className="ventas-card" style={{ overflow: "hidden" }}>
              {d.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.photo} alt="" style={{ width: "100%", height: 96, objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{ height: 6, background: "var(--amber-tint)" }} />
              )}
              <div style={{ padding: "9px 11px" }}>
                <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{d.name}</div>
                {d.price > 0 && <div className="ventas-mono" style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 3 }}>{clp(d.price)}</div>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 26 }}>
        {done && <Link href={`/ventas/${id}/revision`} className="ventas-btn" style={{ fontSize: 17, padding: "15px 28px" }}>Revisar carta →</Link>}
        {failed && (
          <>
            <button className="ventas-btn" onClick={() => { setSt((s) => (s ? { ...s, status: "PROCESSING" } : s)); fetch(`/api/ventas/leads/${id}/process`, { method: "POST" }).catch(() => {}); }}>↻ Reintentar</button>
            <Link href={`/ventas/${id}`} className="ventas-btn ghost">Seguir con el local de ejemplo</Link>
            <Link href="/ventas/nuevo" className="ventas-btn ghost">Probar con otra foto o link</Link>
          </>
        )}
        {!done && !failed && elapsed > SLOW_MS && (
          <Link href={`/ventas/${id}`} className="ventas-btn ghost">Empezar con el local de ejemplo mientras termina</Link>
        )}
      </div>
    </div>
  );
}
