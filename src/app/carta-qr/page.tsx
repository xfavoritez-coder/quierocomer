import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Carta QR para restaurantes gratis · Chile | QuieroComer",
  description: "Crea tu carta QR digital gratis en minutos. Nuestra IA digitaliza tu carta física y la transforma en un menú online con fotos, filtros y recomendaciones. Sin comisiones.",
  openGraph: {
    title: "Carta QR para restaurantes gratis · Chile | QuieroComer",
    description: "Crea tu carta QR digital gratis en minutos. Nuestra IA digitaliza tu carta física y la transforma en un menú online con fotos, filtros y recomendaciones. Sin comisiones.",
    url: "https://quierocomer.com/carta-qr",
    siteName: "QuieroComer",
    type: "website",
    locale: "es_CL",
    images: [{ url: "https://quierocomer.com/og.png", width: 1200, height: 630 }],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Carta QR para restaurantes gratis · Chile | QuieroComer",
  description: "Crea tu carta QR digital gratis en minutos.",
  url: "https://quierocomer.com/carta-qr",
  mainEntity: {
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "¿Qué es una carta QR?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Una carta QR es un menú digital que tus clientes pueden ver escaneando un código QR con su celular. No necesitan descargar ninguna app: se abre directo en el navegador con fotos, precios y descripciones de tus platos.",
        },
      },
      {
        "@type": "Question",
        name: "¿Cuánto cuesta crear una carta QR?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Con QuieroComer puedes crear tu carta QR completamente gratis. El plan gratuito incluye carta digital, código QR descargable y actualización ilimitada de platos.",
        },
      },
      {
        "@type": "Question",
        name: "¿Cómo creo mi carta QR?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sube tu carta actual (foto, PDF o link) en quierocomer.com/subircarta. Nuestra IA la digitaliza en minutos, y recibes tu carta QR lista para imprimir y poner en las mesas.",
        },
      },
      {
        "@type": "Question",
        name: "¿Puedo actualizar los precios después?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sí, desde tu panel puedes modificar precios, agregar platos, cambiar fotos o crear promociones en cualquier momento. El código QR no cambia, solo se actualiza el contenido.",
        },
      },
      {
        "@type": "Question",
        name: "¿Funciona en Chile?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "QuieroComer está diseñado especialmente para restaurantes en Chile. Precios en pesos chilenos, soporte en horario local y miles de restaurantes ya usando la plataforma.",
        },
      },
    ],
  },
};

const FEATURES = [
  {
    icon: "📷",
    title: "Fotos automáticas con IA",
    desc: "Nuestra IA busca y asigna fotos a tus platos para que tu carta se vea profesional desde el primer día.",
  },
  {
    icon: "✏️",
    title: "Edición en tiempo real",
    desc: "Cambia precios, agrega platos o activa promociones desde el celular. El QR siempre muestra la versión actualizada.",
  },
  {
    icon: "🌟",
    title: "Platos populares primero",
    desc: "El sistema aprende qué platos prefieren tus clientes y los muestra primero para que vendan más.",
  },
  {
    icon: "🌿",
    title: "Filtros por categoría",
    desc: "Tus clientes pueden filtrar por vegano, vegetariano, sin gluten o los más pedidos con un solo toque.",
  },
  {
    icon: "📊",
    title: "Estadísticas de vistas",
    desc: "Ve cuántas personas escanearon tu QR, qué platos miraron más y en qué horarios tienes más tráfico.",
  },
  {
    icon: "🖨️",
    title: "QR listo para imprimir",
    desc: "Descarga tu código QR en alta resolución para imprimirlo en stickers, porta-menús o la puerta del local.",
  },
];

const FAQS = [
  {
    q: "¿Qué es una carta QR?",
    a: "Una carta QR es un menú digital que tus clientes ven escaneando un código QR con el celular. Se abre directo en el navegador — sin apps — con fotos, precios y descripciones actualizados.",
  },
  {
    q: "¿Cuánto cuesta crear una carta QR?",
    a: "Puedes crear tu carta QR completamente gratis. El plan gratuito incluye carta digital, código QR descargable y actualización ilimitada de platos, sin vencimiento.",
  },
  {
    q: "¿Cómo creo mi carta QR?",
    a: "Sube tu carta actual (foto, PDF o link de tu menú) en nuestra plataforma. Nuestra IA la digitaliza en minutos y recibes tu carta QR lista para poner en las mesas.",
  },
  {
    q: "¿Necesito saber de tecnología?",
    a: "No. Subes tu carta como si mandaras una foto por WhatsApp y nosotros hacemos el resto. El panel para editar es tan simple como cualquier red social.",
  },
  {
    q: "¿Puedo actualizar los precios después?",
    a: "Sí, en cualquier momento y desde el celular. El código QR no cambia — solo se actualiza el contenido, así que no tienes que reimprimir nada.",
  },
  {
    q: "¿Funciona en todo Chile?",
    a: "Sí. Tenemos restaurantes en Santiago, Valparaíso, Concepción, Temuco, Valdivia y más. La plataforma está pensada para el mercado chileno con precios en pesos.",
  },
];

