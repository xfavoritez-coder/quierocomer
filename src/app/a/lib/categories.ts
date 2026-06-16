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
  'Pepitos': 'Sándwiches',

  // ─── Saludable (ensaladas, vegano) ────────────────────────
  'Ensaladas': 'Saludable',
  'Ensalada': 'Saludable',
  'Cremas y Ensaladas': 'Saludable',
  'Antojos Salados - Ensaladas': 'Saludable',
  '100% Vegano': 'Saludable',
  'Aperitivos 100% Veganos': 'Saludable',

  // ─── Entradas ───────────────────────────────────────────────
  'Entradas': 'Entradas',
  'Entrada': 'Entradas',
  'Entradas Frías': 'Entradas',
  'Entradas para compartir': 'Entradas',
  'Para Comenzar': 'Entradas',
  'Aperitivos': 'Entradas',
  'Para Compartir': 'Entradas',
  'Para compartir': 'Entradas',
  'PARA COMPARTIR': 'Entradas',
  'Pa Partir': 'Entradas',
  'Tablas Para Compartir': 'Entradas',
  'Picoteos': 'Entradas',
  'Piqueos': 'Entradas',
  'Antipasti': 'Entradas',
  'Gyosas y más': 'Entradas',

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
  'Arepas': 'Arepas & Venezolana',

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
  'Ice Cream': 'Postres',
  'HELADOS ARTESANALES': 'Postres',
  'HELADOS SIN AZÚCAR': 'Postres',
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
  'Acompañamientos': 'Acompañamientos',
  'Papas Fritas': 'Acompañamientos',
  'Guarniciones': 'Acompañamientos',
  'Fritas': 'Acompañamientos',
  'Salchipapa': 'Acompañamientos',
  'POP CORN': 'Acompañamientos',
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

  // Entradas (variantes)
  'Entradas Calientes': 'Entradas',
  'ENTRADAS CALIENTES': 'Entradas',
  'ENTRADAS': 'Entradas',
  'PARA COMENZAR': 'Entradas',
  'Antipastos Italianos': 'Entradas',
  'Anti pasti': 'Entradas',
  'Snack': 'Entradas',

  // Empanadas
  'Empanadas Clásicas': 'Empanadas',
  'Empanadas venezolanas': 'Empanadas',

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
  'Pa\' Comenzar': 'Entradas',
  'Pa\' Compartir': 'Entradas',
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
  'Gelateria': 'Postres',
  'Helados': 'Postres',
  'POSTRES Y HELADOS': 'Postres',
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

/** Categorías canónicas válidas del feed de QC */
export const QC_CATEGORIES = new Set([
  'Sushi', 'Pizzas', 'Hamburguesas', 'Sándwiches', 'Completos',
  'Parrilla', 'Pollo', 'Pastas', 'Peruana', 'Ceviches', 'Mariscos',
  'Mexicana', 'Asiática', 'China', 'Thai', 'India', 'Empanadas', 'Saludable', 'Postres',
  'Desayunos', 'Cafetería', 'Amasandería',
])

/** Devuelve true si el nombre es una categoría canónica válida de QC */
export function isValidQcCategory(name: string): boolean {
  return QC_CATEGORIES.has(name)
}

/** Solo se excluyen extras/salsas (no son platos ni bebidas reales) */
export const EXCLUDED_CATEGORIES = new Set([
  'Extras', 'Adicionales', 'Salsa Extra', 'Salsas', 'Salsas y Extras',
  'AGREGA A TU SANDWICH',
])

/** Normaliza una categoría de la BD. Si no está en el mapa, usa el nombre original. */
// Reglas por patrón para variantes que no vale la pena listar una a una
// (tamaños de pizza, formatos de sándwich, etc.)
const CATEGORY_PATTERNS: Array<{ pattern: RegExp; norm: string }> = [
  // Pizza + cualquier tamaño/variante: "Pizza XL", "Pizza Familiar", "Pizza Mediana"...
  { pattern: /^pizzas?\b/i, norm: 'Pizzas' },
  // Hamburguesa singular o con apellido: "Hamburguesa Clásica", "Hamburguesa Gourmet"...
  { pattern: /^hamburguesa\b/i, norm: 'Hamburguesas' },
  // Sándwich singular o variantes: "Sandwich de Pollo", "Sándwich Caliente"...
  { pattern: /^s[aá]ndwich\b/i, norm: 'Sándwiches' },
  // Empanada singular: "Empanada de Pino", "Empanada Frita"...
  { pattern: /^empanada\b/i, norm: 'Empanadas' },
  // Breadsticks, palitos de ajo y similares → Entradas
  { pattern: /^breadstick|palitos?\s+de\s+(ajo|pan|queso)/i, norm: 'Entradas' },
  // "Entrada " + cualquier cosa: "Entrada Caliente", "Entrada Vegetariana"...
  { pattern: /^entrada\b/i, norm: 'Entradas' },
  // Completo singular: "Completo Italiano", "Completo Dinámico"...
  { pattern: /^completo\b/i, norm: 'Completos' },
]

export function normalizeCategory(name: string): string {
  if (CATEGORY_MAP[name]) return CATEGORY_MAP[name]
  const n = name.trim()
  for (const { pattern, norm } of CATEGORY_PATTERNS) {
    if (pattern.test(n)) return norm
  }
  return name
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
  'Ceviches': ['Sushi', 'Peruana', 'Entradas'],
  'Hamburguesas': ['Sándwiches', 'Combos', 'Completos', 'Pollo y alitas'],
  'Sándwiches': ['Hamburguesas', 'Completos'],
  'Completos': ['Hamburguesas', 'Sándwiches'],
  'Pizzas': ['Combos', 'Hamburguesas', 'Pastas'],
  'Parrilla': ['Entradas', 'Empanadas', 'Platos de fondo'],
  'Platos de fondo': ['Parrilla', 'Pastas', 'Peruana'],
  'Entradas': ['Ceviches', 'Saludable'],
  'Saludable': ['Entradas', 'Peruana'],
  'Empanadas': ['Parrilla', 'Entradas'],
  'Mexicana': ['Entradas', 'Parrilla', 'Arepas & Venezolana'],
  'Arepas & Venezolana': ['Mexicana', 'Sándwiches'],
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
  'Entradas':            'linear-gradient(135deg, #3a0ca3, #f72585)',
  'Postres':             'linear-gradient(135deg, #7b2869, #f4a9c0)',
  'Parrilla':            'linear-gradient(135deg, #2d0000, #c1121f)',
  'Platos de fondo':     'linear-gradient(135deg, #2d0000, #a4161a)',
  'Empanadas':           'linear-gradient(135deg, #6b4226, #d4a373)',
  'Mexicana':            'linear-gradient(135deg, #3d0c02, #e36414)',
  'Arepas & Venezolana': 'linear-gradient(135deg, #3d0c02, #e6a157)',
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
  ]
}
