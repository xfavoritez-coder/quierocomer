import { reactivationEmailHtml } from "@/lib/email/reactivationEmailHtml";

export default function PreviewReactivacion() {
  // Con fotos reales de platos
  const html1 = reactivationEmailHtml({
    ownerName: "Claudio",
    restaurantName: "Ceviche a lo Tigre",
    slug: "ceviche-a-lo-tigre",
    dishCount: 9,
    categories: [
      { name: "Ceviches", dishCount: 4, topDish: "Ceviche Clásico", topDishPhoto: "https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?w=120&h=120&fit=crop", topDishPrice: 8990 },
      { name: "Tiraditos", dishCount: 3, topDish: "Tiradito Nikkei", topDishPhoto: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=120&h=120&fit=crop", topDishPrice: 9990 },
      { name: "Bebidas", dishCount: 2, topDish: "Pisco Sour", topDishPhoto: null, topDishPrice: 4500 },
    ],
    cartaUrl: "https://quierocomer.cl/ceviche-a-lo-tigre",
    panelUrl: "https://quierocomer.cl/panel",
    activarUrl: "https://quierocomer.cl/activar/example",
    openPixel: "#",
  });

  // Carta grande, sin fotos (fallback emojis)
  const html2 = reactivationEmailHtml({
    ownerName: "Juan Carlos",
    restaurantName: "El Tumbaito",
    slug: "el-tumbaito",
    dishCount: 318,
    categories: [
      { name: "Entradas peruanas", dishCount: 28, topDish: "Causa Limeña", topDishPhoto: null, topDishPrice: 6900 },
      { name: "Ceviches y tiraditos", dishCount: 22, topDish: "Ceviche Mixto", topDishPhoto: "https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?w=120&h=120&fit=crop", topDishPrice: 9990 },
      { name: "Carnes a la parrilla", dishCount: 18, topDish: "Lomo Saltado", topDishPhoto: "https://images.unsplash.com/photo-1544025162-d76694265947?w=120&h=120&fit=crop", topDishPrice: 12990 },
      { name: "Postres", dishCount: 8 },
      { name: "Bebidas", dishCount: 15 },
      { name: "Almuerzos", dishCount: 12 },
      { name: "Sopas", dishCount: 6 },
    ],
    cartaUrl: "https://quierocomer.cl/el-tumbaito",
    panelUrl: "https://quierocomer.cl/panel",
    activarUrl: "https://quierocomer.cl/activar/example",
    openPixel: "#",
  });

  // Cervecería con fotos
  const html3 = reactivationEmailHtml({
    ownerName: "Lissette",
    restaurantName: "Beer House Atacama",
    slug: "beer-house-atacama",
    dishCount: 263,
    categories: [
      { name: "Cervezas artesanales", dishCount: 42, topDish: "IPA del Desierto", topDishPhoto: null, topDishPrice: 4500 },
      { name: "Hamburguesas", dishCount: 18, topDish: "Burger Atacameña", topDishPhoto: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=120&h=120&fit=crop", topDishPrice: 8990 },
      { name: "Picoteos", dishCount: 24, topDish: "Nachos Cargados", topDishPhoto: null, topDishPrice: 6500 },
      { name: "Pizzas", dishCount: 10 },
      { name: "Postres", dishCount: 8 },
    ],
    cartaUrl: "https://quierocomer.cl/beer-house-atacama",
    panelUrl: "https://quierocomer.cl/panel",
    activarUrl: "https://quierocomer.cl/activar/example",
    openPixel: "#",
  });

  return (
    <div style={{ background: "#e5e5e5", minHeight: "100vh", padding: "20px 0" }}>
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 16px" }}>
        <h1 style={{ fontFamily: "system-ui", fontSize: 18, color: "#333", marginBottom: 6 }}>
          Preview: Email de reactivación
        </h1>
        <p style={{ fontFamily: "system-ui", fontSize: 13, color: "#666", marginBottom: 24 }}>
          Asunto: <strong>&quot;[Nombre], tu carta QR es gratis&quot;</strong>
        </p>

        <div style={{ marginBottom: 32 }}>
          <p style={{ fontFamily: "system-ui", fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1 }}>
            Con fotos reales + emoji fallback — 3 categorías
          </p>
          <div style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.1)" }}>
            <iframe srcDoc={html1} style={{ width: "100%", height: 1000, border: "none", background: "white" }} />
          </div>
        </div>

        <div style={{ marginBottom: 32 }}>
          <p style={{ fontFamily: "system-ui", fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1 }}>
            318 platos, 7 categorías (muestra 3 + &quot;4 más&quot;)
          </p>
          <div style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.1)" }}>
            <iframe srcDoc={html2} style={{ width: "100%", height: 1000, border: "none", background: "white" }} />
          </div>
        </div>

        <div style={{ marginBottom: 32 }}>
          <p style={{ fontFamily: "system-ui", fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1 }}>
            Cervecería — mix fotos y emojis, 5 categorías
          </p>
          <div style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.1)" }}>
            <iframe srcDoc={html3} style={{ width: "100%", height: 1000, border: "none", background: "white" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
