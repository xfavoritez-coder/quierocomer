import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Subir mi carta · QuieroComer",
  description: "Sube tu carta física, PDF o link QR y nuestra IA la transforma en una Carta Viva.",
};

export default function SubirCartaPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div dangerouslySetInnerHTML={{ __html: BODY }} />
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </>
  );
}

const STYLES = `
:root {
  --black: #090806;--black-2: #120f0b;--card: rgba(18, 14, 10, .76);--card-2: rgba(255, 255, 255, .045);
  --line: rgba(242, 229, 207, .14);--line-strong: rgba(232, 163, 61, .44);
  --amber: #E8A33D;--amber-2: #E8A33D;--amber-3: #B8801A;
  --cream: #F2E5CF;--cream-2: #CDBB9D;--muted: #887B68;
  --font-display: 'Cormorant Garamond', serif;--font-body: 'Inter', sans-serif;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { min-height: 100vh!important; background: linear-gradient(180deg, rgba(9,8,6,.72), rgba(9,8,6,.96)), url('/landing/fondo.png') center/cover no-repeat!important; background-size: cover!important; background-attachment: fixed!important; color: var(--cream)!important; font-family: var(--font-body)!important; line-height: 1.55!important; -webkit-font-smoothing: antialiased; overflow-x: hidden!important; }
.grain { position: fixed; inset: 0; pointer-events: none; z-index: 30; opacity: .13; mix-blend-mode: overlay; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.6'/%3E%3C/svg%3E"); }
a { color: inherit; text-decoration: none; }
.page { width: min(100% - 28px, 1120px); margin: 0 auto; padding: 80px 0 34px; position: relative; z-index: 2; }
.steps { display: flex; align-items: center; justify-content: center; gap: 0; margin: 24px auto 34px; max-width: 480px; }
.step { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 13px; }
.step-line { width: 28px; height: 1px; background: rgba(232,163,61,.15); margin: 0 6px; }
.step-number { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 600; border: 1px solid rgba(232,163,61,.2); background: transparent; color: var(--muted); }
.step.active { color: var(--amber-2); }
.step.active .step-number { color: var(--amber-2); border-color: var(--amber); background: rgba(232,163,61,.1); }
.shell { border: 1px solid var(--line); background: linear-gradient(180deg, rgba(14,11,8,.86), rgba(14,11,8,.62)); border-radius: 28px; padding: 24px; box-shadow: 0 28px 90px rgba(0,0,0,.38); backdrop-filter: blur(14px); position: relative; overflow: hidden; }
.centered-shell { max-width: 760px; margin: 0 auto; text-align: center; }
.shell::before { content: ''; position: absolute; width: 360px; height: 360px; right: -140px; top: 140px; border-radius: 50%; background: radial-gradient(circle, rgba(232,163,61,.16), transparent 70%); filter: blur(8px); pointer-events: none; }
h1 { font-family: var(--font-display); font-size: clamp(48px, 13vw, 74px); line-height: .94; font-weight: 500; letter-spacing: -.035em; margin-bottom: 18px; }
h1 span { color: var(--amber-2); font-style: italic; }
.method-title { text-align: center; margin: 28px 0 14px; color: var(--cream-2); }
.first-title { margin-top: 0; color: var(--cream-2); font-weight: 500; font-size: 19px; }
.centered-form { max-width: 620px; margin: 0 auto; }
.methods { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.method { border: 1px solid var(--line); background: rgba(255,255,255,.035); border-radius: 18px; padding: 16px 10px; text-align: center; min-height: 128px; display: grid; align-content: center; gap: 9px; color: var(--cream); cursor: pointer; transition: border-color .2s ease, background .2s ease, transform .2s ease; }
.method:hover, .method.active { transform: translateY(-2px); border-color: var(--line-strong); background: rgba(232,163,61,.075); }
.method svg { width: 32px; height: 32px; margin: 0 auto; color: var(--amber-2); }
.method span { font-size: 13px; color: var(--cream-2); }
.input-panel { margin-top: 18px; }
.hidden { display: none; }
.upload-card { margin-top: 20px; border: 1px dashed rgba(244,189,105,.75); background: radial-gradient(circle at 50% 0%, rgba(232,163,61,.12), transparent 42%), rgba(255,255,255,.035); border-radius: 24px; min-height: 230px; display: grid; place-items: center; text-align: center; padding: 32px 20px; box-shadow: inset 0 0 50px rgba(232,163,61,.055), 0 0 34px rgba(232,163,61,.08); transition: transform .22s ease, border-color .22s ease, background .22s ease; }
.compact-upload { margin-top: 18px; min-height: 160px; padding: 24px 20px; }
.upload-card:hover { transform: translateY(-2px); border-color: var(--amber-2); background: radial-gradient(circle at 50% 0%, rgba(232,163,61,.18), transparent 44%), rgba(255,255,255,.052); }
.upload-icon { width: 52px; height: 52px; margin: 0 auto 12px; display: grid; place-items: center; color: var(--amber-2); }
.upload-title { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
.upload-link { color: var(--amber-2); font-weight: 600; }
.formats { margin-top: 16px; color: var(--muted); font-size: 13px; }
.field-label { display: block; text-align: left; margin: 0 0 8px; color: var(--amber-2); font-size: 13px; font-weight: 700; }
input { width: 100%; height: 56px; border-radius: 16px; border: 1px solid var(--line); background: rgba(0,0,0,.32); color: var(--cream); padding: 0 16px; font: inherit; outline: none; }
input:focus { border-color: var(--amber); box-shadow: 0 0 0 3px rgba(232,163,61,.1); }
.trust { display: flex; justify-content: center; align-items: center; gap: 6px; color: var(--cream-2); font-size: 13px; margin: 22px 0 18px; }
.trust svg { flex-shrink: 0; color: var(--amber-2); width: 16px; height: 16px; }
.below-cta { margin: 10px auto 0; max-width: 520px; }
.cta { width: 100%; min-height: 62px; border: 0; border-radius: 18px; background: var(--amber); color: #160e06; font-size: 17px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 18px 58px rgba(232,163,61,.24); cursor: pointer; transition: transform .2s ease, box-shadow .2s ease; margin-top: 20px; }
.cta:hover { transform: translateY(-2px); box-shadow: 0 24px 72px rgba(232,163,61,.32); }
.sc-footer { padding: 44px 0; background: var(--black); border-top: 1px solid rgba(58,52,45,1); position: relative; z-index: 2; }
@media (min-width: 860px) { .page { padding-top: 80px; } .steps { width: 560px; margin: 0 auto 36px; } .shell { padding: 46px; } h1 { font-size: 70px; } .methods { gap: 14px; } }
@media (max-width: 390px) { h1 { font-size: 44px; } .methods { grid-template-columns: 1fr; } .method { min-height: 98px; } }
`;

