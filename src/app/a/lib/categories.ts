// ─── Normalización de categorías ───────────────────────────────────────
// Un solo archivo con todo lo relacionado a categorías del feed.
// Se usa para scoring, chips en Explorar, motivos de recomendación y gradientes.

/** Mapea nombres de categoría de la BD → categoría normalizada del feed */
export const CATEGORY_MAP: Record<string, string> = {
  // ─── Sushi & Rolls ──────────────────────────────────────────
  'Sushi': 'Sushi',
  'SUSHI': 'Sushi',
  'SUSHI DE LA CASA': 'Sushi',
  'Handrolls': 'Sushi',
  'Hand Rolls': 'Sushi',
  'HAND ROLL': 'Sushi',
  'California Rolls': 'Sushi',
  'Nikkei Rolls': 'Sushi',
  'Rolls': 'Sushi',
  'Temakis': 'Sushi',
  'Nigiri': 'Sushi',
  'Sashimi': 'Sushi',
  'SASHIMI': 'Sushi',
  'Futomaki': 'Sushi',
  'Hot Rolls': 'Sushi',
  'Especial Rolls': 'Sushi',
  'Special Rolls': 'Sushi',
  'Rolls Especiales': 'Sushi',
  'Rolls Acevichados': 'Sushi',
  'Rolls Tempura': 'Sushi',
  'Rolls Sin Arroz': 'Sushi',
  'Rolls sin Arroz': 'Sushi',
  'Makis Clásicos - California': 'Sushi',
  'Makis Clásicos - Envueltos en Palta': 'Sushi',
  'Makis Clásicos - Envueltos en Panko': 'Sushi',
  'Makis Clásicos - Envueltos en Queso': 'Sushi',
  'ROLL COBERTURA DE PALTA': 'Sushi',
  'ROLL COBERTURA DE PANKO': 'Sushi',
  'ROLL COBERTURA DE QUESO CREMA': 'Sushi',
  'ROLL COBERTURA DE SALMON': 'Sushi',
  'ROLL COBERTURA EN TEMPURA': 'Sushi',
  'Sushi de autor / Rolls Nikkei': 'Sushi',
  'Sushis de Autor': 'Sushi',
  'Sushi promos': 'Sushi',
  'PROMOCIONES DE SUSHI': 'Sushi',
  'PROMOS DE HANDROLL': 'Sushi',
  'Promociones y Sets de Piezas': 'Sushi',
  'Tablas de sushi': 'Sushi',
  'Tradicional Japones': 'Sushi',
  'Chirashis / Gohans': 'Sushi',
  'Gohan': 'Sushi',
  'Avocado / Sake': 'Sushi',

  // ─── Ceviches & Mariscos ────────────────────────────────────
  'Ceviches': 'Ceviches',
  'Ceviche': 'Ceviches',
  'CEVICHES': 'Ceviches',
  'Ceviches Y Tiraditos': 'Ceviches',
  'Pescados y Mariscos': 'Ceviches',
  'Pescados': 'Ceviches',
  'Mariscos': 'Ceviches',
  'Carpaccio': 'Ceviches',

  // ─── Pizzas ─────────────────────────────────────────────────
  'Pizzas': 'Pizzas',
  'Pizza': 'Pizzas',
  'PIZZAS': 'Pizzas',
  'Pizza a la piedra 40d.': 'Pizzas',
  'Pizza a la piedra INDIVIDUAL': 'Pizzas',
  'Pizzas Speciali': 'Pizzas',
  'Pizzas Tradizionali': 'Pizzas',
  'Arma Tu Pizza': 'Pizzas',
  'Calzone': 'Pizzas',
  'Fugazzas': 'Pizzas',

  // ─── Hamburguesas ───────────────────────────────────────────
  'Hamburguesas': 'Hamburguesas',
  'Hamburguesa': 'Hamburguesas',
  'Burgers': 'Hamburguesas',
  'Hamburguesas XL': 'Hamburguesas',
  'Hamburguesas c/ Papas': 'Hamburguesas',

  // ─── Completos & Hot Dogs ───────────────────────────────────
  'Completos': 'Completos',
  'Completos Especial': 'Completos',
  'Perros Calientes': 'Completos',

  // ─── Sándwiches ─────────────────────────────────────────────
  'Sandwiches': 'Sándwiches',
  'Sandwich': 'Sándwiches',
  'SANDWICH': 'Sándwiches',
  'SANDWICHES': 'Sándwiches',
  'Sándwiches': 'Sándwiches',
  'Sánguchez': 'Sándwiches',
  'Sandwichs': 'Sándwiches',
  'Sandwich y Hamburguesas': 'Sándwiches',
  'Antojos Salados - Sandwich': 'Sándwiches',
  'SANDWICHERIA "LOS CLASICOS DE SIEMPRE"': 'Sándwiches',
  'SANDWICHERIA "SELECCION OASIS"': 'Sándwiches',
  'PROMO SANDWICH': 'Sándwiches',
  'Panes Ciabatta': 'Sándwiches',
  'Churrascos': 'Sándwiches',
  'Churrasco Carne': 'Sándwiches',
  'Churrascos de Pollo': 'Sándwiches',
  'Lomo': 'Sándwiches',
  'Lomos c/ Papas': 'Sándwiches',
  'Pepitos': 'Venezolana',

  // ─── Saludable (ensaladas, vegano) ────────────────────────
  'Ensaladas': 'Saludable',
  'Ensalada': 'Saludable',
  'Cremas y Ensaladas': 'Saludable',
  'Antojos Salados - Ensaladas': 'Saludable',
  '100% Vegano': 'Saludable',
  'Aperitivos 100% Veganos': 'Saludable',

  // ─── Entradas (eliminado como leaf — heredan identidad del restaurante) ───
  'Gyosas y más': 'Asiática',

  // ─── Platos de fondo ───────────────────────────────────────
  'Platos Principales': 'Platos de fondo',
  'Platos principales': 'Platos de fondo',
  'Platos Calientes': 'Platos de fondo',
  'Platos De Fondo': 'Platos de fondo',
  'Platos de fondo': 'Platos de fondo',
  'Platos del Cheff': 'Platos de fondo',
  'Platos Preparados': 'Platos de fondo',
  'Platos,Tablas y Ensaladas': 'Platos de fondo',
  'Platos Niños': 'Platos de fondo',
  'Platos de Carne': 'Platos de fondo',
  'Platos con Pollo': 'Platos de fondo',
  'Platos con Vacuno': 'Platos de fondo',
  'Fondos': 'Platos de fondo',
  'Especialidad de la casa': 'Platos de fondo',
  'Especiales': 'Platos de fondo',
  'Recomendaciones': 'Platos de fondo',
  'Menú Clásico': 'Platos de fondo',
  'ALMUERZOS': 'Platos de fondo',
  'Guisos y Estofados': 'Platos de fondo',
  'Sopas': 'Platos de fondo',
  'Sopas y Caldos': 'Platos de fondo',
  'Carnes y Risottos': 'Platos de fondo',
  'Risottos': 'Platos de fondo',

  // ─── Peruana ──────────────────────────────────────────────
  'Tradiciones Peruanas': 'Peruana',
  'Comida Peruana': 'Peruana',
  'Peruana': 'Peruana',

  // ─── Parrilla ─────────────────────────────────────────────
  'Parrilladas': 'Parrilla',
  'Parrilla': 'Parrilla',
  'Carnes': 'Parrilla',
  'Chorrillanas': 'Parrilla',

  // ─── Pollo y alitas ──────────────────────────────────────
  'Pollo': 'Pollo y alitas',
  'Pollo Crispy': 'Pollo y alitas',
  'Buckets De Pollo Frito': 'Pollo y alitas',
  'Pollo Frito': 'Pollo y alitas',
  'Alitas': 'Pollo y alitas',
  'Wings': 'Pollo y alitas',

  // ─── Empanadas ──────────────────────────────────────────────
  'Empanadas': 'Empanadas',
  'Empanadas Fritas': 'Empanadas',

  // ─── Mexicana ───────────────────────────────────────────────
  'Fajitas': 'Mexicana',
  'Tacos': 'Mexicana',
  'Burritos': 'Mexicana',
  'Quesadillas': 'Mexicana',
  'QUESADILLAS': 'Mexicana',
  'Nachos': 'Mexicana',
  'Arepas': 'Venezolana',
  'Cachapas': 'Venezolana',
  'Tequeños': 'Venezolana',
  'Pabellón': 'Venezolana',

  // ─── Thai ─────────────────────────────────────────────────
  'Asian Street Food': 'Thai',
  'Fideos de Arroz': 'Thai',
  'Thai': 'Thai',
  'Comida Thai': 'Thai',

  // ─── China ────────────────────────────────────────────────
  'Arroz Chino': 'China',
  'Arroz': 'China',
  'China': 'China',
  'Comida China': 'China',

  // ─── India ────────────────────────────────────────────────
  'Currys': 'India',
  'India': 'India',
  'Comida India': 'India',

  // ─── Asiática (genérica) ──────────────────────────────────
  'Orientales': 'Asiática',

  // ─── Pastas ─────────────────────────────────────────────────
  'Pastas': 'Pastas',
  'Pasta': 'Pastas',
  'Espaguetti': 'Pastas',
  'Arma tu plato de pasta': 'Pastas',

  // ─── Postres ────────────────────────────────────────────────
  'Postres': 'Postres',
  'POSTRES': 'Postres',
  'Postres y Bebidas': 'Postres',
  'Toque Dulce': 'Postres',
  'Dulces Momentos': 'Postres',
  'CHEESECAKE': 'Postres',
  'TORTAS': 'Postres',
  'OTROS PASTELES': 'Postres',
  'DUBAI COLLECTION DESSERTS': 'Postres',
  'Ice Cream': 'Helados',
  'HELADOS ARTESANALES': 'Helados',
  'HELADOS SIN AZÚCAR': 'Helados',
  'CREPES DULCES': 'Postres',
  'WAFFLES DULCES': 'Postres',
  'PROMO PASTELES': 'Postres',

  // ─── Cafetería (bebidas calientes — se infieren como drink)
  'Cafetería': 'Cafetería',
  'CAFETERIA': 'Cafetería',
  'Cafeteria': 'Cafetería',
  'Café': 'Cafetería',
  'Cafe Frio': 'Cafetería',
  'CAFÉ GELATO': 'Cafetería',
  'CAFÉS - CHOCOLATES CALIENTES - INFUSIONES O TÉ': 'Cafetería',
  'Cafés Y Tés': 'Cafetería',
  'Café Arábica Especialidad - Con Leche': 'Cafetería',
  'Café Arábica Especialidad - Espresso Bar': 'Cafetería',
  'Café Arábica Frío': 'Cafetería',
  'Bebidas Calientes - Café': 'Cafetería',
  'Bebidas Calientes - Chocolate Caliente': 'Cafetería',
  'Bebidas Calientes - Té e Infusiones': 'Cafetería',
  'Bebidas Frías - Café y Té': 'Cafetería',
  'Para Llevar o Encargar - Café para disfrutar en casa': 'Cafetería',
  'Hot Drinks': 'Cafetería',

  // ─── Amasandería / Panadería ──────────────────────────────
  'Amasandería': 'Amasandería',
  'Panadería': 'Amasandería',
  'Panaderia': 'Amasandería',
  'PANADERIA': 'Amasandería',
  'Pan': 'Amasandería',
  'Panes': 'Amasandería',
  'PANES': 'Amasandería',
  'Pan artesanal': 'Amasandería',
  'Panes artesanales': 'Amasandería',
  'Bollería': 'Amasandería',
  'Bolleria': 'Amasandería',
  'Kuchen': 'Amasandería',
  'Kuchenes': 'Amasandería',
  'Strudel': 'Amasandería',
  'Croissant': 'Amasandería',
  'Croissants': 'Amasandería',
  'Medialunas': 'Amasandería',
  'Facturas': 'Amasandería',
  'Marraquetas': 'Amasandería',
  'Hallullas': 'Amasandería',
  'Sopaipillas': 'Amasandería',
  'Quiches': 'Amasandería',
  'Bollería y Panadería': 'Amasandería',
  'Empanadas de horno': 'Empanadas',

  // ─── Desayunos & Brunch (comida) ──────────────────────────
  'BOLLERIA': 'Desayunos',
  'PROMO BOLLERIA': 'Desayunos',
  'CREPES SALADAS': 'Desayunos',
  'WAFFLES SALADOS': 'Desayunos',
  'Desayunos': 'Desayunos',
  'DESAYUNOS': 'Desayunos',
  'Desayunos (Hasta las 12:30 hrs)': 'Desayunos',
  'Desayunos de Casa': 'Desayunos',
  'Mañanas Deliciosas (09:00 a 14:00 hrs) - Desayuno': 'Desayunos',
  'Mañanas Deliciosas (09:00 a 14:00 hrs) - Brunch': 'Desayunos',
  'Antojos Salados - Tostadas': 'Desayunos',

  // ─── Combos & Promos ────────────────────────────────────────
  'Combos': 'Combos',
  'Combos Mostrito': 'Combos',
  'Promociones': 'Combos',
  'Promociones Mix': 'Combos',
  'Promociones Premium': 'Combos',
  'Promociones de la semana hasta las 21Hs': 'Combos',
  'Menús': 'Combos',
  'Menú Kids': 'Combos',
  'Para los más pequeños': 'Combos',

  // ─── Acompañamientos & Extras ───────────────────────────────
  'Papas Fritas': 'Papas fritas',
  'Fritas': 'Papas fritas',
  'Salchipapa': 'Papas fritas',
  'AGREGA A TU SANDWICH': 'Extras',
  'Adicionales': 'Extras',
  'Extras': 'Extras',
  'Salsa Extra': 'Extras',
  'Salsas': 'Extras',
  'Salsas y Extras': 'Extras',

  // ─── Casos específicos de locales ─────────────────────────────────

  // Completos / vienesas
  'Vienesas': 'Completos',
  'Vienesa': 'Completos',
  'Completo': 'Completos',

  // Sándwiches
  'Lomos': 'Sándwiches',
  'Sandwich 2x1': 'Sándwiches',

  // Platos de fondo (variantes de capitalización y nombres alternativos)
  'Platos de Fondo': 'Platos de fondo',
  'Platos a la Carta': 'Platos de fondo',
  'PLATOS A LA CARTA': 'Platos de fondo',
  'PLATO DEL CHEF': 'Platos de fondo',
  'Fuertes de la Casa': 'Platos de fondo',
  'Social Food': 'Platos de fondo',
  'Típicos': 'Platos de fondo',
  'Sopas y Cremas': 'Platos de fondo',


  // Empanadas
  'Empanadas Clásicas': 'Empanadas',
  'Empanadas venezolanas': 'Venezolana',

  // Pollo
  'Pollos': 'Pollo y alitas',

  // Hamburguesas (Shaka Burger)
  'Burgers Clásicas': 'Hamburguesas',
  'Burgers de Autor': 'Hamburguesas',
  'Green Burgers': 'Hamburguesas',

  // Mariscos (Shaka Burger)
  'Especialidad del Mar': 'Mariscos',

  // Pastas
  'Pastas y Salsas': 'Pastas',
  'Carnes y Pescados': 'Parrilla',

  // Postres
  'Waffles 🧇': 'Postres',

  // Sushi (categorías sin mapear de locales existentes)
  'Tempura Rolls': 'Sushi',
  'Gunkan': 'Sushi',
  'Acevichados': 'Sushi',
  'ACEVICHADOS (roll + salsa acevichada)': 'Sushi',
  'Cheese Rolls': 'Sushi',
  'Sugerencias del mes': 'Sushi',
  'TABLAS INDIVIDUALES': 'Sushi',
  'BANDEJA PREMIUM': 'Sushi',
  'Combinaciones': 'Sushi',
  'Appetizers Fríos': 'Sushi',
  'Platos calientes': 'Sushi',  // Magnolia Sushi
  'B.3 HOSOMAKIS - NIGUIRIS': 'Sushi',
  'A.1 PROMOCIONES': 'Sushi',  // More Sushi
  'RECOMENDADO': 'Sushi',
  'PROMOS INDIVIDUALES': 'Sushi',
  'PROMO DE LA SEMANA': 'Sushi',
  'PROMOCIONES FRITAS': 'Sushi',

  // Ceviches
  'Tiraditos': 'Ceviches',

  // China (categorías específicas de restaurantes chinos)
  'Diente de dragón': 'China',
  'Chapsui': 'China',
  'Chapsui Verduras De Temporada': 'China',
  'Agridulce': 'China',
  'Comida Especlal': 'China',
  'Arrollados': 'China',
  'Fuyón': 'China',
  'Arroces': 'China',  // La Fonda Paisa también tiene pero es plato genérico → China más probable

  // ─── MAPEOS GENERADOS 2026-06-15 ──────────────────────────────────

  // Sushi
  'A.0 ROLLS PREMIUN': 'Sushi',
  'A.2 CALIFORNIA ROLLS (ENVUELTOS EN MASAGO, SESAMO O CIBOULETTE)': 'Sushi',
  'A.4 CHESSE ROLLS (ENVUELTOS EN QUESO CREMA)': 'Sushi',
  'A.5 ROLLS FRITOS': 'Sushi',
  'A.8 VEGGIE-VEGANS': 'Sushi',
  'Abril y Mayo': 'Sushi',
  'Appetizers': 'Sushi',
  'Appetizers - Sashimi': 'Sushi',
  'Avocado Rolls (cubiertos en palta)': 'Sushi',
  'B.1 GOHAN': 'Sushi',
  'B.3 HOSOMAKI - NIGUIRIS': 'Sushi',
  'B.5 SASHIMI (8 CORTES)': 'Sushi',
  'B.7 HANROLLS': 'Sushi',
  'BARCO PREMIUM': 'Sushi',
  'CALIFORNIA': 'Sushi',
  'CALIFORNIA ROLL': 'Sushi',
  'CEVICHE ROLL': 'Sushi',
  'CHEESE ROLL': 'Sushi',
  'COLACION DE SUSHI': 'Sushi',
  'California': 'Sushi',
  'California Rolls (cubiertos en sesamo o ciboullete)': 'Sushi',
  'Californias': 'Sushi',
  'Cheese Rolls (cubiertos en queso crema)': 'Sushi',
  'ENTRADAS FRIAS': 'Sushi',
  'ESPECIAL ROLLS': 'Sushi',
  'ESPECIALES': 'Sushi',
  'ESPECIALES DE CASA': 'Sushi',
  'Envuelto queso crema': 'Sushi',
  'FURAY ROLLS': 'Sushi',
  'GOHAN': 'Sushi',
  'GOHANS': 'Sushi',
  'Gohan Chirashi': 'Sushi',
  'Gohans': 'Sushi',
  'HAND ROLL (23 CMS)': 'Sushi',
  'HAND ROLLS': 'Sushi',
  'HANDROLLS': 'Sushi',
  'HOSOMAKI': 'Sushi',
  'HOSOMAKI (env. en alga nori)': 'Sushi',
  'HOT ROLL': 'Sushi',
  'Handroll': 'Sushi',
  'Hosomaki': 'Sushi',
  'Hosomaki Rolls': 'Sushi',
  'Keto Rolls (Sin Arroz)': 'Sushi',
  'NIGIRI 2 UND': 'Sushi',
  'NUEVOS ROOLS NIKEII': 'Sushi',
  'Nigiris': 'Sushi',
  'Nikkei - Camarón': 'Sushi',
  'Nikkei rolls': 'Sushi',
  'PROMO ROYLE CLASICO': 'Sushi',
  'PROMOCIONES MIXTAS': 'Sushi',
  'PROMOCIONES VEGETARIANAS': 'Sushi',
  'Para Compartir Sushi': 'Sushi',
  'Poke bowls': 'Sushi',
  'Promociones Cocina Mayo': 'Sushi',
  'Promociones de Sushi': 'Sushi',
  'ROLL DEL DIA A SOLO $6990': 'Sushi',
  'ROLL PREMIUM': 'Sushi',
  'ROLLS CALIENTES': 'Sushi',
  'ROLLS CALIENTES (frito en panko)': 'Sushi',
  'ROLLS CALIFORNIA (envueltos en sésamo o ciboullete)': 'Sushi',
  'ROLLS DELUXE': 'Sushi',
  'ROLLS ELITE': 'Sushi',
  'ROLLS ENV EN PALTA': 'Sushi',
  'ROLLS ENV EN QUESO': 'Sushi',
  'ROLLS ENV EN SALMON': 'Sushi',
  'ROLLS ENV EN SESAMO Y CIBOULET': 'Sushi',
  'ROLLS ENVUELTO EN PALTA': 'Sushi',
  'ROLLS ENVUELTOS EN QUESO': 'Sushi',
  'ROLLS ENVUELTOS EN SALMON': 'Sushi',
  'ROLLS FRIOS': 'Sushi',
  'ROLLS FRITOS': 'Sushi',
  'ROLLS NIKKEY': 'Sushi',
  'ROLLS PREMIUM': 'Sushi',
  'ROLLS PREMIUN': 'Sushi',
  'ROLLS SIN ARROZ': 'Sushi',
  'ROYLE LOVERS': 'Sushi',
  'Raisu Rolls': 'Sushi',
  'Rice Free Roll': 'Sushi',
  'Roles Básicos': 'Sushi',
  'Roles PREMIUM': 'Sushi',
  'Roll Sin Arroz': 'Sushi',
  'Roll Tradicional': 'Sushi',
  'Rollos Calientes (Tempura Panko)': 'Sushi',
  'Rollos California (Nori, Sésamo o Ciboullette)': 'Sushi',
  'Rollos Sin Arroz': 'Sushi',
  'Rollos en Palta': 'Sushi',
  'Rollos en Philadelphia': 'Sushi',
  'Rollos en Salmón': 'Sushi',
  'Rolls - Avocado Rolls': 'Sushi',
  'Rolls - California Rolls': 'Sushi',
  'Rolls - Especial Rolls': 'Sushi',
  'Rolls - Furay Rolls': 'Sushi',
  'Rolls - Hosomaki': 'Sushi',
  'Rolls - Sake Rolls': 'Sushi',
  'Rolls CQ / Sushi Burger': 'Sushi',
  'Rolls Calientes': 'Sushi',
  'Rolls California (Ciboulete)': 'Sushi',
  'Rolls California (Masago)': 'Sushi',
  'Rolls California (Sesamo)': 'Sushi',
  'Rolls Cubiertos En Palta': 'Sushi',
  'Rolls Cubiertos En Queso': 'Sushi',
  'Rolls Cubiertos En Salmón': 'Sushi',
  'Rolls Envueltos En Masa Tempura': 'Sushi',
  'Rolls Envueltos En Panko': 'Sushi',
  'Rolls Mixtos': 'Sushi',
  'Rolls Nikkei con Topping': 'Sushi',
  'Rolls Nokona Premium': 'Sushi',
  'Rolls Premium': 'Sushi',
  'Rolls SIN ARROZ': 'Sushi',
  'SIN ARROZ ROLLS': 'Sushi',
  'SUSHI BURGER': 'Sushi',
  'SUSHI BURGERS': 'Sushi',
  'SUSHI NIKEEI': 'Sushi',
  'SUSHI SIN ARROZ': 'Sushi',
  'SUSHIBURGER': 'Sushi',
  'SUSHIPLETOS': 'Sushi',
  'Sake Rolls (cubiertos en salmón)': 'Sushi',
  'Sin Arroz': 'Sushi',
  'Sin Arroz Rolls': 'Sushi',
  'Sugerencias de Alto Japón': 'Sushi',
  'Sushi - Rolls a la carta': 'Sushi',
  'Sushi - Rolls envueltos en palta': 'Sushi',
  'Sushi - Rolls envueltos en panko': 'Sushi',
  'Sushi - Rolls envueltos en salmón': 'Sushi',
  'Sushi - Rolls sin arroz': 'Sushi',
  'Sushi Burger': 'Sushi',
  'Sushi Burgers': 'Sushi',
  'Sushi sin Arroz': 'Sushi',
  'Sushipleto': 'Sushi',
  'TEMAKI': 'Sushi',
  'Tablas Elección del Cliente': 'Sushi',
  'Tablas Nikkei': 'Sushi',
  'Tablas de Sushi': 'Sushi',
  'Tataki': 'Sushi',
  'Tempura Rolls (panko)': 'Sushi',
  'Tempura Y Panko Rolls': 'Sushi',
  'Torta de sushi': 'Sushi',
  'Tradicionales': 'Sushi',
  'VIP ROLL': 'Sushi',
  'Veggie Rolls': 'Sushi',

  // Asiática
  'Bubble Tea - Bubble Milk Tea (Con Leche)': 'Asiática',
  'Bubble Tea - Bubble Tea (Sin Leche)': 'Asiática',
  'Bubble Tea - Extras Bubbles': 'Asiática',
  'Entradas 前菜': 'Asiática',
  'GYOSAS': 'Asiática',
  'Gyozas': 'Asiática',
  'Mini Don': 'Asiática',
  'PIQUEOS CALIENTES': 'Asiática',
  'Platos Japoneses': 'Asiática',
  'RAMEN': 'Asiática',
  'Ramen': 'Asiática',
  'Ramen Especial': 'Asiática',
  'Ramen Infantil': 'Asiática',
  'Rice Ball': 'Asiática',
  'Tonkotsu Ramen': 'Asiática',
  'YAKISOBA': 'Asiática',
  "Yakisoba Gaby's": 'Asiática',

  // Cafetería
  'Bebestibles y Cafeteria': 'Cafetería',
  'Bebidas calientes': 'Cafetería',

  // Ceviches
  'Appetizer—Entradas': 'Ceviches',
  'Causas y Entradas': 'Ceviches',
  'Cebiches': 'Ceviches',
  'Ceviches y pescados': 'Ceviches',
  'Crudos & Ligeros': 'Ceviches',
  'ENTRADA': 'Ceviches',
  'Frescos': 'Ceviches',
  'Leche de Tigre': 'Ceviches',
  'Para Empezar': 'Ceviches',
  'Para compartir / entradas': 'Ceviches',
  'Para compartir o iniciar': 'Ceviches',
  'Piqueo Frío': 'Ceviches',
  'Platos Fríos': 'Ceviches',
  'Tablas': 'Ceviches',

  // Completos
  'COMPLETOS': 'Completos',
  'HOT DOG + papas fritas rústicas': 'Completos',
  'Hot Dog Clásico': 'Completos',
  'Hot Dogs': 'Completos',
  'Platos CQ': 'Completos',
  'Vienesas/As': 'Completos',

  // Desayunos
  'ALL INCLUSIVE // 9:00 a 12:30hrs': 'Desayunos',
  'BREAKFAST · DESAYUNOS': 'Desayunos',
  'BRUNCH': 'Desayunos',
  'BRUNCH // 9:30 a 13:00 // 17:00 a 19:00hrs': 'Desayunos',
  'HUEVOS TRUFADOS': 'Desayunos',
  'TOSTADAS PUELO': 'Desayunos',
  'Tardes Deliciosas (A partir de las 15:00 hrs.)': 'Desayunos',

  // Empanadas
  'B.6 PIQUEOS CALIENTES': 'Empanadas',
  'Empanadas Y Pastelitos': 'Empanadas',
  'Para Dos': 'Empanadas',
  'Para comenzar': 'Empanadas',
  'Picoteo': 'Empanadas',
  'Piqueo Caliente': 'Empanadas',
  'QUICK TO START': 'Empanadas',
  'TABLAS Y PICOTEOS': 'Empanadas',

  // Hamburguesas
  'BURGERS': 'Hamburguesas',
  'Burger': 'Hamburguesas',
  'Burger y Sandwich - Brisket': 'Hamburguesas',
  'Burger y Sandwich - Burger': 'Hamburguesas',
  'Burger y Sandwich - Linea Premium / Recomendados': 'Hamburguesas',
  'Burger y Sandwich - Pulled Pork': 'Hamburguesas',
  'Burgers CQ': 'Hamburguesas',
  'HAMBURGUESAS': 'Hamburguesas',
  'HAMBURGUESAS CASERAS CARNE/POLLO/VEGGIE': 'Hamburguesas',
  'Hamburguesas (Incluye Papas Fritas)': 'Hamburguesas',
  'Hamburguesas 100% Caseras': 'Hamburguesas',
  'KIDS ZONE': 'Hamburguesas',
  'KROSTY BURGER': 'Hamburguesas',
  'Menú Infantil y Snacks': 'Hamburguesas',
  'SMASH BURGER': 'Hamburguesas',
  'SMASHED BURGERS': 'Hamburguesas',
  'Sandwich Hamburguesa': 'Hamburguesas',
  'Smash Burger & Más': 'Hamburguesas',

  // Mariscos
  'Chicharrones y Jaleas': 'Mariscos',
  'Ebi Tempura O Panko': 'Mariscos',
  'Menú Acampados 40 Piezas': 'Mariscos',
  'Tablas para Compartir': 'Mariscos',

  // Mexicana
  'BURRITOS': 'Mexicana',
  'Burrito Guff': 'Mexicana',
  'CACHAPAS': 'Mexicana',
  'COMIDA RAPIDA VENEZOLANA': 'Mexicana',
  'PATACONES': 'Mexicana',
  // El Zocalo
  'Pa\' Taquear': 'Mexicana',
  'PA\'. TAQUEAR': 'Mexicana',
  'Los Burritos': 'Mexicana',
  'Los Recomendados': 'Mexicana',
  'Especialidades Mexicanas': 'Mexicana',

  // Parrilla
  'CHORRILLANAS Y PAPAS FRITAS': 'Parrilla',
  'Carnes Premiun': 'Parrilla',
  'Carnes a las Brasas': 'Parrilla',
  'Cortes De Carnes': 'Parrilla',
  'Cortes Premium': 'Parrilla',
  'Costillas': 'Parrilla',
  'Grill': 'Parrilla',
  'Interiores': 'Parrilla',
  'MECHADAS + papas fritas rusticas': 'Parrilla',
  'PARRILLAS': 'Parrilla',
  'Parrillas': 'Parrilla',
  'Pichangas y Papas Fritas': 'Parrilla',
  'Plateada': 'Parrilla',
  'Platos Rápidos y Económicos': 'Parrilla',
  'Premium & Grill': 'Parrilla',

  // Pastas
  'Arroces y Cremosos': 'Pastas',
  'Lasaña y Cannelloni': 'Pastas',
  'Pastas Artesanales': 'Pastas',
  'Pastas y Risottos': 'Pastas',
  'Risotto': 'Pastas',

  // Peruana
  'Cocina Peruana': 'Peruana',
  'Criollos de América': 'Peruana',
  'ESPECIALIDADES PUELO': 'Peruana',
  'Nuestras Sopas': 'Peruana',
  'Platos de Fondo — Salteados al Wok': 'Peruana',

  // Pizzas
  'A Tú Pinta': 'Pizzas',
  'Brew Pizza': 'Pizzas',
  'Calzone Individual': 'Pizzas',
  'Crea tu propia Pizza': 'Pizzas',
  'PIZZAS ARTESANAL': 'Pizzas',
  'PIZZAS FAMILIARES': 'Pizzas',
  'PIZZAS INDIVIDUALES': 'Pizzas',
  'PIZZAS MEDIANA': 'Pizzas',
  'Pizzas & Snack': 'Pizzas',
  'Pizzas Clásicas': 'Pizzas',
  'Pizzas De Autor': 'Pizzas',
  'Pizzas Especiales': 'Pizzas',
  'Pizzas Familiares': 'Pizzas',
  'Pizzas Individuales': 'Pizzas',
  'Pizzas Medianas': 'Pizzas',
  'Pizzas de la Casa': 'Pizzas',
  'Pizzetas': 'Pizzas',
  'Sandwich (Masa de Pizza con ingredientes frios)': 'Pizzas',

  // Pollo
  'Bocados reconfortantes': 'Pollo',
  'Pollo a la Brasa': 'Pollo',

  // Postres
  'Porción de tarta': 'Postres',
  'Tarta': 'Postres',
  'Torta Completa': 'Postres',
  'Cheesecake': 'Postres',
  'Bombones Proteicos': 'Postres',
  'Donuts Proteicas': 'Postres',
  'Dulces': 'Postres',
  'Dulces y postres': 'Postres',
  'Gelateria': 'Helados',
  'Helados': 'Helados',
  'POSTRES Y HELADOS': 'Helados',
  'Pack Protein Cheesecake.': 'Postres',
  'Pack Protein Cookies.': 'Postres',
  'Packs Bombones Proteicos': 'Postres',
  'Packs Protein Brownie.': 'Postres',
  'Packs Protein Cakes.': 'Postres',
  'Packs Protein Cups.': 'Postres',
  'Packs Protein Donuts.': 'Postres',
  'Packs Protein Waffles.': 'Postres',
  'Para Llevar o Encargar - Tartas para compartir en casa': 'Postres',
  'Para Llevar o Encargar - Tortas para celebrar': 'Postres',
  'Pasteleria': 'Postres',
  'Pastelería': 'Postres',
  'Postre': 'Postres',
  'Postres - Waffles Mimi!': 'Postres',
  'Protein Cookies': 'Postres',
  'Protein Cups': 'Postres',
  'TORTAS Y PASTELES': 'Postres',
  'Tartas Proteicas': 'Postres',
  'Tentaciones Dulces - Brownie': 'Postres',
  'Tentaciones Dulces - Canelé': 'Postres',
  'Tentaciones Dulces - Cupcakes': 'Postres',
  'Tentaciones Dulces - Galletas': 'Postres',
  'Tentaciones Dulces - Galletones': 'Postres',
  'Tentaciones Dulces - Gluten Free': 'Postres',
  'Tentaciones Dulces - Muffins': 'Postres',
  'Tentaciones Dulces - Rollo de Canela': 'Postres',
  'Tentaciones Dulces - Tartas': 'Postres',
  'Tentaciones Dulces - Tortas': 'Postres',
  'Una Cosita Dulce': 'Postres',

  // Saludable
  'Comida saludable': 'Saludable',
  'Crea tu propia Ensalada': 'Saludable',
  'ENSALADAS': 'Saludable',
  'ENSALADAS Y BOWLS': 'Saludable',
  'FRESH SALAD & WRAPS': 'Saludable',
  'Ligero y Fresco': 'Saludable',
  'Vegetarianos': 'Saludable',

  // Sándwiches
  'As': 'Sándwiches',
  'CHURRASCO': 'Sándwiches',
  'CLASSIC SANDWICH': 'Sándwiches',
  'Chicken Sandwich': 'Sándwiches',
  'Lomitos': 'Sándwiches',
  'Los Infaltables': 'Sándwiches',
  'SANDWICHS': 'Sándwiches',
  'Sandwich Ave': 'Sándwiches',
  'Sandwich Churrasco': 'Sándwiches',
  'Sandwich Lomito': 'Sándwiches',
  'Sandwich Mechada': 'Sándwiches',
  'Sandwichs XL': 'Sándwiches',
  'Sándwich Pollo': 'Sándwiches',
}

