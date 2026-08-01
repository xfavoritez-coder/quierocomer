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
        .carta-nav-cta { font-size: 14px; font-weight: 600; color: white; background: var(--ambar); border: none; border-radius: 8px; padding: 8px 18px; cursor: pointer; font-family: inherit; text-decoration: none; display: inline-block; transition: background .2s; }
        .carta-nav-cta:hover { background: var(--ambar-hover); }

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
        .carta-btn-ambar { font-size: 16px; font-weight: 700; color: var(--ambar-tinta); background: var(--ambar); border: none; border-radius: 12px; padding: 14px 32px; cursor: pointer; font-family: inherit; text-decoration: none; display: inline-block; transition: background .2s; }
        .carta-btn-ambar:hover { background: var(--ambar-hover); color: #6B4004; }
        .carta-btn-outline { font-size: 15px; font-weight: 600; color: white; background: transparent; border: 1.5px solid rgba(255,255,255,0.25); border-radius: 12px; padding: 13px 28px; text-decoration: none; display: inline-block; transition: border-color .2s, background .2s; }
        .carta-btn-outline:hover { border-color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.05); }

        /* FEATURES */
        .carta-features { padding: 80px 24px; background: white; }
        .carta-features-inner { max-width: 1100px; margin: 0 auto; }
        .carta-features-title { font-size: clamp(26px, 4vw, 40px); font-weight: 700; color: var(--tinta); letter-spacing: -0.02em; text-align: center; margin-bottom: 56px; }
        .carta-features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        @media (max-width: 900px) { .carta-features-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px) { .carta-features-grid { grid-template-columns: 1fr; } }
        .carta-feature-card { background: #FAFAF8; border: 1.5px solid var(--linea); border-radius: 16px; padding: 28px; }
        .carta-feature-icon { font-size: 28px; margin-bottom: 14px; display: block; }
        .carta-feature-card h3 { font-size: 17px; font-weight: 700; color: var(--tinta); margin-bottom: 8px; }
        .carta-feature-card p { font-size: 14px; color: var(--gris); line-height: 1.65; }

        /* DEMO */
        .carta-demo { padding: 80px 24px; background: #F5F5F3; }
        .carta-demo-inner { max-width: 760px; margin: 0 auto; text-align: center; }
        .carta-demo h2 { font-size: clamp(26px, 4vw, 38px); font-weight: 700; color: var(--tinta); letter-spacing: -0.02em; margin-bottom: 10px; }
        .carta-demo-sub { font-size: 16px; color: var(--gris); margin-bottom: 40px; line-height: 1.55; }
        .carta-demo-card {
          background: white; border-radius: 20px; padding: 32px;
          border: 1.5px solid var(--linea);
          box-shadow: 0 8px 32px rgba(0,0,0,0.06);
          display: flex; align-items: center; gap: 24px;
          text-align: left;
        }
        @media (max-width: 560px) { .carta-demo-card { flex-direction: column; text-align: center; } }
        .carta-demo-logo { width: 72px; height: 72px; border-radius: 16px; object-fit: cover; flex-shrink: 0; background: var(--linea); }
        .carta-demo-info h3 { font-size: 18px; font-weight: 700; color: var(--tinta); margin-bottom: 4px; }
        .carta-demo-info p { font-size: 14px; color: var(--gris); line-height: 1.55; margin-bottom: 16px; }
        .carta-demo-open {
          display: inline-block; font-size: 14px; font-weight: 600; color: var(--ambar-tinta);
          background: var(--ambar-fondo); border: 1.5px solid rgba(245,158,27,0.3);
          border-radius: 8px; padding: 9px 18px; text-decoration: none; transition: background .2s;
        }
        .carta-demo-open:hover { background: #FFF0CC; }

        /* PHONE MOCK */
        .carta-phone-wrap { display: flex; justify-content: center; margin-bottom: 0; }
        .carta-phone {
          width: 160px; height: 280px;
          background: #0A0A0A; border-radius: 28px;
          border: 6px solid #222;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          overflow: hidden; position: relative; flex-shrink: 0;
        }
        .carta-phone-screen { position: absolute; inset: 0; background: white; overflow: hidden; }
        .carta-phone-topbar { background: var(--ambar-fondo); padding: 8px 10px; border-bottom: 1px solid var(--linea); }
        .carta-phone-topbar h5 { font-size: 9px; font-weight: 700; color: var(--tinta); }
        .carta-phone-topbar p { font-size: 7px; color: var(--gris); }
        .carta-phone-item { display: flex; gap: 6px; padding: 6px 8px; border-bottom: 1px solid #F5F5F3; align-items: center; }
        .carta-phone-thumb { width: 32px; height: 32px; border-radius: 6px; flex-shrink: 0; }
        .carta-phone-item h6 { font-size: 8px; font-weight: 600; color: var(--tinta); margin-bottom: 2px; }
        .carta-phone-item p { font-size: 7px; color: var(--gris); }

        /* CTA SECTION */
        .carta-cta { padding: 64px 24px; background: var(--ambar); text-align: center; }
        .carta-cta h2 { font-size: clamp(24px, 4vw, 38px); font-weight: 700; color: var(--ambar-tinta); letter-spacing: -0.02em; margin-bottom: 10px; }
        .carta-cta p { font-size: 16px; color: var(--ambar-tinta); opacity: 0.85; margin-bottom: 28px; }
        .carta-cta-btn {
          display: inline-block; font-size: 16px; font-weight: 700;
          color: var(--ambar-tinta); background: white; border-radius: 12px;
          padding: 14px 36px; text-decoration: none; transition: opacity .2s;
        }
        .carta-cta-btn:hover { opacity: 0.88; }

        @media (max-width: 680px) {
          .carta-hero { padding: 72px 20px 64px; }
          .carta-features { padding: 56px 20px; }
          .carta-demo { padding: 56px 20px; }
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
            <span className="carta-label">Carta QR Inteligente</span>
            <h1>Tu carta que&nbsp;realmente antoja</h1>
            <p className="carta-hero-sub">
              Fotos profesionales, IA que recomienda y datos en tiempo real. Todo desde un QR.
            </p>
            <div className="carta-hero-cta">
              <a href="https://quierocomer.com/qr/horusvegan" target="_blank" rel="noopener noreferrer" className="carta-btn-ambar">
                Ver carta en vivo →
              </a>
              <a href="/" className="carta-btn-outline">
                Probar 7 días gratis
              </a>
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
                { icon: "✦", title: "Genio con IA", desc: "El Genio analiza el historial y sugiere el plato perfecto para cada cliente en ese momento." },
                { icon: "📊", title: "Estadísticas en tiempo real", desc: "Mira qué platos miran más, a qué hora llega gente y cuáles se piden más." },
                { icon: "📢", title: "Anuncios y promos", desc: "Comunica el menú del día, eventos o promociones directo al abrir la carta." },
                { icon: "🌍", title: "Multi-idioma automático", desc: "Tu carta se traduce automáticamente para turistas sin que tú hagas nada." },
                { icon: "📱", title: "Pedidos online", desc: "Activa pedidos directo desde la carta. Sin comisión ni app de terceros." },
              ].map((f, i) => (
                <div key={i} className="carta-feature-card">
                  <span className="carta-feature-icon">{f.icon}</span>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* DEMO */}
        <section className="carta-demo">
          <div className="carta-demo-inner">
            <h2>Mira cómo se ve en vivo</h2>
            <p className="carta-demo-sub">Esta es la carta real de Horus Vegan, uno de nuestros clientes.</p>
            <div className="carta-demo-card">
              <img
                src="https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/restaurants/horusvegan/logo.png"
                alt="Horus Vegan"
                className="carta-demo-logo"
              />
              <div className="carta-demo-info">
                <h3>Horus Vegan</h3>
                <p>Restaurante vegano en Santiago con carta digital activa en QuieroComer. Fotos de cada plato, recomendaciones con IA y estadísticas en tiempo real.</p>
                <a href="https://quierocomer.com/qr/horusvegan" target="_blank" rel="noopener noreferrer" className="carta-demo-open">
                  Abrir carta demo →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="carta-cta">
          <h2>Lista para tu restaurant en 24 horas</h2>
          <p>Sin tarjeta de crédito. Cancelación cuando quieras.</p>
          <a href="/" className="carta-cta-btn">Empezar gratis 7 días</a>
        </section>

      </div>
    </>
  );
}