export default function CartaQrPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main style={{ fontFamily: "var(--font-display, system-ui, sans-serif)", color: "#111", background: "#fff" }}>

        {/* Hero */}
        <section style={{ textAlign: "center", padding: "72px 24px 56px", background: "linear-gradient(180deg,#fafafa 0%,#fff 100%)" }}>
          <p style={{ fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.1em", color: "#f97316", textTransform: "uppercase", marginBottom: 12 }}>
            GRATIS · SIN COMISIONES · CHILE
          </p>
          <h1 style={{ fontSize: "clamp(2rem,5vw,3.2rem)", fontWeight: 800, lineHeight: 1.1, marginBottom: 20, maxWidth: 700, margin: "0 auto 20px" }}>
            La carta QR más inteligente para tu restaurante
          </h1>
          <p style={{ fontSize: "1.1rem", color: "#555", maxWidth: 560, margin: "0 auto 36px", lineHeight: 1.6 }}>
            Sube tu carta actual y en minutos tendrás un menú QR digital con fotos, filtros y recomendaciones IA — gratis para siempre.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/subircarta"
              style={{
                display: "inline-block",
                background: "#111",
                color: "#fff",
                borderRadius: 12,
                padding: "14px 32px",
                fontWeight: 700,
                fontSize: "1rem",
                textDecoration: "none",
              }}
            >
              Crear mi carta QR gratis →
            </Link>
            <Link
              href="/descubrir"
              style={{
                display: "inline-block",
                background: "#f3f4f6",
                color: "#111",
                borderRadius: 12,
                padding: "14px 28px",
                fontWeight: 600,
                fontSize: "1rem",
                textDecoration: "none",
              }}
            >
              Ver ejemplos
            </Link>
          </div>
          <p style={{ marginTop: 18, fontSize: "0.82rem", color: "#999" }}>
            +200 restaurantes en Chile ya lo están usando
          </p>
        </section>

        {/* Features */}
        <section style={{ padding: "64px 24px", maxWidth: 960, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "clamp(1.4rem,3vw,2rem)", fontWeight: 700, marginBottom: 48 }}>
            Todo lo que incluye tu carta QR gratis
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 28 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{ background: "#fafafa", borderRadius: 16, padding: "28px 24px" }}>
                <div style={{ fontSize: "2rem", marginBottom: 12 }}>{f.icon}</div>
                <h3 style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: "0.88rem", color: "#555", lineHeight: 1.55, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section style={{ padding: "56px 24px", background: "#fafafa" }}>
          <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
            <h2 style={{ fontSize: "clamp(1.4rem,3vw,2rem)", fontWeight: 700, marginBottom: 40 }}>
              ¿Cómo funciona?
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 24, textAlign: "left" }}>
              {[
                { n: "1", title: "Sube tu carta", desc: "Foto, PDF, link de tu carta actual o créala desde cero. Cualquier formato funciona." },
                { n: "2", title: "La IA la digitaliza", desc: "En minutos extraemos platos, precios y categorías. Asignamos fotos automáticamente." },
                { n: "3", title: "Recibe tu código QR", desc: "Descarga el QR, imprímelo y ponlo en las mesas. Listo — tus clientes ya pueden escanear." },
                { n: "4", title: "Edita cuando quieras", desc: "Cambia precios, agrega platos o activa promos desde el celular en segundos." },
              ].map((step) => (
                <div key={step.n} style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                  <div style={{
                    minWidth: 40, height: 40, borderRadius: "50%",
                    background: "#111", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, fontSize: "1rem", flexShrink: 0,
                  }}>
                    {step.n}
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, margin: "0 0 4px" }}>{step.title}</p>
                    <p style={{ fontSize: "0.88rem", color: "#555", margin: 0, lineHeight: 1.5 }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 40 }}>
              <Link
                href="/subircarta"
                style={{
                  display: "inline-block",
                  background: "#111",
                  color: "#fff",
                  borderRadius: 12,
                  padding: "14px 32px",
                  fontWeight: 700,
                  fontSize: "1rem",
                  textDecoration: "none",
                }}
              >
                Empezar gratis →
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section style={{ padding: "64px 24px", maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(1.4rem,3vw,2rem)", fontWeight: 700, textAlign: "center", marginBottom: 40 }}>
            Preguntas frecuentes sobre carta QR
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {FAQS.map((faq, i) => (
              <div
                key={i}
                style={{
                  borderTop: "1px solid #e5e7eb",
                  padding: "24px 0",
                  ...(i === FAQS.length - 1 ? { borderBottom: "1px solid #e5e7eb" } : {}),
                }}
              >
                <h3 style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 10, margin: "0 0 10px" }}>{faq.q}</h3>
                <p style={{ fontSize: "0.9rem", color: "#555", lineHeight: 1.6, margin: 0 }}>{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section style={{ padding: "64px 24px 80px", textAlign: "center", background: "#111", color: "#fff" }}>
          <h2 style={{ fontSize: "clamp(1.6rem,4vw,2.4rem)", fontWeight: 800, marginBottom: 16, maxWidth: 580, margin: "0 auto 16px" }}>
            Tu carta QR lista en minutos
          </h2>
          <p style={{ fontSize: "1rem", color: "#ccc", marginBottom: 32 }}>
            Gratis para siempre. Sin comisiones. Sin tarjeta de crédito.
          </p>
          <Link
            href="/subircarta"
            style={{
              display: "inline-block",
              background: "#fff",
              color: "#111",
              borderRadius: 12,
              padding: "14px 36px",
              fontWeight: 700,
              fontSize: "1rem",
              textDecoration: "none",
            }}
          >
            Crear mi carta QR →
          </Link>
          <p style={{ marginTop: 20, fontSize: "0.82rem", color: "#666" }}>
            ¿Tienes dudas?{" "}
            <a href="https://wa.me/56999946208" style={{ color: "#ccc" }}>
              Escríbenos por WhatsApp
            </a>
          </p>
        </section>
      </main>
    </>
  );
}
