// Notas del vendedor por capítulo (tecla N). Solo las ve el vendedor. Editar libremente.
import type { ChapterId } from "./types";

export const SELLER_NOTES: Record<ChapterId, { frases: string[]; preguntas: string[]; objeciones: { o: string; r: string }[] }> = {
  inicio: {
    frases: ["Esto no es un ejemplo: es TU local, con tus platos y tus precios.", "Te voy a mostrar 4 cosas en pocos minutos."],
    preguntas: ["¿Hoy cómo reciben los pedidos?", "¿Qué es lo que más te quita tiempo en el día?"],
    objeciones: [],
  },
  carta: {
    frases: ["No reemplazamos tu carta de papel: la complementamos.", "Se traduce sola, recomienda platos y llama al garzón.", "Y si quieres papel, la exportas en PDF con diseño."],
    preguntas: ["¿Cada cuánto reimprimen la carta?", "¿Los garzones alcanzan a atender todas las mesas en hora punta?"],
    objeciones: [{ o: "Mis clientes prefieren la carta física", r: "Perfecto, son complementarias: exportas tu carta en PDF con diseño, con los mismos precios que el QR." }],
  },
  loyalty: {
    frases: ["Cada visita suma un sello, en su celular y sin app.", "Le avisamos cuando pasa cerca y en su cumpleaños."],
    preguntas: ["¿Sabes quiénes son tus clientes frecuentes?", "¿Tienes alguna forma de avisarles de una promo?"],
    objeciones: [{ o: "Mis clientes no se descargan apps", r: "No necesitan app: la tarjeta queda en su celular con un QR." }],
  },
  ecommerce: {
    frases: ["Tu propia tienda: 0% de comisión.", "Con nuestra alianza, un motorista retira y entrega el pedido.", "Haz un pedido de prueba y mira cómo llega al POS."],
    preguntas: ["¿Cuánto venden al mes por apps de delivery?", "¿Qué porcentaje les cobran?"],
    objeciones: [{ o: "La gente igual pide por las apps", r: "Las apps te traen clientes nuevos; tu tienda hace que los que ya te conocen te pidan sin comisión." }],
  },
  pos: {
    frases: ["Toda tu operación en una pantalla, incluso sin internet.", "Reportes de clientes: nuevos, recurrentes y perdidos.", "Recuperación de clientes: les llega un cupón y vuelven."],
    preguntas: ["¿Qué sistema usan hoy para cobrar?", "¿Cuánto se demoran en cuadrar la caja?"],
    objeciones: [{ o: "Ya tengo un POS", r: "Importamos tus datos y lo dejamos funcionando; además se conecta solo con tu tienda y tu carta." }],
  },
  planes: {
    frases: ["Partimos por lo que más te sirve hoy.", "Lo dejamos funcionando nosotros."],
    preguntas: ["¿Con cuál te gustaría partir?"],
    objeciones: [{ o: "Está caro", r: "Compáralo con lo que pagas hoy en comisiones: la tienda se paga sola con pocos pedidos." }],
  },
};