// ─── Taxonomía QC: parents → leaves ──────────────────────────────────────────
// Parents: lo que ve el usuario en filtros del feed (chips)
// Leaves: lo que se muestra en modal del plato + usado internamente para recomendaciones

export const PARENT_TO_LEAVES: Record<string, string[]> = {
  'Comida rápida': ['Hamburguesas', 'Completos', 'Sándwiches', 'Papas fritas'],
  'Pizza':         ['Pizzas'],
  'Sushi':         ['Sushi'],
  'Japonesa':      ['Ramen', 'Gyoza', 'Japonesa'],
  'China':         ['China'],
  'Thai':          ['Thai'],
  'India':         ['India'],
  'Asiática':      ['Asiática'],
  'Peruana':       ['Ceviches', 'Peruana'],
  'Mariscos':      ['Mariscos', 'Pastel de jaiba'],
  'Parrilla':      ['Parrilla'],
  'Pastas':        ['Pastas'],
  'Venezolana':    ['Venezolana'],
  'Mexicana':      ['Mexicana'],
  'Pollo':         ['Pollo y alitas'],
  'Empanadas':     ['Empanadas'],
  'Saludable':     ['Ensaladas', 'Bowls', 'Saludable'],
  'Desayunos':     ['Desayunos', 'Cafetería', 'Amasandería'],
  'Postres':       ['Postres', 'Helados'],
  'Bebidas':       ['Smoothies', 'Milkshakes', 'Bebidas'],
}

