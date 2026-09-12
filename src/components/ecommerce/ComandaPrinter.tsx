"use client";
// Imprime la comanda dentro de un iframe AISLADO: el documento a imprimir contiene
// únicamente el ticket, así el alto de página es exacto y no se "come" el rollo.
// Compatible con --kiosk-printing (imprime sin diálogo).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ComandaPrint, { type ComandaOrder } from "./ComandaPrint";

export default function ComandaPrinter({ order, storeName, paperWidth, onDone }: { order: ComandaOrder | null; storeName: string; paperWidth: 58 | 80; onDone: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);

  // Al recibir un pedido, prepara un documento vacío dentro del iframe.
  useEffect(() => {
    if (!order) { setBody(null); return; }
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write("<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>");
    doc.close();
    setBody(doc.body);
  }, [order]);

  // Cuando el ticket ya se renderizó (portal) en el iframe, imprime.
  useEffect(() => {
    if (!order || !body) return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const t = setTimeout(() => {
      try { win.focus(); win.print(); } catch { /* noop */ }
      onDone();
    }, 200);
    return () => clearTimeout(t);
  }, [order, body, onDone]);

  return (
    <>
      <iframe ref={iframeRef} title="comanda" aria-hidden style={{ position: "fixed", right: 0, bottom: 0, width: 0, height: 0, border: 0, visibility: "hidden" }} />
      {order && body && createPortal(<ComandaPrint order={order} storeName={storeName} paperWidth={paperWidth} />, body)}
    </>
  );
}
