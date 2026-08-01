"use client";

export default function CartaPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
        :root {
          --blanco: #FFFFFF;
          --tinta: #111111;
          --gris: #71716C;
          --gris-claro: #A8A8A2;
          --ambar: #F59E1B;
          --ambar-hover: #E08D0C;
          --ambar-tinta: #8F5A05;
          --ambar-fondo: #FFF7EA;
          --linea: #ECECEA;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Instrument Sans', sans-serif; }
        .carta-page { font-family: 'Instrument Sans', sans-serif; color: var(--tinta); }

        /* NAV */
        .carta-nav {
          position: sticky; top: 0; z-index: 100;
          background: rgba(10,10,10,0.9);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          padding: 0 24px; height: 60px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .carta-nav-inner { max-width: 1200px; width: 100%; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
        .carta-nav-back { font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.7); text-decoration: none; display: flex; align-items: center; gap: 6px; transition: color .2s; }
        .carta-nav-back:hover { color: white; }
        .carta-nav-cta { font-size: 14px; font-weight: 600; color: #111; background: var(--ambar); border: none; border-radius: 8px; padding: 8px 18px; cursor: pointer; font-family: inherit; text-decoration: none; display: inline-block; transition: opacity .2s; }
        .carta-nav-cta:hover { opacity: 0.88; }

        /* HERO */
        .carta-hero {
          background: #0A0A0A;
          padding: 100px 24px 90px;
          text-align: center;
        }
        .carta-hero-inner { max-width: 760px; margin: 0 auto; }
        .carta-label {
          display: inline-block;
          font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--ambar); border: 1px solid rgba(245,158,27,0.4);
          border-radius: 100px; padding: 5px 14px; margin-bottom: 28px;
        }
        .carta-hero h1 {
          font-size: clamp(40px, 7vw, 72px); font-weight: 700; color: white;
          line-height: 1.05; letter-spacing: -0.03em; margin-bottom: 20px;
        }
        .carta-hero-sub { font-size: 18px; color: rgba(255,255,255,0.6); line-height: 1.65; margin-bottom: 40px; max-width: 520px; margin-left: auto; margin-right: auto; }
        .carta-hero-cta { display: flex; gap: 14px; justify-content: center; align-items: center; flex-wrap: wrap; }
        .carta-btn-ambar { font-size: 16px; font-weight: 700; color: #fff; background: var(--ambar); border: none; border-radius: 12px; padding: 14px 32px; cursor: pointer; font-family: inherit; text-decoration: none; display: inline-block; transition: opacity .2s; }
        .carta-btn-ambar:hover { opacity: 0.88; }
        .carta-btn-outline { font-size: 15px; font-weight: 600; color: white; background: transparent; border: 1.5px solid rgba(255,255,255,0.25); border-radius: 12px; padding: 13px 28px; text-decoration: none; display: inline-block; transition: border-color .2s, background .2s; }
        .carta-btn-outline:hover { border-color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.05); }

        /* PHONE SECTION */
        .carta-phone-section {
          background: #0A0A0A;
          padding: 0 24px 80px;
          display: flex; justify-content: center;
        }
        .carta-iphone {
          width: 230px; height: 400px;
          background: #0A0A0A; border-radius: 40px;
          border: 7px solid #2a2a2a;
          box-shadow: 0 0 0 1px #3a3a3a, 0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(245,158,27,0.08);
          overflow: hidden; position: relative;
        }
        .carta-iphone-notch {
          width: 90px; height: 22px;
          background: #0A0A0A; border-radius: 0 0 16px 16px;
          margin: 0 auto; position: relative; z-index: 3;
        }
        .carta-iphone-screen {
          position: absolute; inset: 0;
          background: #111; overflow: hidden;
          display: flex; flex-direction: column;
        }
        .carta-iphone-hero {
          height: 140px; flex-shrink: 0; position: relative;
          background: linear-gradient(135deg, #FF6B35 0%, #F7C59F 40%, #EFEFD0 100%);
        }
        .carta-iphone-hero-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%);
        }
        .carta-iphone-hero-text {
          position: absolute; bottom: 10px; left: 12px; right: 12px;
        }
        .carta-iphone-hero-text h4 { font-size: 13px; font-weight: 700; color: white; margin-bottom: 2px; }
        .carta-iphone-hero-text p { font-size: 9px; color: rgba(255,255,255,0.7); }
        .carta-iphone-pills {
          display: flex; gap: 6px; padding: 10px 10px 6px;
          overflow-x: auto; scrollbar-width: none; flex-shrink: 0;
        }
        .carta-iphone-pills::-webkit-scrollbar { display: none; }
        .carta-iphone-pill {
          padding: 4px 10px; border-radius: 100px;
          font-size: 8px; font-weight: 600; white-space: nowrap; flex-shrink: 0;
        }
        .carta-iphone-pill-active { background: var(--ambar); color: #000; }
        .carta-iphone-pill-inactive { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); }
        .carta-iphone-dishes { flex: 1; overflow-y: auto; padding: 4px 10px; scrollbar-width: none; }
        .carta-iphone-dishes::-webkit-scrollbar { display: none; }
        .carta-iphone-dish {
          display: flex; gap: 8px; align-items: center;
          padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .carta-iphone-dish:last-child { border-bottom: none; }
        .carta-iphone-dish-img {
          width: 44px; height: 44px; border-radius: 8px; flex-shrink: 0;
        }
        .carta-iphone-dish-info { flex: 1; }
        .carta-iphone-dish-info h5 { font-size: 9px; font-weight: 600; color: white; margin-bottom: 2px; }
        .carta-iphone-dish-info p { font-size: 8px; color: rgba(255,255,255,0.5); line-height: 1.3; }
        .carta-iphone-dish-price { font-size: 9px; font-weight: 700; color: var(--ambar); flex-shrink: 0; }

        /* FEATURES */
        .carta-features { padding: 80px 24px; background: white; }
        .carta-features-inner { max-width: 1100px; margin: 0 auto; }
        .carta-features-title { font-size: clamp(26px, 4vw, 40px); font-weight: 700; color: var(--tinta); letter-spacing: -0.02em; text-align: center; margin-bottom: 56px; }
        .carta-features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        @media (max-width: 900px) { .carta-features-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px) { .carta-features-grid { grid-template-columns: 1fr; } }
        .carta-feature-card { background: #FAFAF8; border: 1.5px solid var(--linea); border-radius: 16px; padding: 24px; display: flex; gap: 14px; align-items: flex-start; }
        .carta-feature-icon { width: 40px; height: 40px; border-radius: 10px; background: var(--ambar-fondo); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
        .carta-feature-content h3 { font-size: 16px; font-weight: 700; color: var(--tinta); margin-bottom: 6px; }
        .carta-feature-content p { font-size: 13px; color: var(--gris); line-height: 1.65; }

        /* CTA SECTION */
        .carta-cta { padding: 72px 24px; background: #111; text-align: center; }
        .carta-cta h2 { font-size: clamp(24px, 4vw, 38px); font-weight: 700; color: white; letter-spacing: -0.02em; margin-bottom: 10px; }
        .carta-cta p { font-size: 16px; color: rgba(255,255,255,0.6); margin-bottom: 28px; }
        .carta-cta-btn {
          display: inline-block; font-size: 16px; font-weight: 700;
          color: #111; background: var(--ambar); border-radius: 12px;
          padding: 14px 36px; text-decoration: none; transition: opacity .2s;
        }
        .carta-cta-btn:hover { opacity: 0.88; }

        /* FOOTER */
        .carta-footer { padding: 56px 24px 32px; background: #0F0F0F; }
        .carta-footer-inner { max-width: 1200px; margin: 0 auto; }
        .carta-footer-top { display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 40px; margin-bottom: 48px; }
        @media (max-width: 760px) { .carta-footer-top { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 480px) { .carta-footer-top { grid-template-columns: 1fr; } }
        .carta-footer-brand p { font-size: 13px; color: rgba(255,255,255,0.45); line-height: 1.65; margin-top: 10px; max-width: 220px; }
        .carta-footer-logo { font-size: 17px; font-weight: 700; color: white; letter-spacing: -0.02em; }
        .carta-footer-logo span { color: var(--ambar); }
        .carta-footer-col h4 { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 16px; }
        .carta-footer-col-links { display: flex; flex-direction: column; gap: 10px; }
        .carta-footer-link { font-size: 14px; color: rgba(255,255,255,0.6); text-decoration: none; transition: color .2s; }
        .carta-footer-link:hover { color: white; }
        .carta-footer-bottom { border-top: 1px solid rgba(255,255,255,0.08); padding-top: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .carta-footer-copy { font-size: 12px; color: rgba(255,255,255,0.3); }

        @media (max-width: 680px) {
          .carta-hero { padding: 72px 20px 64px; }
          .carta-features { padding: 56px 20px; }
        }
      `}</style>

      <div className="carta-page">

        {/* NAV */}
        <nav className="carta-nav">
          <div className="carta-nav-inner">
            <a href="/" className="carta-nav-back">← QuieroComer</a>
            <a href="/" className="carta-nav-cta">Probar gratis</a>
          </div>
        </nav>

        {/* HERO */}
        <section className="carta-hero">
          <div className="carta-hero-inner">
            <span className="carta-label">Carta QR</span>
            <h1>Una carta que realmente antoja</h1>
            <p className="carta-hero-sub">
              Tu menú presentado como merece: con fotos que antojan, categorías claras y listo en minutos.
            </p>
            <div className="carta-hero-cta">
              <a href="https://quierocomer.com/qr/alleria-pizza" target="_blank" rel="noopener noreferrer" className="carta-btn-ambar">
                Ver carta en vivo →
              </a>
              <a href="/" className="carta-btn-outline">
                Probar 7 días gratis
              </a>
            </div>
          </div>
        </section>

        {/* PHONE MOCKUP */}
        <section className="carta-phone-section">
          <div className="carta-iphone">
            <div className="carta-iphone-notch"></div>
            <div className="carta-iphone-screen">
              <div className="carta-iphone-hero">
                <img src="https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/dishes/cmoj3lr3c0000lb04i3p3fuao-1783901270166-pizza-alla-genovese.webp" alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} />
                <div className="carta-iphone-hero-overlay"></div>
                <div className="carta-iphone-hero-text">
                  <h4>Alleria Pizza</h4>
                  <p>📍 Providencia · Carta digital</p>
                </div>
              </div>
              <div className="carta-iphone-pills">
                <span className="carta-iphone-pill carta-iphone-pill-active">Todo</span>
                <span className="carta-iphone-pill carta-iphone-pill-inactive">Entradas</span>
                <span className="carta-iphone-pill carta-iphone-pill-inactive">Pizzas</span>
                <span className="carta-iphone-pill carta-iphone-pill-inactive">Postres</span>
              </div>
              <div className="carta-iphone-dishes">
                {[
                  { name: "Pizza alla Genovese", desc: "Filete y cebollas 10 hrs.", price: "$24.680", img: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/dishes/cmoj3lr3c0000lb04i3p3fuao-1783901270166-pizza-alla-genovese.webp" },
                  { name: "Arancinis di Riso", desc: "Risotto con carne y ragú", price: "$13.400", img: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/dishes/cmoj3lr3c0000lb04i3p3fuao-1778093711966-arancinis-di-riso.webp" },
                  { name: "Pasta alla Genovese", desc: "Receta tradicional Nonna", price: "$18.980", img: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/dishes/cmoj3lr3c0000lb04i3p3fuao-1783875855139-pasta-alla-genovese.webp" },
                  { name: "Baba Napolitana", desc: "Nutella, chantilly, ron", price: "$10.900", img: "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/dishes/cmoj3lr3c0000lb04i3p3fuao-1780618444541-baba-napolitana.webp" },
                ].map((dish, i) => (
                  <div key={i} className="carta-iphone-dish">
                    <img src={dish.img} alt={dish.name} className="carta-iphone-dish-img" style={{objectFit:"cover"}} />
                    <div className="carta-iphone-dish-info">
                      <h5>{dish.name}</h5>
                      <p>{dish.desc}</p>
                    </div>
                    <span className="carta-iphone-dish-price">{dish.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="carta-features">
          <div className="carta-features-inner">
            <h2 className="carta-features-title">Todo lo que tu carta necesita</h2>
            <div className="carta-features-grid">
              {[
                { icon: "📸", title: "Fotos que antojan", desc: "Sube fotos de tus platos y se muestran en un formato que convierte el apetito en pedidos." },
                { icon: "🛎️", title: "Llamado al garzón", desc: "El cliente llama al mozo con un toque desde su teléfono. Sin papelitos ni botones físicos." },
                { icon: "📊", title: "Estadísticas en tiempo real", desc: "Mira qué platos miran más, a qué hora llega gente y cuáles se piden más." },
                { icon: "📢", title: "Anuncios y promos", desc: "Comunica el menú del día, eventos o promociones directo al abrir la carta." },
                { icon: "🌍", title: "Multi-idioma automático", desc: "Tu carta se traduce automáticamente para turistas sin que tú hagas nada." },
                { icon: "📱", title: "Pedidos online", desc: "Activa pedidos directo desde la carta. Sin comisión ni app de terceros." },
              ].map((f, i) => (
                <div key={i} className="carta-feature-card">
                  <div className="carta-feature-icon">{f.icon}</div>
                  <div className="carta-feature-content">
                    <h3>{f.title}</h3>
                    <p>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="carta-cta">
          <h2>Lista para tu restaurant al instante</h2>
          <p>Sin tarjeta de crédito. Cancelación cuando quieras.</p>
          <a href="/" className="carta-cta-btn">Empezar gratis 7 días</a>
        </section>

        {/* FOOTER */}
        <footer className="carta-footer">
          <div className="carta-footer-inner">
            <div className="carta-footer-top">
              <div className="carta-footer-brand">
                <div className="carta-footer-logo">QuieroCome<span>r</span></div>
                <p>Carta QR con fotos que antojan, en segundos.</p>
              </div>
              <div className="carta-footer-col">
                <h4>Producto</h4>
                <div className="carta-footer-col-links">
                  <a href="/" className="carta-footer-link">Inicio</a>
                  <a href="/fidelizacion" className="carta-footer-link">Loyalty</a>
                  <a href="/#precios" className="carta-footer-link">Precios</a>
                  <a href="/panel/login" className="carta-footer-link">Ingresar</a>
                </div>
              </div>
              <div className="carta-footer-col">
                <h4>Contacto</h4>
                <div className="carta-footer-col-links">
                  <a href="https://wa.me/56999946208?text=Hola%20tengo%20una%20consulta%20sobre%20QuieroComer" target="_blank" rel="noopener noreferrer" className="carta-footer-link">WhatsApp</a>
                  <a href="https://instagram.com/quierocomer" target="_blank" rel="noopener noreferrer" className="carta-footer-link">Instagram</a>
                </div>
              </div>
            </div>
            <div className="carta-footer-bottom">
              <span className="carta-footer-copy">© 2026 QuieroComer · Santiago de Chile 🇨🇱</span>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