/** Leaves que aparecen bajo múltiples parents (para filtro del feed) */
export const DUAL_PARENT_LEAVES: Record<string, string[]> = {
  'Gyoza': ['Japonesa', 'Asiática'],
}

/** Lookup leaf → parent primario */
export const LEAF_TO_PARENT: Record<string, string> = Object.fromEntries(
  Object.entries(PARENT_TO_LEAVES).flatMap(([parent, leaves]) => leaves.map(leaf => [leaf, parent]))
)

/** Lista ordenada de parents para el feed filter */
export const QC_PARENTS: string[] = Object.keys(PARENT_TO_LEAVES)

/** Todas las leaves válidas */
export const QC_LEAVES = new Set(Object.values(PARENT_TO_LEAVES).flat())

/** Alias para compatibilidad con código existente */
export const QC_CATEGORIES = QC_LEAVES

/** Categorías de restaurante que heredan el primaryCategory del local (combos, promos, etc.) */
export const AMBIGUOUS_CATEGORIES = new Set([
  'Combos', 'Combo', 'Box', 'Boxes', 'Promo', 'Promos', 'Promociones',
  'Especiales', 'Especial', 'Lo más pedido', 'Más pedidos', 'Lo más vendido',
  'Menú del día', 'Menu del dia', 'Menú', 'Menu', 'Sets', 'Set',
  'Favoritos', 'Favoritas', 'Destacados', 'Destacadas',
  'Recomendados', 'Recomendadas', 'Preferidos', 'Preferidas',
])

