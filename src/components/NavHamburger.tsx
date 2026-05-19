"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const OVERLAY_CSS = `
.nav-menu-overlay{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0);pointer-events:none;transition:background .35s ease}
.nav-menu-overlay.nav-menu-open{background:rgba(0,0,0,.65);pointer-events:auto;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.nav-menu-panel{position:absolute;top:0;right:0;width:min(340px,85vw);height:100%;background:#0e0c0a;border-left:1px solid rgba(232,163,61,.12);transform:translateX(100%);transition:transform .35s cubic-bezier(.16,1,.3,1);display:flex;flex-direction:column;box-shadow:-20px 0 60px rgba(0,0,0,.7)}
.nav-menu-open .nav-menu-panel{transform:translateX(0)}
.nav-menu-header{display:flex;align-items:center;justify-content:space-between;padding:20px 22px;border-bottom:1px solid rgba(255,255,255,.06)}
.nav-menu-close{background:none;border:1px solid rgba(255,255,255,.1);border-radius:10px;width:34px;height:34px;display:grid;place-items:center;cursor:pointer;color:#C9BBA0;transition:.2s}
.nav-menu-close:hover{border-color:#E8A33D;color:#E8A33D}
.nav-menu-links{flex:1;padding:16px 12px;display:flex;flex-direction:column;gap:4px}
.nav-menu-item{display:flex;align-items:center;gap:14px;padding:14px 14px;border-radius:14px;text-decoration:none;color:#E8DDC8;transition:background .2s;border-bottom:1px solid rgba(255,255,255,.04)}
.nav-menu-item:hover{background:rgba(232,163,61,.06)}
.nav-menu-item-icon{width:32px;height:32px;display:grid;place-items:center;color:rgba(232,163,61,.5);flex-shrink:0}
.nav-menu-item-title{display:block;font-size:15px;font-weight:600;color:#E8DDC8;letter-spacing:.01em}
.nav-menu-item-desc{display:block;font-size:12px;color:#C9BBA0;opacity:.6;margin-top:1px}
`;

export default function NavHamburger() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const portalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = document.createElement("div");
    el.id = "nav-menu-portal";
    document.body.appendChild(el);
    portalRef.current = el;
    setMounted(true);
    return () => { document.body.removeChild(el); };
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const menuOverlay = (
    <>
      <style dangerouslySetInnerHTML={{ __html: OVERLAY_CSS }} />
      <div
        className={`nav-menu-overlay ${menuOpen ? "nav-menu-open" : ""}`}
        onClick={() => setMenuOpen(false)}
      >
        <div className="nav-menu-panel" onClick={(e) => e.stopPropagation()}>
          <div className="nav-menu-header">
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 600, color: "#E8DDC8", display: "flex", alignItems: "center", gap: 10 }}>
              <img src="/landing/logo.png" alt="" style={{ height: 18, marginRight: -6 }} />
              QuieroComer
            </div>
            <button className="nav-menu-close" onClick={() => setMenuOpen(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="nav-menu-links">
            <a href="/" className="nav-menu-item" onClick={() => setMenuOpen(false)}>
              <div className="nav-menu-item-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </div>
              <span className="nav-menu-item-title">Inicio</span>
            </a>
            <a href="/clientes" className="nav-menu-item" onClick={() => setMenuOpen(false)}>
              <div className="nav-menu-item-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
              </div>
              <span className="nav-menu-item-title">Clientes</span>
            </a>
            <a href="/planes" className="nav-menu-item" onClick={() => setMenuOpen(false)}>
              <div className="nav-menu-item-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              </div>
              <span className="nav-menu-item-title">Planes</span>
            </a>
            <a href="/contacto" className="nav-menu-item" onClick={() => setMenuOpen(false)}>
              <div className="nav-menu-item-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
              </div>
              <span className="nav-menu-item-title">Contacto</span>
            </a>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div
      onClick={() => setMenuOpen(!menuOpen)}
      role="button"
      aria-label="Menú"
      style={{
        background: "none",
        border: "1px solid rgba(232,163,61,.2)",
        borderRadius: 10,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        width: 38,
        height: 38,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <div style={{ width: 18, height: 2, background: "#E8DDC8", borderRadius: 2, transition: "all .3s", transform: menuOpen ? "translateY(6px) rotate(45deg)" : "none" }} />
      <div style={{ width: 18, height: 2, background: "#E8DDC8", borderRadius: 2, transition: "all .3s", opacity: menuOpen ? 0 : 1 }} />
      <div style={{ width: 18, height: 2, background: "#E8DDC8", borderRadius: 2, transition: "all .3s", transform: menuOpen ? "translateY(-6px) rotate(-45deg)" : "none" }} />
      {mounted && portalRef.current && createPortal(menuOverlay, portalRef.current)}
    </div>
  );
}
