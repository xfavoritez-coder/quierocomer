"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ExternalLink, LayoutDashboard, MonitorSmartphone, QrCode, ShoppingBag } from "lucide-react";
import type { ChapterProps } from "../DemoShell";
import { BrandText, EASE, Eyebrow, Headline, Reveal, Stage, onColor, rgba, useViewport } from "../ui";

/** Última página: accesos para mostrar todo en vivo (carta, tienda, panel y POS de muestra). */
export default function Accesos({ data }: ChapterProps) {
  const { narrow } = useViewport();
  const c = data.color;
  const origin = typeof window !== "undefined" ? window.location.origin : "https://quierocomer.com";
  const links = data.slug ? [
    { icon: QrCode, title: "Su página", sub: "Carta, pedidos online, valoraciones y más, en un solo lugar.", url: `${origin}/${data.slug}` },
    { icon: ShoppingBag, title: "Su tienda online", sub: "Para pedir retiro o delivery, sin comisiones.", url: `${origin}/ecommerce/${data.slug}` },
  ] : [];
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <Stage style={{ flexDirection: "column" }}>
      <div style={{ textAlign: "center" }}>
        <Reveal step={0} at={0}><Eyebrow color={c}>Accesos</Eyebrow></Reveal>
        <Reveal step={0} at={0} delay={0.1}><Headline size="md" style={{ marginTop: 10 }}>Míralo <BrandText color={c}>funcionando.</BrandText></Headline></Reveal>
        <Reveal step={0} at={0} delay={0.18}><div style={{ fontSize: "clamp(15px, 1.3vw, 18px)", color: "rgba(0,0,0,.5)", marginTop: 8 }}>Escanea o abre cada uno. El panel y el POS son de un local de muestra con meses de datos.</div></Reveal>
      </div>
      <div onClick={stop} style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : `repeat(${links.length + 2}, minmax(0, 1fr))`, gap: 14, width: "min(1180px, 100%)", marginTop: "clamp(20px, 3.5vh, 38px)", paddingBottom: narrow ? 20 : 0 }}>
        {links.map((l, i) => (
          <Reveal key={l.title} step={0} at={0} delay={0.25 + i * 0.08} style={{ height: "100%" }}>
            <div style={{ height: "100%", boxSizing: "border-box", borderRadius: 26, padding: 20, background: "#fff", boxShadow: "0 0 0 1px rgba(0,0,0,.06), 0 24px 60px -34px rgba(0,0,0,.35)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 17 }}><l.icon size={18} color={c} /> {l.title}</div>
              <div style={{ fontSize: 13, color: "rgba(0,0,0,.5)", marginTop: 4 }}>{l.sub}</div>
              <div style={{ marginTop: 16, padding: 10, borderRadius: 16, boxShadow: "0 0 0 1px rgba(0,0,0,.08)" }}><QRCodeSVG value={l.url} size={narrow ? 150 : 170} level="M" fgColor="#111" /></div>
              <a href={l.url} target="_blank" rel="noreferrer" style={{ marginTop: "auto", paddingTop: 16, display: "inline-flex", alignItems: "center", gap: 6, color: c, fontWeight: 750, fontSize: 14, textDecoration: "none" }}>Abrir <ExternalLink size={14} /></a>
            </div>
          </Reveal>
        ))}
        <Reveal step={0} at={0} delay={0.4} style={{ height: "100%" }}>
          <ShowcaseCard to="panel" color={c} icon={LayoutDashboard} title="Panel del dueño" sub="Pedidos, clientes, carta, fidelización y reportes de un local de muestra." />
        </Reveal>
        <Reveal step={0} at={0} delay={0.48} style={{ height: "100%" }}>
          <ShowcaseCard to="pos" color={c} icon={MonitorSmartphone} title="POS en vivo" sub="Mesas, pedidos, sucursales, reportes y clientes recuperados." dark />
        </Reveal>
      </div>
    </Stage>
  );
}

/** Abre el panel o el POS del local de muestra en una pestaña nueva (sesión de muestra). */
function ShowcaseCard({ to, color: c, icon: Icon, title, sub, dark }: { to: "panel" | "pos"; color: string; icon: typeof QrCode; title: string; sub: string; dark?: boolean }) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true); setErr(null);
    // La pestaña se abre antes del fetch para que el navegador no la bloquee.
    const w = window.open("", "_blank");
    try {
      const r = await fetch(`/api/ventas/showcase?to=${to}`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.url) { w?.close(); setErr(d.error || "El local de muestra aún no está creado"); return; }
      if (w) w.location.href = d.url; else window.location.href = d.url;
    } catch { w?.close(); setErr("Error de conexión"); } finally { setBusy(false); }
  };
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.25, ease: EASE }}
      style={{ height: "100%", boxSizing: "border-box", borderRadius: 26, padding: 22, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column",
        background: dark ? `radial-gradient(130% 130% at 0% 0%, ${rgba(c, 0.55)} 0%, #141416 60%)` : `linear-gradient(160deg, ${rgba(c, 0.14)}, #fff 60%)`, color: dark ? "#fff" : "#111",
        boxShadow: dark ? `0 30px 70px -30px ${rgba(c, 0.8)}` : "0 0 0 1px rgba(0,0,0,.06), 0 24px 60px -34px rgba(0,0,0,.35)" }}>
      <div style={{ width: 46, height: 46, borderRadius: 15, display: "grid", placeItems: "center", background: c, color: onColor(c) }}><Icon size={22} /></div>
      <div style={{ fontWeight: 800, fontSize: 19, marginTop: 16 }}>{title}</div>
      <div style={{ fontSize: 13.5, color: dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.55)", marginTop: 6, lineHeight: 1.45 }}>{sub}</div>
      <div style={{ marginTop: "auto", paddingTop: 20 }}>
        <motion.button whileTap={{ scale: 0.97 }} onClick={open} disabled={busy}
          style={{ width: "100%", border: "none", cursor: "pointer", font: "inherit", fontWeight: 750, fontSize: 15, padding: "13px 0", borderRadius: 14, background: dark ? "#fff" : c, color: dark ? "#111" : onColor(c), display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: busy ? 0.7 : 1 }}>
          {busy ? "Abriendo…" : <>Abrir <ExternalLink size={15} /></>}
        </motion.button>
        {err && <div style={{ fontSize: 12.5, marginTop: 8, color: dark ? "#fca5a5" : "#dc2626" }}>{err}</div>}
      </div>
    </motion.div>
  );
}