/** Devuelve true si el nombre es una leaf válida de QC */
export function isValidQcCategory(name: string): boolean {
  return QC_LEAVES.has(name)
}

/** Devuelve el parent de una leaf, o la propia leaf si no tiene parent definido */
export function getParentCategory(leaf: string): string {
  return LEAF_TO_PARENT[leaf] ?? leaf
}

/** Solo se excluyen extras/salsas (no son platos ni bebidas reales) */
export const EXCLUDED_CATEGORIES = new Set([
  'Extras', 'Adicionales', 'Salsa Extra', 'Salsas', 'Salsas y Extras',
  'AGREGA A TU SANDWICH',
])

/** Normaliza una categoría de la BD. Si no está en el mapa, usa el nombre original. */
// Reglas por patrón — cubren familias enteras de nombres sin listarlos uno a uno.
// Orden: más específicos primero. Si un nombre cae en varias reglas, gana la primera.
const CATEGORY_PATTERNS: Array<{ pattern: RegExp; norm: string }> = [

  // ── Pizzas ──────────────────────────────────────────────────────────────────
  // "Pizza XL / Familiar / Mediana / Personal / Artesanal"...
  { pattern: /^pizzas?\b/i, norm: 'Pizzas' },
  { pattern: /^calzone/i,   norm: 'Pizzas' },

  // ── Hamburguesas ────────────────────────────────────────────────────────────
  // "Hamburguesa Clásica / Gourmet / de la Casa"...
  { pattern: /^hamburguesas?\b/i, norm: 'Hamburguesas' },
  { pattern: /^burgers?\b/i,      norm: 'Hamburguesas' },

  // ── Sándwiches ──────────────────────────────────────────────────────────────
  // "Sandwich de Pollo / Caliente / Club"...
  { pattern: /^s[aá]ndwich/i, norm: 'Sándwiches' },
  { pattern: /^lomos?\b/i,          norm: 'Sándwiches' }, // "Lomo a lo Pobre" como categoría
  { pattern: /^chacareros?\b/i,     norm: 'Sándwiches' },

  // ── Completos ───────────────────────────────────────────────────────────────
  // "Completo Italiano / Dinámico / Tomate Palta"...
  { pattern: /^completos?\b/i,  norm: 'Completos' },
  { pattern: /^vienesas?\b/i,   norm: 'Completos' },
  { pattern: /^hot\s*dogs?\b/i, norm: 'Completos' },

  // ── Empanadas ───────────────────────────────────────────────────────────────
  // "Empanada Frita / al Horno / de Pino"...
  { pattern: /^empanadas?\b/i, norm: 'Empanadas' },

  // ── Parrilla ────────────────────────────────────────────────────────────────
  { pattern: /^carnes?\b/i,       norm: 'Parrilla' },
  { pattern: /^cortes?\b/i,       norm: 'Parrilla' },
  { pattern: /^asados?\b/i,       norm: 'Parrilla' },
  { pattern: /^parrilladas?\b/i,  norm: 'Parrilla' },
  { pattern: /a\s+la\s+parrilla/i, norm: 'Parrilla' },
  { pattern: /^vacuno\b/i,        norm: 'Parrilla' },

  // ── Pollo ───────────────────────────────────────────────────────────────────
  { pattern: /^pollo\b/i,     norm: 'Pollo y alitas' },
  { pattern: /^pechugas?\b/i, norm: 'Pollo y alitas' },
  { pattern: /^alitas?\b/i,   norm: 'Pollo y alitas' },
  { pattern: /^nuggets?\b/i,  norm: 'Pollo y alitas' },

  // ── Pastas ──────────────────────────────────────────────────────────────────
  // "Pasta Fresca / Rellena / Casera", "Ñoquis", "Pastas y Salsas"...
  { pattern: /^pastas?\b/i,  norm: 'Pastas' },
  { pattern: /^[nñ]oquis?\b/i, norm: 'Pastas' },
  { pattern: /^lasañ/i,      norm: 'Pastas' },
  { pattern: /^fettucine\b|^tagliatelle\b|^linguine\b|^penne\b|^rigatoni\b/i, norm: 'Pastas' },

  // ── Sushi ───────────────────────────────────────────────────────────────────
  { pattern: /^rolls?\b/i,    norm: 'Sushi' },
  { pattern: /^temakis?\b/i,  norm: 'Sushi' },
  { pattern: /^sashimis?\b/i, norm: 'Sushi' },
  { pattern: /^nigiris?\b|^niguiris?\b/i, norm: 'Sushi' },
  { pattern: /^makis?\b/i,    norm: 'Sushi' },
  { pattern: /^hosomakis?\b/i, norm: 'Sushi' },
  { pattern: /^uramakis?\b/i, norm: 'Sushi' },
  { pattern: /^gunkans?\b/i,  norm: 'Sushi' },

  // ── Japonesa ────────────────────────────────────────────────────────────────
  { pattern: /^ramens?\b/i,                              norm: 'Ramen' },
  { pattern: /^gyozas?\b|^dumplings?\b/i,                norm: 'Gyoza' },
  { pattern: /^(cocina|comida|platos?)\s+japones[ae]/i,  norm: 'Japonesa' },
  { pattern: /^japonesa?\b/i,                            norm: 'Japonesa' },

  // ── Asiática (catch-all) ─────────────────────────────────────────────────────
  { pattern: /^(cocina|comida|platos?)\s+asi[aá]tic[ao]/i, norm: 'Asiática' },
  { pattern: /^asi[aá]tic[ao]\b/i,                         norm: 'Asiática' },
  { pattern: /^wok\b/i,                                    norm: 'Asiática' },

  // ── Ceviches ────────────────────────────────────────────────────────────────
  // "Ceviche", "Ceviches Clásicos", "Tiraditos"...
  { pattern: /^ceviches?\b/i,  norm: 'Ceviches' },
  { pattern: /^tiraditos?\b/i, norm: 'Ceviches' },

  // ── Mariscos ────────────────────────────────────────────────────────────────
  // "Pescados", "Del Mar", "Frutos del Mar", "Productos del Mar"...
  { pattern: /^pescados?\b/i,           norm: 'Mariscos' },
  { pattern: /^(frutos?|productos?)\s+del\s+mar/i, norm: 'Mariscos' },
  { pattern: /^del\s+mar\b/i,           norm: 'Mariscos' },
  { pattern: /^mariscos?\b/i,           norm: 'Mariscos' },

  // ── Cocinas por nombre — el adjetivo de cocina en cualquier posición gana ────
  // "Gastronomía Peruana", "Platos Peruanos", "Cocina Peruana", "Especialidades Peruanas"...
  { pattern: /\bperuana?s?\b|\bperuano\b/i,     norm: 'Peruana' },
  { pattern: /\bchina?s?\b|\bchinos?\b/i,       norm: 'China' },
  { pattern: /\bthai\b|\btailand[eé]/i,         norm: 'Thai' },
  { pattern: /\bindias?\b|\bindio\b/i,           norm: 'India' },
  { pattern: /\bmexicana?s?\b|\bmexicano\b/i,   norm: 'Mexicana' },
  { pattern: /\bvenezolana?s?\b|\bvenezolano\b/i, norm: 'Venezolana' },
  { pattern: /\bjaponesa?s?\b|\bjapon[eé]s\b/i, norm: 'Japonesa' },

  // ── Mexicana por tipo de plato ───────────────────────────────────────────────
  { pattern: /^tacos?\b/i,        norm: 'Mexicana' },
  { pattern: /^fajitas?\b/i,      norm: 'Mexicana' },
  { pattern: /^quesadillas?\b/i,  norm: 'Mexicana' },
  { pattern: /^nachos?\b/i,       norm: 'Mexicana' },

  // ── Platos de fondo ─────────────────────────────────────────────────────────
  // Primero los que implican cocina específica (para no caer en el catch-all)
  // "Plato de Fondo", "Platos Clásicos", "Platos Alemanes", "Platos del Chef"...
  { pattern: /^platos?\s+de\s+fondo/i, norm: 'Platos de fondo' },
  { pattern: /^platos?\s+(cl[aá]sicos?|principales?|del?\s+chef|de\s+la\s+casa|de\s+temporada|calientes?|fuertes?)/i, norm: 'Platos de fondo' },
  { pattern: /^platos?\s+[a-záéíóúüñ]{4,}/i, norm: 'Platos de fondo' }, // catch-all: "Platos Alemanes"
  { pattern: /^segundos?\s*(platos?)?\b/i, norm: 'Platos de fondo' }, // "Segundo", "Segundo Plato"
  { pattern: /^fondos?\b/i, norm: 'Platos de fondo' }, // "Fondo", "Fondos"

  // ── Papas fritas (Comida rápida) ─────────────────────────────────────────────
  { pattern: /papas?\s*(fritas?|chips?)/i, norm: 'Papas fritas' },
  { pattern: /^fritas?\b|^fried\b/i,       norm: 'Papas fritas' },
  { pattern: /^salchipapa/i,               norm: 'Papas fritas' },

  // ── Entradas ────────────────────────────────────────────────────────────────
  { pattern: /^entradas?\b/i,   norm: 'Entradas' },
  { pattern: /^para\s+(compartir|picar|comenzar|abrir|partir)/i, norm: 'Entradas' },
  { pattern: /^acompa[nñ]amientos?\b/i, norm: 'Entradas' },
  { pattern: /^picadas?\b/i,    norm: 'Entradas' },
  { pattern: /^tapas?\b/i,      norm: 'Entradas' },
  { pattern: /^bocados?\b/i,    norm: 'Entradas' },
  { pattern: /^starters?\b/i,   norm: 'Entradas' },
  { pattern: /^aperitivos?\b/i, norm: 'Entradas' },
  { pattern: /^piqueos?\b/i,    norm: 'Entradas' },
  { pattern: /^snacks?\b/i,     norm: 'Entradas' },
  { pattern: /^appetizers?\b/i, norm: 'Entradas' },
  { pattern: /^breadsticks?|palitos?\s+de\s+(ajo|pan|queso)/i, norm: 'Entradas' },
  { pattern: /^provoleta[s]?\b/i, norm: 'Entradas' },
  { pattern: /^patitas?\b/i,      norm: 'Entradas' },
  { pattern: /^guarniciones?\b/i, norm: 'Entradas' },

  // ── Saludable ───────────────────────────────────────────────────────────────
  { pattern: /^ensaladas?\b/i,              norm: 'Ensaladas' },
  { pattern: /^bowls?\b|power\s+bowl/i,     norm: 'Bowls' },
  { pattern: /^pok[eé]\b/i,                norm: 'Bowls' },
  { pattern: /^wraps?\b/i,                 norm: 'Saludable' },
  { pattern: /^opciones?\s+saludables?/i,  norm: 'Saludable' },
  // vegano/vegetariana → NO son categorías de comida, solo indican dieta

  // ── Desayunos ───────────────────────────────────────────────────────────────
  // "Desayuno", "Desayunos y Brunch", "Once", "Onces", "Meriendas"...
  { pattern: /^desayunos?\b/i,  norm: 'Desayunos' },
  { pattern: /^brunch\b/i,      norm: 'Desayunos' },
  { pattern: /^onces?\b/i,      norm: 'Desayunos' },
  { pattern: /^meriendas?\b/i,  norm: 'Desayunos' },

  // ── Cafetería ───────────────────────────────────────────────────────────────
  // "Café", "Cafés", "Café y Té", "Infusiones", "Bebidas Calientes"...
  { pattern: /^caf[eé]s?\b/i,       norm: 'Cafetería' },
  { pattern: /^infusiones?\b/i,      norm: 'Cafetería' },
  { pattern: /^t[eé]s?\b/i,          norm: 'Cafetería' },
  { pattern: /^bebidas?\s+calientes?/i, norm: 'Cafetería' },

  // ── Amasandería ─────────────────────────────────────────────────────────────
  // "Pan", "Panes", "Medialunas", "Croissants", "Pastelería"...
  { pattern: /^panes?\b/i,        norm: 'Amasandería' },
  { pattern: /^medialunas?\b/i,   norm: 'Amasandería' },
  { pattern: /^croissants?\b/i,   norm: 'Amasandería' },
  { pattern: /^pasteler[íi]a\b/i, norm: 'Amasandería' },
  { pattern: /^masas?\b/i,        norm: 'Amasandería' },

  // ── Bebidas ─────────────────────────────────────────────────────────────────
  { pattern: /^smoothies?\b/i,              norm: 'Smoothies' },
  { pattern: /^milkshakes?\b|^malteadas?\b/, norm: 'Milkshakes' },
  { pattern: /^batidos?\b/i,                norm: 'Milkshakes' },
  { pattern: /^jugos?\b|^zumos?\b/i,        norm: 'Bebidas' },
  { pattern: /^bebidas?\b/i,                norm: 'Bebidas' },
  { pattern: /^licuados?\b/i,               norm: 'Bebidas' },
  { pattern: /^refrescos?\b/i,              norm: 'Bebidas' },

  // ── Postres ─────────────────────────────────────────────────────────────────
  { pattern: /^postres?\b/i,    norm: 'Postres' },
  { pattern: /^helados?\b|^heladeri[ao]/i, norm: 'Helados' },
  { pattern: /^gelato\b|^gelateria\b/i, norm: 'Helados' },
  { pattern: /^acai\b|^açaí\b/i, norm: 'Helados' },
  { pattern: /^sorbete\b/i,     norm: 'Helados' },
  { pattern: /^frozen\b/i,      norm: 'Helados' },
  { pattern: /^tortas?\b/i,     norm: 'Postres' },
  { pattern: /^pasteles?\b/i,   norm: 'Postres' },
  { pattern: /^dulces?\b/i,     norm: 'Postres' },
  { pattern: /^repostería\b/i,  norm: 'Postres' },
  { pattern: /^cheesecakes?\b/i, norm: 'Postres' },
  { pattern: /^mousses?\b/i,    norm: 'Postres' },
  { pattern: /^brownies?\b/i,   norm: 'Postres' },
  { pattern: /^waffles?\b/i,    norm: 'Postres' },
  { pattern: /^crepes?\b/i,     norm: 'Postres' },
]

