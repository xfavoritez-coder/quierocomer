export interface EmailTemplate {
  id: string;
  icon: string;
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "noticias",
    icon: "utensils",
    name: "Noticias",
    description: "Comparte novedades de tu local con tus clientes",
    subject: "{{name}}, {{restaurant}} ya tiene carta digital",
    bodyHtml: `<div style="font-family:'DM Sans',system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;background:#ffffff">
  <div style="text-align:center;margin-bottom:24px">
    <p style="font-size:2.5rem;margin:0">🧞</p>
    <h1 style="font-size:1.5rem;font-weight:600;color:#0e0e0e;margin:12px 0 4px">¡Tenemos carta digital!</h1>
    <p style="font-size:1rem;color:#888;margin:0">{{restaurant}}</p>
  </div>
  <div style="background:#faf8f5;border-radius:16px;padding:24px;margin-bottom:24px;text-align:center">
    <p style="font-size:1.1rem;color:#333;line-height:1.6;margin:0">Hola {{name}}, ahora puedes ver nuestra carta completa desde tu celular. Fotos, descripciones y más. Te esperamos.</p>
  </div>
  <div style="text-align:center">
    <a href="https://quierocomer.cl/qr/{{slug}}" style="display:inline-block;background:#F4A623;color:#0a0a0a;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:1rem">Ver la carta</a>
  </div>
</div>`,
  },
  {
    id: "nueva-oferta",
    icon: "tag",
    name: "Nueva oferta",
    description: "Avisa a tus clientes que tienes una oferta nueva",
    subject: "{{name}}, tenemos una oferta nueva en {{restaurant}}",
    bodyHtml: `<div style="font-family:'DM Sans',system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;background:#ffffff">
  <div style="text-align:center;margin-bottom:24px">
    <p style="font-size:2.5rem;margin:0">🏷️</p>
    <h1 style="font-size:1.5rem;font-weight:600;color:#0e0e0e;margin:12px 0 4px">¡Nueva oferta!</h1>
    <p style="font-size:1rem;color:#888;margin:0">En {{restaurant}}</p>
  </div>
  <div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid rgba(244,166,35,0.2);border-radius:16px;padding:24px;margin-bottom:24px;text-align:center">
    <p style="font-size:1.1rem;color:#92400e;line-height:1.6;margin:0">{{name}}, tenemos una oferta especial que no te puedes perder. Pasa por nuestro local y aprovecha.</p>
  </div>
  <div style="text-align:center">
    <a href="https://quierocomer.cl/qr/{{slug}}" style="display:inline-block;background:#F4A623;color:#0a0a0a;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:1rem">Ver oferta</a>
  </div>
</div>`,
  },
  {
    id: "evento-anuncio",
    icon: "megaphone",
    name: "Evento o anuncio",
    description: "Comunica un evento, horario especial o anuncio general",
    subject: "{{name}}, novedades en {{restaurant}}",
    bodyHtml: `<div style="font-family:'DM Sans',system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;background:#ffffff">
  <div style="text-align:center;margin-bottom:24px">
    <p style="font-size:2.5rem;margin:0">📢</p>
    <h1 style="font-size:1.5rem;font-weight:600;color:#0e0e0e;margin:12px 0 4px">Te contamos algo</h1>
    <p style="font-size:1rem;color:#888;margin:0">De {{restaurant}}</p>
  </div>
  <div style="background:#faf8f5;border-radius:16px;padding:24px;margin-bottom:24px;text-align:center">
    <p style="font-size:1.1rem;color:#333;line-height:1.6;margin:0">Hola {{name}}, queremos contarte una novedad importante. Te esperamos pronto.</p>
  </div>
  <div style="text-align:center">
    <a href="https://quierocomer.cl/qr/{{slug}}" style="display:inline-block;background:#F4A623;color:#0a0a0a;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:1rem">Ver más</a>
  </div>
</div>`,
  },
  {
    id: "nuevo-producto",
    icon: "sparkles",
    name: "Nuevo producto",
    description: "Avisa que agregaste un producto nuevo a la carta",
    subject: "{{name}}, nuevo plato en {{restaurant}} que debes probar",
    bodyHtml: `<div style="font-family:'DM Sans',system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;background:#ffffff">
  <div style="text-align:center;margin-bottom:24px">
    <p style="font-size:2.5rem;margin:0">✨</p>
    <h1 style="font-size:1.5rem;font-weight:600;color:#0e0e0e;margin:12px 0 4px">Nuevo en la carta</h1>
    <p style="font-size:1rem;color:#888;margin:0">{{restaurant}}</p>
  </div>
  <div style="background:#faf8f5;border-radius:16px;padding:24px;margin-bottom:24px;text-align:center">
    <p style="font-size:1.1rem;color:#333;line-height:1.6;margin:0">Hola {{name}}, agregamos algo nuevo a nuestra carta que creemos te va a encantar. ¿Vienes a probarlo?</p>
  </div>
  <div style="text-align:center">
    <a href="https://quierocomer.cl/qr/{{slug}}" style="display:inline-block;background:#F4A623;color:#0a0a0a;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:1rem">Descubrir</a>
  </div>
</div>`,
  },
];
