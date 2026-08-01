export default function LandingFooter() {
  return (
    <>
      <style>{`
        .lf-footer { padding: 56px 24px 32px; background: #0F0F0F; }
        .lf-footer-inner { max-width: 1200px; margin: 0 auto; }
        .lf-footer-top { display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 40px; margin-bottom: 48px; }
        @media (max-width: 760px) { .lf-footer-top { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 480px) { .lf-footer-top { grid-template-columns: 1fr; } }
        .lf-footer-brand p { font-size: 13px; color: rgba(255,255,255,0.45); line-height: 1.65; margin-top: 10px; max-width: 220px; }
        .lf-footer-logo { font-size: 17px; font-weight: 700; color: white; letter-spacing: -0.02em; display: flex; align-items: center; gap: 7px; font-family: 'Instrument Sans', system-ui, sans-serif; }
        .lf-footer-logo img { width: 22px; height: 22px; display: block; flex-shrink: 0; }
        .lf-footer-col h4 { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 16px; font-family: 'Instrument Sans', system-ui, sans-serif; }
        .lf-footer-col-links { display: flex; flex-direction: column; gap: 10px; }
        .lf-footer-link { font-size: 14px; color: rgba(255,255,255,0.6); text-decoration: none; transition: color .2s; font-family: 'Instrument Sans', system-ui, sans-serif; }
        .lf-footer-link:hover { color: white; }
        .lf-footer-wa { display: flex; align-items: center; gap: 7px; font-size: 14px; color: rgba(255,255,255,0.6); text-decoration: none; transition: color .2s; font-family: 'Instrument Sans', system-ui, sans-serif; }
        .lf-footer-wa:hover { color: #25D366; }
        .lf-footer-ig { display: flex; align-items: center; gap: 7px; font-size: 14px; color: rgba(255,255,255,0.6); text-decoration: none; transition: color .2s; font-family: 'Instrument Sans', system-ui, sans-serif; }
        .lf-footer-ig:hover { color: #E1306C; }
        .lf-footer-bottom { border-top: 1px solid rgba(255,255,255,0.08); padding-top: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .lf-footer-copy { font-size: 12px; color: rgba(255,255,255,0.3); font-family: 'Instrument Sans', system-ui, sans-serif; }
        .lf-footer-badge { font-size: 12px; color: rgba(255,255,255,0.3); font-family: 'Instrument Sans', system-ui, sans-serif; }
      `}</style>

      <footer className="lf-footer">
        <div className="lf-footer-inner">
          <div className="lf-footer-top">
            <div className="lf-footer-brand">
              <div className="lf-footer-logo">
                <img src="/logo.png" alt="" />
                QuieroComer
              </div>
              <p>Plataforma digital para restaurantes chilenos. Carta QR, fidelización y pedidos online.</p>
            </div>
            <div className="lf-footer-col">
              <h4>Producto</h4>
              <div className="lf-footer-col-links">
                <a href="/carta-qr" className="lf-footer-link">Carta QR</a>
                <a href="/fidelizacion" className="lf-footer-link">Loyalty</a>
                <a href="/#precios" className="lf-footer-link">Precios</a>
                <a href="/panel/login" className="lf-footer-link">Ingresar al panel</a>
              </div>
            </div>
            <div className="lf-footer-col">
              <h4>Contacto</h4>
              <div className="lf-footer-col-links">
                <a href="https://wa.me/56999946208?text=Hola%20tengo%20una%20consulta%20sobre%20QuieroComer" target="_blank" rel="noopener noreferrer" className="lf-footer-wa">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </a>
                <a href="https://instagram.com/quierocomer" target="_blank" rel="noopener noreferrer" className="lf-footer-ig">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                  Instagram
                </a>
              </div>
            </div>
          </div>
          <div className="lf-footer-bottom">
            <span className="lf-footer-copy">© 2026 QuieroComer</span>
            <span className="lf-footer-badge">Santiago de Chile 🇨🇱</span>
          </div>
        </div>
      </footer>
    </>
  );
}