export function normalizeCategory(name: string): string {
  if (CATEGORY_MAP[name]) return CATEGORY_MAP[name]
  const n = name.trim()
  for (const { pattern, norm } of CATEGORY_PATTERNS) {
    if (pattern.test(n)) return norm
  }
  return name
}

/**
 * Infiere la categoría QC desde el nombre de un plato individual.
 * Úsalo como fallback cuando la categoría del restaurante no es reconocida
 * (ej: "Rincón verde", "Especiales", "Lo más pedido").
 */
export function inferCategoryFromDishName(dishName: string): string | null {
  const n = dishName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  // Comida rápida
  if (/hamburguesa|burger|smash|cheeseburger/.test(n)) return 'Hamburguesas'
  if (/completo|vienesa|hot.?dog|italiana\b/.test(n)) return 'Completos'
  if (/\bsandwich\b|sandwic|lomito|churrasco|sanguch/.test(n)) return 'Sándwiches'
  if (/\bas\b/.test(n)) return 'Sándwiches'
  if (/papas?\s*fritas?|papas?\s*chips?|salchipapa/.test(n)) return 'Papas fritas'
  // Pizza
  if (/pizza/.test(n)) return 'Pizzas'
  // Sushi
  if (/sushi|roll\b|maki|temaki|nigiri|uramaki|sashimi|gunkan/.test(n)) return 'Sushi'
  // Japonesa
  if (/ramen|tonkotsu|shoyu|miso\s*soup/.test(n)) return 'Ramen'
  if (/gyoza|dumpling|edamame/.test(n)) return 'Gyoza'
  if (/yakimeshi|yakisoba|yakiudon|teriyaki|katsu\b|tonkatsu|udon\b|tempura|karaage|donburi/.test(n)) return 'Japonesa'
  // Cocinas específicas
  if (/spring\s*roll|rollos?\s*de\s+primavera/.test(n)) return 'Asiática'
  if (/satay|sate\b/.test(n)) return 'Asiática'
  if (/pad\s*thai|curry\s*thai|tom\s*yum|tom\s*kha|massaman/.test(n)) return 'Thai'
  if (/arepa|cachapa|tequeno|pabell[oó]n/.test(n)) return 'Venezolana'
  if (/taco|burrito|quesadilla|fajita|nacho/.test(n)) return 'Mexicana'
  // Mariscos / Peruana
  if (/ceviche|tiradito/.test(n)) return 'Ceviches'
  if (/pastel\s+(?:de\s+)?jaiv?a/.test(n)) return 'Pastel de jaiba'
  if (/marisco|jaiba|jaiva|camaron|langostino|pulpo|calamar|mejillon|\bpescado\b|merluza|reineta|congrio|corvina|trucha\b/.test(n)) return 'Mariscos'
  // Proteínas
  if (/empanada/.test(n)) return 'Empanadas'
  if (/pasta|tallar[ií]n|fettuccin|spaghett|linguini|rigatoni|penne|carbonara|bolognesa/.test(n)) return 'Pastas'
  if (/pollo|pechuga|alita|wing|broaster|tenders/.test(n)) return 'Pollo y alitas'
  if (/\blomo\b|bistec|bife\b|costill|chuleta\b/.test(n)) return 'Parrilla'
  // Saludable
  if (/ensalada/.test(n)) return 'Ensaladas'
  if (/bowl\b|poke/.test(n)) return 'Bowls'
  // Desayunos
  if (/desayuno|tostada|granola|avena|acai/.test(n)) return 'Desayunos'
  // Bebidas
  if (/smoothie/.test(n)) return 'Smoothies'
  if (/milkshake|malteada|batido/.test(n)) return 'Milkshakes'
  if (/jugo|zumo|licuado/.test(n)) return 'Bebidas'
  // Postres
  if (/helado|ice\s*cream|gelato|sorbete/.test(n)) return 'Helados'
  if (/postre|torta\b|brownie|mousse|cheesecake|waffle|crepe|panqueque/.test(n)) return 'Postres'
  return null
}