const BODY = `
<div class="grain"></div>

<main class="page">
  <nav style="position:fixed;top:0;left:0;right:0;z-index:50;padding:20px clamp(22px,4vw,64px);display:flex;justify-content:space-between;align-items:center;background:linear-gradient(180deg,rgba(10,9,8,.92),rgba(10,9,8,.15));backdrop-filter:blur(8px)">
    <a href="/landing" style="font-family:var(--font-display);font-size:22px;font-weight:600;color:var(--cream);display:flex;align-items:center;gap:10px;letter-spacing:.02em;text-decoration:none">
      <img src="/landing/logo.png" alt="" style="height:22px;width:auto;margin-right:-8px" />
      QuieroComer
    </a>
    <a href="mailto:hola@quierocomer.cl" style="color:var(--cream-2);font-size:13px;text-decoration:none;letter-spacing:.04em">Ayuda</a>
  </nav>

  <section class="steps" aria-label="Progreso">
    <div class="step active"><div class="step-number">1</div><span>Subir carta</span></div>
    <div class="step-line"></div>
    <div class="step"><div class="step-number">2</div><span>Transformación</span></div>
    <div class="step-line"></div>
    <div class="step"><div class="step-number">3</div><span>Carta viva</span></div>
  </section>

  <section class="shell centered-shell">
    <div class="center-copy">
      <p style="color:var(--amber-2);font-size:13px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;margin-bottom:14px">Paso 1 de 3</p>
      <h1>Tu nueva carta<br>comienza <span>aquí.</span></h1>
    </div>
    <div class="form-side centered-form">
      <p class="method-title first-title">¿Cómo tienes tu carta?</p>
      <div class="methods">
        <button class="method" type="button" data-mode="pdf">
          <svg viewBox="0 0 64 64" fill="none"><path d="M20 8h18l10 10v38H20V8z" stroke="currentColor" stroke-width="3"/><path d="M38 8v12h10M26 32h16M26 40h16" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
          <strong>Tengo PDF</strong><span>o archivo digital</span>
        </button>
        <button class="method" type="button" data-mode="link">
          <svg viewBox="0 0 64 64" fill="none"><path d="M26 38l12-12M28 18l3-3a11 11 0 0 1 16 16l-4 4M36 46l-3 3a11 11 0 0 1-16-16l4-4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
          <strong>Tengo link</strong><span>de mi carta QR</span>
        </button>
        <button class="method" type="button" data-mode="photo">
          <svg viewBox="0 0 64 64" fill="none"><path d="M16 22h8l4-6h8l4 6h8v26H16V22z" stroke="currentColor" stroke-width="3"/><circle cx="32" cy="35" r="8" stroke="currentColor" stroke-width="3"/></svg>
          <strong>Tengo foto</strong><span>del menú físico</span>
        </button>
      </div>

      <div class="input-panel hidden" id="pdfPanel">
        <div class="upload-card compact-upload" role="button" tabindex="0">
          <div>
            <div class="upload-icon">
              <svg viewBox="0 0 64 64" fill="none"><path d="M22 46H18a12 12 0 0 1-1.2-23.9A16 16 0 0 1 48 26a10 10 0 0 1-2 20h-4" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 46V26M24 34l8-8 8 8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="upload-title">Sube tu carta en PDF</div>
            <div class="upload-link">Haz clic para seleccionar archivo</div>
            <div class="formats">PDF · Máx. 10MB</div>
          </div>
        </div>
      </div>

      <div class="input-panel hidden" id="linkPanel">
        <div class="upload-card compact-upload" style="min-height:160px">
          <div style="width:100%">
            <div class="upload-icon">
              <svg viewBox="0 0 64 64" fill="none"><path d="M26 38l12-12M28 18l3-3a11 11 0 0 1 16 16l-4 4M36 46l-3 3a11 11 0 0 1-16-16l4-4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
            </div>
            <div class="upload-title">Pega el link de tu carta actual</div>
            <div class="upload-link" style="margin-bottom:12px">Ya sea tu web o link de tu QR</div>
            <input type="url" placeholder="https://turestaurante.cl/carta" style="max-width:420px;margin:0 auto" />
          </div>
        </div>
      </div>

      <div class="input-panel hidden" id="photoPanel">
        <div class="upload-card compact-upload" role="button" tabindex="0">
          <div>
            <div class="upload-icon">
              <svg viewBox="0 0 64 64" fill="none"><path d="M16 22h8l4-6h8l4 6h8v26H16V22z" stroke="currentColor" stroke-width="3"/><circle cx="32" cy="35" r="8" stroke="currentColor" stroke-width="3"/></svg>
            </div>
            <div class="upload-title">Sube una foto de tu menú</div>
            <div class="upload-link">Puede ser una o varias fotos de tu carta tomada con tu celular</div>
            <div class="formats">JPG o PNG · Máx. 10MB</div>
          </div>
        </div>
      </div>

      <button class="cta" type="button">Continuar paso 2 <span>→</span></button>
      <div class="trust below-cta">
        <svg viewBox="0 0 24 24" fill="none" style="width:16px;height:16px;flex-shrink:0;color:var(--amber-2)"><path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6V11z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        Tu información está protegida
      </div>
    </div>
  </section>
</main>

<footer class="sc-footer">
  <div style="max-width:1220px;margin:0 auto;padding:0 clamp(22px,4vw,64px);text-align:center">
    <div style="font-size:12px;color:var(--muted);margin-top:6px">© 2026 QuieroComer® · Santiago, Chile</div>
    <div style="display:flex;gap:24px;justify-content:center;margin-top:12px">
      <a href="/landing" style="color:var(--muted);text-decoration:none;font-size:13px">Inicio</a>
      <a href="#" style="color:var(--muted);text-decoration:none;font-size:13px">Términos</a>
      <a href="#" style="color:var(--muted);text-decoration:none;font-size:13px">Privacidad</a>
      <a href="mailto:hola@quierocomer.cl" style="color:var(--muted);text-decoration:none;font-size:13px">hola@quierocomer.cl</a>
    </div>
  </div>
</footer>
`;

const SCRIPT = `
document.querySelector('.cta').addEventListener('click', function() { alert('Estamos creando el paso 2. Pronto estará disponible.'); });
document.querySelectorAll('.method').forEach(function(button) {
  button.addEventListener('click', function() {
    document.querySelectorAll('.method').forEach(function(b) { b.classList.remove('active'); });
    button.classList.add('active');
    var panels = { pdf: document.getElementById('pdfPanel'), link: document.getElementById('linkPanel'), photo: document.getElementById('photoPanel') };
    Object.values(panels).forEach(function(p) { if (p) p.classList.add('hidden'); });
    var target = panels[button.dataset.mode];
    if (target) target.classList.remove('hidden');
  });
});
`;
