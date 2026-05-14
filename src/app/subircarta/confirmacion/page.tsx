import { Metadata } from "next";

export const metadata: Metadata = {
  title: "¡Listo! · QuieroComer",
  description: "Tu carta está en camino.",
};

export default function ConfirmacionPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        body { min-height: 100vh!important; background: #090704!important; color: #f8eedf!important; font-family: Georgia, 'Times New Roman', serif!important; }
        .wrap { max-width: 562px; margin: 0 auto; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px; text-align: center; }
        .icon { font-size: 64px; margin-bottom: 24px; }
        h1 { font-size: 42px; line-height: 1; letter-spacing: -.04em; margin-bottom: 16px; font-weight: 500; }
        h1 em { color: #f0a71f; font-style: italic; }
        p { color: #b8a58d; font-size: 16px; line-height: 1.5; max-width: 380px; font-family: system-ui, -apple-system, sans-serif; margin-bottom: 32px; }
        a { display: inline-block; color: #f0a71f; font-size: 15px; font-weight: 600; text-decoration: none; font-family: system-ui, -apple-system, sans-serif; }
      `}} />
      <div className="wrap">
        <div className="icon">&#10003;</div>
        <h1>Tu carta está <em>en camino.</em></h1>
        <p>Recibirás una propuesta en tu correo en los próximos minutos. Si tienes preguntas, escríbenos a hola@quierocomer.cl</p>
        <a href="/landing">← Volver al inicio</a>
      </div>
    </>
  );
}