/** Infiere el tipo principal del restaurante a partir de su nombre */
function inferRestaurantType(restaurantName: string): string | null {
  const r = restaurantName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (/sushi|roll|makis?|temaki|nikkei|sakura|nippon|japonés|japon/i.test(r)) return 'Sushi'
  if (/burger|hamburgues|smash|brisket/i.test(r)) return 'Hamburguesas'
  if (/pizza|pizzeria|pizzas/i.test(r)) return 'Pizzas'
  if (/sandwich|sandwic|sanguch|sanguche|churrasco|lomito/i.test(r)) return 'Sándwiches'
  if (/completo|vienesa|hotdog|hot dog/i.test(r)) return 'Completos'
  if (/taco|mexicano|mexicana|burritos?|taqueria/i.test(r)) return 'Mexicana'
  if (/ceviche|cevicheria|mariscos?|pescados?|tiradito/i.test(r)) return 'Ceviches'
  if (/peruana?|peruano|peru\b/i.test(r)) return 'Peruana'
  if (/parrilla|grill|asado|asador|carnes?/i.test(r)) return 'Parrilla'
  if (/pasta|italiana?|italiano|trattoria|osteria/i.test(r)) return 'Pastas'
  if (/pollo|chicken|alitas?|broaster|wings/i.test(r)) return 'Pollo y alitas'
  if (/empanada/i.test(r)) return 'Empanadas'
  if (/ramen|thai|chino|chinese|wok|dim\s*sum/i.test(r)) return 'Asiática'
  if (/cafe|cafeteria|cafetería|coffee/i.test(r)) return 'Cafetería'
  if (/helado|heladeria|ice cream|gelato/i.test(r)) return 'Helados'
  if (/postre|dulce|torta|pasteleria|pastelería/i.test(r)) return 'Postres'
  if (/desayun|brunch|panaderia|panadería|amasanderia|amasandería/i.test(r)) return 'Desayunos'
  return null
}

