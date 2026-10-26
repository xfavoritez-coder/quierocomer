import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadEcommerceTenant } from "@/lib/ecommerce/storefront-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = await loadEcommerceTenant(slug);
  const name = t?.name || "la tienda";
  return {
    title: `Política de Privacidad · ${name}`,
    description: `Política de privacidad de la tienda online de ${name}.`,
    robots: { index: true, follow: true },
  };
}

const UPDATED = "octubre de 2026";

export default async function PrivacidadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await loadEcommerceTenant(slug);
  if (!t) notFound();

  const name = t.name;
  // Prioriza los datos configurados para la privacidad; si no hay, usa los del local.
  const contactEmail = t.privacyEmail || t.contactEmail || null;
  const contactPhone = t.privacyPhone || t.whatsapp || t.phone || null;
  const contactAddress = t.privacyAddress || t.address || null;
  const contactParts: string[] = [];
  if (contactEmail) contactParts.push(`correo ${contactEmail}`);
  if (contactPhone) contactParts.push(`WhatsApp/teléfono ${contactPhone}`);
  const contactLine = contactParts.length ? contactParts.join(" o ") : "los canales de contacto publicados en la tienda";

  const C: React.CSSProperties = { color: "#1b2030" };
  const H2: React.CSSProperties = { fontSize: "1.15rem", fontWeight: 800, margin: "30px 0 10px", color: "#111" };
  const P: React.CSSProperties = { fontSize: "0.98rem", lineHeight: 1.65, margin: "0 0 12px", color: "#333" };
  const LI: React.CSSProperties = { fontSize: "0.98rem", lineHeight: 1.6, margin: "0 0 7px", color: "#333" };

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 22px 80px", fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", background: "#fff", ...C }}>
      <p style={{ fontSize: "0.78rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#9a7b2e", fontWeight: 800, margin: 0 }}>{name}</p>
      <h1 style={{ fontSize: "1.9rem", fontWeight: 900, margin: "6px 0 4px", color: "#111", letterSpacing: "-0.02em" }}>Política de Privacidad</h1>
      <p style={{ fontSize: "0.85rem", color: "#888", margin: "0 0 8px" }}>Última actualización: {UPDATED}</p>

      <p style={P}>
        Esta Política de Privacidad describe cómo <strong>{name}</strong> (“nosotros”) trata la información de las personas que usan su
        tienda online y su aplicación para realizar pedidos. La plataforma que da soporte a esta tienda es <strong>QuieroComer</strong>,
        que actúa como proveedor tecnológico. Al usar la tienda o la app aceptas esta política.
      </p>

      <h2 style={H2}>1. Qué información recopilamos</h2>
      <ul style={{ paddingLeft: 20, margin: 0 }}>
        <li style={LI}><strong>Datos de contacto y entrega:</strong> nombre, teléfono y dirección de entrega que ingresas al hacer un pedido.</li>
        <li style={LI}><strong>Datos del pedido:</strong> los productos que pides, notas, totales e historial de compras en la tienda.</li>
        <li style={LI}><strong>Notificaciones:</strong> un identificador del dispositivo (token de notificaciones push) para avisarte del estado de tu pedido.</li>
        <li style={LI}><strong>Datos técnicos:</strong> información básica del dispositivo y de uso necesaria para que la tienda funcione.</li>
      </ul>
      <p style={{ ...P, marginTop: 12 }}>
        <strong>Pagos:</strong> los pagos con tarjeta se procesan a través de pasarelas externas (Webpay/Transbank, MercadoPago o Flow).
        <strong> No almacenamos los números de tu tarjeta</strong>; esos datos los maneja directamente la pasarela de pago.
      </p>

      <h2 style={H2}>2. Para qué usamos tu información</h2>
      <ul style={{ paddingLeft: 20, margin: 0 }}>
        <li style={LI}>Procesar, preparar y despachar tus pedidos.</li>
        <li style={LI}>Enviarte notificaciones sobre el estado de tu pedido (confirmado, en preparación, en camino, entregado).</li>
        <li style={LI}>Permitir el seguimiento del repartidor y la comunicación contigo cuando es necesario.</li>
        <li style={LI}>Operar, mantener y mejorar la tienda y la app.</li>
      </ul>

      <h2 style={H2}>3. Con quién compartimos tu información</h2>
      <p style={P}>Compartimos datos solo con quienes son necesarios para completar tu pedido:</p>
      <ul style={{ paddingLeft: 20, margin: 0 }}>
        <li style={LI}><strong>Repartidores</strong> propios o externos (p. ej. QuieroComer Delivery): nombre, teléfono y dirección para la entrega.</li>
        <li style={LI}><strong>Pasarelas de pago</strong> (Webpay, MercadoPago, Flow): para procesar el cobro de forma segura.</li>
        <li style={LI}><strong>QuieroComer</strong>, como proveedor de la plataforma, para alojar y operar la tienda.</li>
      </ul>
      <p style={{ ...P, marginTop: 12 }}>No vendemos tu información personal a terceros.</p>

      <h2 style={H2}>4. Seguridad y conservación</h2>
      <p style={P}>
        La información viaja <strong>cifrada</strong> (HTTPS). Conservamos tus datos el tiempo necesario para operar los pedidos y cumplir
        obligaciones legales y contables, y luego los eliminamos o anonimizamos.
      </p>

      <h2 style={H2}>5. Tus derechos y eliminación de datos</h2>
      <p style={P}>
        Puedes solicitar acceder, corregir o <strong>eliminar</strong> tus datos personales escribiéndonos a {contactLine}. Atenderemos tu
        solicitud en un plazo razonable, salvo que la ley exija conservar cierta información.
      </p>

      <h2 style={H2}>6. Menores de edad</h2>
      <p style={P}>La tienda y la app están dirigidas a mayores de 18 años. No recopilamos de forma intencional datos de menores de edad.</p>

      <h2 style={H2}>7. Cambios a esta política</h2>
      <p style={P}>Podemos actualizar esta política. Publicaremos la versión vigente en esta misma página con su fecha de actualización.</p>

      <h2 style={H2}>8. Contacto</h2>
      <p style={P}>
        Ante cualquier duda sobre tu privacidad, contáctanos a {contactLine}
        {contactAddress ? ` · ${contactAddress}` : ""}.
      </p>

      <p style={{ fontSize: "0.78rem", color: "#aaa", marginTop: 40, borderTop: "1px solid #eee", paddingTop: 16 }}>
        {name} · Tienda operada con QuieroComer.
      </p>
    </main>
  );
}
