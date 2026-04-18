export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "te-extranamos",
    name: "Te extrañamos",
    description: "Para clientes que no han vuelto en un tiempo",
    subject: "{{name}}, te extrañamos en {{restaurant}}",
    bodyHtml: `<div style="font-family:'DM Sans',system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;background:#ffffff">
  <div style="text-align:center;margin-bottom:24px">
    <p style="font-size:2.5rem;margin:0">🧞</p>
    <h1 style="font-size:1.5rem;font-weight:600;color:#0e0e0e;margin:12px 0 4px">¡Hola {{name}}!</h1>
    <p style="font-size:1rem;color:#888;margin:0">Hace tiempo que no nos visitas</p>
  </div>
  <div style="background:#faf8f5;border-radius:16px;padding:24px;margin-bottom:24px;text-align:center">
    <p style="font-size:1.1rem;color:#333;line-height:1.6;margin:0">En <strong>{{restaurant}}</strong> hemos preparado cosas nuevas que creemos te van a encantar. ¿Nos das otra oportunidad?</p>
  </div>
  <div style="text-align:center">
    <a href="https://quierocomer.cl/qr/{{slug}}" style="display:inline-block;background:#F4A623;color:#0a0a0a;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:1rem">Ver la carta</a>
  </div>
</div>`,
  },
  {
    id: "plato-favorito-promo",
    name: "Tu plato favorito en promo",
    description: "Avisa cuando un plato que les gusta está en promoción",
    subject: "{{name}}, tu plato favorito tiene descuento en {{restaurant}}",
    bodyHtml: `<div style="font-family:'DM Sans',system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;background:#ffffff">
  <div style="text-align:center;margin-bottom:24px">
    <p style="font-size:2.5rem;margin:0">🎉</p>
    <h1 style="font-size:1.5rem;font-weight:600;color:#0e0e0e;margin:12px 0 4px">¡Oferta especial!</h1>
    <p style="font-size:1rem;color:#888;margin:0">Solo para ti, {{name}}</p>
  </div>
  <div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid rgba(244,166,35,0.2);border-radius:16px;padding:24px;margin-bottom:24px;text-align:center">
    <p style="font-size:1.1rem;color:#92400e;line-height:1.6;margin:0">Sabemos que te encanta visitar <strong>{{restaurant}}</strong>. Esta semana tenemos una sorpresa esperándote.</p>
  </div>
  <div style="text-align:center">
    <a href="https://quierocomer.cl/qr/{{slug}}" style="display:inline-block;background:#F4A623;color:#0a0a0a;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:1rem">Ver ofertas</a>
  </div>
</div>`,
  },
  {
    id: "nuevo-plato",
    name: "Nuevo plato para ti",
    description: "Recomienda un plato nuevo basado en gustos",
    subject: "{{name}}, hay algo nuevo en {{restaurant}} que te va a gustar",
    bodyHtml: `<div style="font-family:'DM Sans',system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;background:#ffffff">
  <div style="text-align:center;margin-bottom:24px">
    <p style="font-size:2.5rem;margin:0">✨</p>
    <h1 style="font-size:1.5rem;font-weight:600;color:#0e0e0e;margin:12px 0 4px">Novedad en {{restaurant}}</h1>
    <p style="font-size:1rem;color:#888;margin:0">El Genio cree que te gustará</p>
  </div>
  <div style="background:#faf8f5;border-radius:16px;padding:24px;margin-bottom:24px;text-align:center">
    <p style="font-size:1.1rem;color:#333;line-height:1.6;margin:0">Agregamos platos nuevos a la carta y basándonos en tus gustos, creemos que uno en particular te va a encantar. ¿Vienes a probarlo?</p>
  </div>
  <div style="text-align:center">
    <a href="https://quierocomer.cl/qr/{{slug}}" style="display:inline-block;background:#F4A623;color:#0a0a0a;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:1rem">Descubrir</a>
  </div>
</div>`,
  },
  {
    id: "cumpleanos",
    name: "Feliz cumpleaños",
    description: "Email automático de cumpleaños con regalo",
    subject: "🎂 ¡Feliz cumpleaños, {{name}}! Un regalo de {{restaurant}}",
    bodyHtml: `<div style="font-family:'DM Sans',system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;background:#ffffff">
  <div style="text-align:center;margin-bottom:24px">
    <p style="font-size:3rem;margin:0">🎂</p>
    <h1 style="font-size:1.6rem;font-weight:600;color:#0e0e0e;margin:12px 0 4px">¡Feliz cumpleaños, {{name}}!</h1>
    <p style="font-size:1rem;color:#888;margin:0">De parte de todo el equipo de {{restaurant}}</p>
  </div>
  <div style="background:linear-gradient(135deg,#fdf2f8,#fce7f3);border:1px solid rgba(236,72,153,0.15);border-radius:16px;padding:24px;margin-bottom:24px;text-align:center">
    <p style="font-size:1.1rem;color:#831843;line-height:1.6;margin:0">Queremos celebrar contigo. Te tenemos un regalo especial esperándote en tu próxima visita.</p>
  </div>
  <div style="text-align:center">
    <a href="https://quierocomer.cl/qr/{{slug}}" style="display:inline-block;background:#F4A623;color:#0a0a0a;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:1rem">Ver mi regalo</a>
  </div>
</div>`,
  },
];