/**
 * Normaliza una categoría usando el nombre del restaurante como contexto.
 * Si la categoría no tiene mapeo conocido, infiere desde el tipo del restaurante.
 */
export function normalizeCategoryWithRestaurant(catName: string, restaurantName: string): string {
  const norm = normalizeCategory(catName)
  // Si ya tiene un mapeo válido, usar ese
  if (QC_CATEGORIES.has(norm)) return norm
  // Si es una categoría excluida (extras, salsas), no mapear
  if (isExcludedCategory(catName)) return norm
  // Fallback: inferir desde el tipo de restaurante
  return inferRestaurantType(restaurantName) ?? norm
}

/** Palabras clave que indican una categoría que NO es un plato del feed */
const EXCLUDED_PATTERNS = [
  /^extras?$/i,
  /adicional/i,
  /agregado/i,
  /ingrediente.?extra/i,
  /^salsas?/i,
  /salsa extra/i,
  /^accesor/i,
  /^perros?$/i,           // "PERROS" o "PERROS CALIENTES" sin ser categoría de comida real
  /agrega a tu/i,
  /arma tu/i,
  /^combos? y promo/i,
  /incluye bebida/i,
  /^shots?$/i,
  /bebidas? proteica/i,
  /^envolt/i,             // "Envolturas Extras"
  /^pa' los golos/i,
  /tus extras favorit/i,
  /koibito.*extras?/i,
]

/** Verifica si una categoría debe excluirse del feed */
export function isExcludedCategory(name: string): boolean {
  if (EXCLUDED_CATEGORIES.has(name)) return true
  const norm = CATEGORY_MAP[name]
  if (norm === 'Extras') return true
  const n = name.trim()
  for (const pattern of EXCLUDED_PATTERNS) {
    if (pattern.test(n)) return true
  }
  return false
}

/** Categorías normalizadas que son bebidas (override dishType de BD) */
const DRINK_CATEGORIES = new Set(['Cafetería'])

/** Override dishType de la BD cuando la categoría normalizada indica otra cosa */
export function inferDishType(categoriaNorm: string, dbDishType: string): string {
  if (DRINK_CATEGORIES.has(categoriaNorm)) return 'drink'
  return dbDishType
}

/** Categorías normalizadas que son desayuno */
export const BREAKFAST_CATEGORIES = new Set([
  'Desayunos', 'Cafetería', 'Amasandería',
])

/** Inferir momento del día de un plato basado en su categoría normalizada */
export type MealTime = 'desayuno' | 'almuerzo_cena'

export function inferMealTime(categoriaNorm: string): MealTime {
  if (BREAKFAST_CATEGORIES.has(categoriaNorm)) return 'desayuno'
  return 'almuerzo_cena'
}

/** Sugerir momento del día según la hora actual */
export function getSuggestedMealTime(): { mealTime: MealTime; label: string } {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return { mealTime: 'desayuno', label: 'Desayunos' }
  return { mealTime: 'almuerzo_cena', label: 'Almuerzos y cenas' }
}

/** Mapa de adyacencia — para recomendaciones de descubrimiento */
export const ADJACENT_CATEGORIES: Record<string, string[]> = {
  'Sushi': ['Ceviches', 'Thai', 'China'],
  'Ceviches': ['Sushi', 'Peruana', 'Mariscos'],
  'Hamburguesas': ['Sándwiches', 'Combos', 'Completos', 'Pollo y alitas'],
  'Sándwiches': ['Hamburguesas', 'Completos'],
  'Completos': ['Hamburguesas', 'Sándwiches'],
  'Pizzas': ['Combos', 'Hamburguesas', 'Pastas'],
  'Parrilla': ['Empanadas', 'Platos de fondo', 'Mariscos'],
  'Platos de fondo': ['Parrilla', 'Pastas', 'Peruana'],
  'Saludable': ['Ensaladas', 'Peruana', 'Bowls'],
  'Empanadas': ['Parrilla', 'Completos'],
  'Mexicana': ['Parrilla', 'Venezolana', 'Sándwiches'],
  'Venezolana': ['Mexicana', 'Sándwiches'],
  'Thai': ['China', 'India', 'Sushi'],
  'China': ['Thai', 'India', 'Sushi'],
  'India': ['Thai', 'China'],
  'Peruana': ['Ceviches', 'Platos de fondo', 'Mexicana'],
  'Pollo y alitas': ['Hamburguesas', 'Sándwiches', 'Parrilla'],
  'Asiática': ['Sushi', 'Thai', 'China', 'India'],
  'Postres': ['Cafetería', 'Desayunos'],
  'Cafetería': ['Postres', 'Desayunos'],
  'Desayunos': ['Cafetería', 'Postres'],
  'Pastas': ['Pizzas', 'Platos de fondo'],
}

/** Gradientes por categoría normalizada — fallback cuando no hay foto */
export const CATEGORY_GRADIENTS: Record<string, string> = {
  'Sushi':       'linear-gradient(135deg, #1a1a2e, #e94560)',
  'Ceviches':    'linear-gradient(135deg, #0f3460, #16c79a)',
  'Pizzas':              'linear-gradient(135deg, #b83b5e, #f08a5d)',
  'Hamburguesas':        'linear-gradient(135deg, #3d1e00, #f4a623)',
  'Completos':           'linear-gradient(135deg, #5c3d2e, #e6a157)',
  'Sándwiches':          'linear-gradient(135deg, #5c3d2e, #e6a157)',
  'Saludable':           'linear-gradient(135deg, #1b4332, #52b788)',
  'Postres':             'linear-gradient(135deg, #7b2869, #f4a9c0)',
  'Parrilla':            'linear-gradient(135deg, #2d0000, #c1121f)',
  'Platos de fondo':     'linear-gradient(135deg, #2d0000, #a4161a)',
  'Empanadas':           'linear-gradient(135deg, #6b4226, #d4a373)',
  'Mexicana':            'linear-gradient(135deg, #3d0c02, #e36414)',
  'Venezolana': 'linear-gradient(135deg, #3d0c02, #e6a157)',
  'Thai':                'linear-gradient(135deg, #4a1942, #e6a157)',
  'China':               'linear-gradient(135deg, #8b0000, #d4a373)',
  'India':               'linear-gradient(135deg, #b8860b, #e36414)',
  'Peruana':             'linear-gradient(135deg, #8b4513, #f4a623)',
  'Pollo y alitas':      'linear-gradient(135deg, #8b4513, #f08a5d)',
  'Asiática':            'linear-gradient(135deg, #1a1a2e, #d4a373)',
  'Combos':              'linear-gradient(135deg, #1b1b2f, #f4a623)',
  'Acompañamientos':     'linear-gradient(135deg, #4a4e69, #c9ada7)',
  'Cafetería':           'linear-gradient(135deg, #2b1a0e, #a67c52)',
  'Desayunos':           'linear-gradient(135deg, #4a3728, #f4a623)',
  'Pastas':              'linear-gradient(135deg, #6b4226, #e6a157)',
}

export const DEFAULT_GRADIENT = 'linear-gradient(135deg, #1a1a2e, #f4a623)'

export function getCategoryGradient(categoriaNorm: string): string {
  return CATEGORY_GRADIENTS[categoriaNorm] ?? DEFAULT_GRADIENT
}

/** Categorías del feed para los chips de UI */
export type DisplayCategory = {
  icon: string
  label: string
  norm: string
}

export function getDisplayCategories(): DisplayCategory[] {
  return [
    { icon: '🍔', label: 'Hamburguesas', norm: 'Hamburguesas' },
    { icon: '🍕', label: 'Pizzas', norm: 'Pizzas' },
    { icon: '🍣', label: 'Sushi', norm: 'Sushi' },
    { icon: '🌮', label: 'Mexicana', norm: 'Mexicana' },
    { icon: '🍛', label: 'Peruana', norm: 'Peruana' },
    { icon: '🇹🇭', label: 'Thai', norm: 'Thai' },
    { icon: '🥡', label: 'China', norm: 'China' },
    { icon: '🍛', label: 'India', norm: 'India' },
    { icon: '🥩', label: 'Parrilla', norm: 'Parrilla' },
    { icon: '🐟', label: 'Ceviches', norm: 'Ceviches' },
    { icon: '🍗', label: 'Pollo', norm: 'Pollo y alitas' },
    { icon: '🥪', label: 'Sándwiches', norm: 'Sándwiches' },
    { icon: '🥗', label: 'Saludable', norm: 'Saludable' },
    { icon: '🍰', label: 'Postres', norm: 'Postres' },
    { icon: '🍦', label: 'Helados', norm: 'Helados' },
  ]
}

// ─── Taxonomía de cocinas ─────────────────────────────────────────────────────
// Cocinas son una segunda dimensión independiente del tipo de plato (leaf).
// Un "Pollo Salteado" puede ser leaf="Pollo y alitas" + cuisineTag="Peruana".

/** Cocinas que se detectan como segunda dimensión (no reemplazan el leaf del plato) */
export const CUISINE_TAGS = new Set([
  'Peruana', 'China', 'Thai', 'India', 'Japonesa', 'Italiana', 'Griega',
])

const CUISINE_DETECT_PATTERNS: Array<{ pattern: RegExp; cuisine: string }> = [
  { pattern: /\bperuana?s?\b|\bperuano\b/i,        cuisine: 'Peruana' },
  { pattern: /\bchina?s?\b|\bchinos?\b/i,          cuisine: 'China' },
  { pattern: /\bthai\b|\btailand[eé]/i,            cuisine: 'Thai' },
  { pattern: /\bindias?\b|\bindio\b/i,              cuisine: 'India' },
  { pattern: /\bjaponesa?s?\b|\bjapon[eé]s\b/i,   cuisine: 'Japonesa' },
  { pattern: /\bitaliana?s?\b|\bitaliano\b/i,       cuisine: 'Italiana' },
  { pattern: /\bgriega?s?\b|\bgriego\b/i,          cuisine: 'Griega' },
]

/**
 * Detecta si el nombre de una categoría implica una cocina específica.
 * Usado para setear Category.cuisineTag en el pipeline de importación.
 */
export function detectCuisineTag(catName: string): string | null {
  for (const { pattern, cuisine } of CUISINE_DETECT_PATTERNS) {
    if (pattern.test(catName)) return cuisine
  }
  return null
}

/**
 * Infiere la primaryCategory de un restaurante desde sus categorías.
 * Prioriza cuisineTags sobre inferencia por nombre de categoría.
 * Retorna el QC leaf más representativo, o null si no puede inferir.
 */
export function inferPrimaryCategory(
  categories: { name: string; cuisineTag?: string | null; dishType: string; dishCount?: number }[]
): string | null {
  // Ignorar categorías de bebidas y postres — no definen la cocina del local
  const foodCats = categories.filter(c => c.dishType !== 'drink' && c.dishType !== 'dessert')
  if (foodCats.length === 0) return null

  // Cada categoría de comida vota por su leaf:
  // cuisineTag (explícito) > detectCuisineTag (por nombre) > normalizeCategory (como fallback)
  // Se excluyen "Entradas" y "Sin categoría" — no son identidad del restaurante
  const EXCLUDED = new Set(['Entradas', 'Sin categoría'])
  const votes: Record<string, number> = {}
  for (const cat of foodCats) {
    const tag = cat.cuisineTag ?? detectCuisineTag(cat.name) ?? normalizeCategory(cat.name)
    if (!tag || !QC_LEAVES.has(tag) || EXCLUDED.has(tag)) continue
    const weight = cat.dishCount ?? 1
    votes[tag] = (votes[tag] ?? 0) + weight
  }

  const winner = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]
  return winner?.[0] ?? null
}

// ─── Auto-detección de flavorTags ────────────────────────────────────────────
// Solo detecta PREPARACIONES y TÉCNICAS de cocina (no ingredientes — esos van en Ingredient).
// Se usa en el pipeline de importación para el futuro sistema de preferencias.

export function inferFlavorTags(name: string, _categoryName: string, description: string | null): string[] {
  // Solo usamos el NOMBRE del plato para preparaciones — la descripción tiene complementos
  // (ej: "papas fritas" como acompañamiento no implica que el plato principal sea frito)
  const text = name.toLowerCase()
  const fullText = (name + ' ' + (description ?? '')).toLowerCase()
  const tags: string[] = []

  // ── Picante: detectado en nombre O descripción ───────────────────────────────
  if (/spicy|salsa\s+spicy|\bají\b|\bpicante\b|\bchipotle\b|\bjalapeño\b|\bsriracha\b/.test(fullText))
    tags.push('picante')

  // ── Dulce: salsas dulces ─────────────────────────────────────────────────────
  if (/salsa\s+(dulce|unagi|teriyaki)\b|unagi/.test(fullText))
    tags.push('dulce')

  // ── Preparaciones ───────────────────────────────────────────────────────────
  if (/\bpanko\b/.test(text))                               tags.push('panko')
  if (/\btempura\b/.test(text))                             tags.push('tempura')
  if (/\bfrit[ao]s?\b/.test(text))                          tags.push('frito')
  if (/\bgrill(ado|ed)?\b/.test(text))                      tags.push('grillado')
  if (/\bplancha\b/.test(text))                             tags.push('a la plancha')
  if (/\bal\s+vapor\b/.test(text))                          tags.push('al vapor')
  if (/\bhorneado\b/.test(text))                            tags.push('horneado')
  if (/\bgratinado\b/.test(text))                           tags.push('gratinado')
  if (/\bahumado\b/.test(text))                             tags.push('ahumado')
  if (/\bcrudo\b/.test(text))                               tags.push('crudo')
  if (/\bsalteado\b/.test(text))                            tags.push('salteado')
  if (/\brebozado\b/.test(text))                            tags.push('rebozado')
  if (/\bteriyaki\b/.test(text))                            tags.push('teriyaki')
  if (/\bcurry\b/.test(text))                               tags.push('curry')

  // ── Ingredientes principales ─────────────────────────────────────────────────
  if (/\bpollo\b|\bpechuga\b|\bmuslo\b|\balitas?\b|\bwings?\b|\bnuggets?\b|\btenders?\b|\bbroaster\b|\bkaraage\b/.test(text))
    tags.push('pollo')
  if (/\bcarne\b|\bvacuno\b|\bbistec\b|\bbife\b|\bcostill|\bplateada\b|\bmechada\b|\blomo\s+saltado\b|\basado\s+de\s+tira\b/.test(text))
    tags.push('carne')
  if (/\bpescado\b|\bmerluza\b|\breineta\b|\bcongrio\b|\bcorvina\b|\btrucha\b|\bsalm[oó]n\b|\bat[uú]n\b|\blenguado\b|\bcojinova\b|\btilapia\b/.test(text))
    tags.push('pescado')

  return tags
}

/**
 * Orden de prioridad de tipos de plato para UI y scoring.
 * El tipo que describe la FORMA del plato (hamburguesa, empanada, pizza…)
 * tiene mayor prioridad que ingredientes o contextos (combo, papas fritas…).
 */
export const DISH_TYPE_PRIORITY: string[] = [
  'sushi','pizza','hamburguesa','empanada','pasta','taco','ramen','gyoza',
  'sándwich','completo','arepa','causa','ceviche','tiradito','chorrillana',
  'pastel de jaiba','pastel de choclo','lomo a lo pobre','lomo saltado','ají de gallina',
  'sopaipilla','chupe','cazuela','sopa','bowl','ensalada','waffle','pancake','crepe','omelet',
  'torta','helado','brownie','cheesecake','churros','muffin','galleta','donut','flan',
  'churrasco','mechada','as','wrap','bagel','croissant','tostada',
  'bao','dumpling','mandu','wantan','kimbap','hand roll','sushiburger',
  'arroz con leche','burrito','quesadilla','nachos','spring roll','arrollado de primavera',
  'lasagna','risotto','fideos','arroz','calzone','quiche',
  'chapsui','pad thai','curry','satay','anticucho','kebab',
  'pollo asado','pollo frito','tenders','alitas','nuggets',
  'asado','costillas','pernil','milanesa','salchipapa',
  'café','latte','cappuccino','mocaccino','chocolate caliente','té','jugo','batido','bebida','alcohol','mocktail',
  'papas fritas','aros de cebolla','croquetas',
  'combo','extra',
]

/**
 * Mapa de tipo de plato → familia amplia.
 * Usado en swipe scoring: el tipo primario acumula 3x, la familia 1x.
 * Así un swipe de "torta" amplía el feed hacia postres, pero dos swipes de
 * "torta" ya hacen que torta domine sobre el resto de la familia.
 */
export const DISH_TYPE_TO_PARENT: Record<string, string> = {
  // Postres
  torta: 'postre', helado: 'postre', brownie: 'postre', cheesecake: 'postre',
  churros: 'postre', muffin: 'postre', galleta: 'postre', donut: 'postre',
  flan: 'postre', 'arroz con leche': 'postre',
  // Desayuno
  waffle: 'desayuno', pancake: 'desayuno', crepe: 'desayuno', omelet: 'desayuno',
  tostada: 'desayuno', croissant: 'desayuno', bagel: 'desayuno',
  // Japonés
  sushi: 'japonés', ramen: 'japonés', gyoza: 'japonés', bao: 'japonés',
  dumpling: 'japonés', mandu: 'japonés', wantan: 'japonés',
  kimbap: 'japonés', 'hand roll': 'japonés', sushiburger: 'japonés',
  // Peruano
  ceviche: 'peruano', tiradito: 'peruano', causa: 'peruano',
  'lomo saltado': 'peruano', 'ají de gallina': 'peruano',
  'lomo a lo pobre': 'peruano', anticucho: 'peruano', chupe: 'peruano',
  // Chileno
  completo: 'chileno', chorrillana: 'chileno', sopaipilla: 'chileno',
  'pastel de jaiba': 'chileno', 'pastel de choclo': 'chileno', cazuela: 'chileno',
  // Sándwich
  sándwich: 'sándwich', churrasco: 'sándwich', mechada: 'sándwich',
  as: 'sándwich', wrap: 'sándwich',
  // Pasta / italiana
  pasta: 'pasta', lasagna: 'pasta', risotto: 'pasta', calzone: 'pasta',
  // Pollo
  'pollo asado': 'pollo', 'pollo frito': 'pollo', tenders: 'pollo',
  alitas: 'pollo', nuggets: 'pollo',
  // Parrilla / carne
  asado: 'parrilla', costillas: 'parrilla', pernil: 'parrilla', milanesa: 'parrilla',
  // Saludable
  bowl: 'saludable', ensalada: 'saludable',
  // Mexicano
  taco: 'mexicano', nachos: 'mexicano', quesadilla: 'mexicano', burrito: 'mexicano',
  // Sopa
  sopa: 'sopa',
}

/** Devuelve el tipo de plato de mayor prioridad (la "forma" del plato). */
export function getPrimaryDishType(types: string[], fallback: string): string {
  if (!types || types.length === 0) return fallback
  const sorted = [...types].sort((a, b) => {
    const ia = DISH_TYPE_PRIORITY.indexOf(a)
    const ib = DISH_TYPE_PRIORITY.indexOf(b)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })
  return sorted[0]
}
