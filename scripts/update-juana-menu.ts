import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const RESTAURANT_ID = "cmoaphtgc0001enb4rsa2c5v9";

// ─── Normalize for comparison ─────────────────────────────────────────
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

// ─── Fuzzy match known renames ────────────────────────────────────────
const KNOWN_RENAMES: Record<string, string> = {
  "chiken street": "chicken street",
  "ceviche nikkei": "ceviche",
  "chicken white roll": "chicken white",
};

function matchName(existingName: string, newName: string): boolean {
  const a = normalize(existingName);
  const b = normalize(newName);
  if (a === b) return true;
  // Check known renames
  if (KNOWN_RENAMES[a] === b) return true;
  if (KNOWN_RENAMES[b] === a) return true;
  return false;
}

// ─── Category definitions ─────────────────────────────────────────────
interface CategoryDef {
  name: string;
  position: number;
  description?: string;
  dishType?: string;
}

const CATEGORIES: CategoryDef[] = [
  { name: "Para compartir", position: 0 },
  { name: "Tablas de sushi", position: 1 },
  { name: "Sushi de autor / Rolls Nikkei", position: 2 },
  { name: "Rolls Sin Arroz", position: 3 },
  { name: "Rolls Tempura", position: 4 },
  { name: "Rolls Acevichados", position: 5 },
  { name: "Avocado / Sake", position: 6, description: "Elige tu roll con envoltura de palta o salmón" },
  { name: "Pizza", position: 7 },
  { name: "Fritas", position: 8 },
  { name: "Platos principales", position: 9 },
  { name: "Salsas", position: 10 },
  { name: "Coctelería de autor", position: 11, dishType: "drink" },
  { name: "Promos", position: 12, dishType: "drink" },
  { name: "Cervezas", position: 13, dishType: "drink" },
  { name: "Coctelería clásica", position: 14, dishType: "drink" },
  { name: "Botellas", position: 15, dishType: "drink" },
  { name: "Mocktails", position: 16, dishType: "drink" },
  { name: "Bebestibles", position: 17, dishType: "drink" },
  { name: "Postres", position: 18, dishType: "dessert" },
];

// ─── Dish definitions ─────────────────────────────────────────────────
interface DishDef {
  name: string;
  price: number;
  description: string | null;
  categoryName: string;
}

const DISHES: DishDef[] = [
  // Para compartir
  { categoryName: "Para compartir", name: "Plátano dinamita", price: 8990, description: "Finas líneas de plátano relleno con dinamita de la casa —nuestra proteína especial— decorado con salsa Fuji, salsa teriyaki y lluvia de ciboulette." },
  { categoryName: "Para compartir", name: "Chicken Street", price: 7990, description: "Pollo coreano crocante bañado en salsa agridulce Hot Flame o BBQ. Jugoso por dentro, crujiente por fuera. Ideal para compartir." },
  { categoryName: "Para compartir", name: "Dumpling", price: 8990, description: "Elige tu dumpling con relleno de camarón o cerdo. Hechos a mano, jugosos y llenos de sabor. Dorados en la base, acompañados de salsa de la casa." },
  { categoryName: "Para compartir", name: "Empanaditas mechada queso", price: 8990, description: "3 empanaditas hechas a mano, doradas y crujientes, rellenas de mechada con queso derretido. Acompañadas de guacamole." },
  { categoryName: "Para compartir", name: "Bao pulled pork", price: 4990, description: "Suave masa al vapor rellena con zanahoria, cilantro, pepino encurtido, maní y salsa ácida." },
  { categoryName: "Para compartir", name: "Bao Chicken Street", price: 4900, description: "Suave masa al vapor rellena con salsa ácida, pollo frito adobado en salsa hot flame, encurtido, lechuga, cebolla morada, zanahoria." },
  { categoryName: "Para compartir", name: "Nigiri Salmón Acevichado", price: 6990, description: "Nigiris de salmón con salsa acevichada y ciboulette. (4 unidades)" },
  { categoryName: "Para compartir", name: "Sashimi", price: 7990, description: "5 cortes de salmón fresco." },

  // Tablas de sushi
  { categoryName: "Tablas de sushi", name: "Tabla de sushi para 2", price: 32990, description: "10 bocados de tempura acevichado, 10 bocados de tori palta, 5 dumplings de camarón o cerdo, 4 nigiris acevichados." },
  { categoryName: "Tablas de sushi", name: "Tabla de sushi para 4", price: 49990, description: "10 bocados de tempura acevichado, 10 bocados de tori palta, 10 bocados de ebi acevichado, 10 bocados de protein roll, 4 cortes de sashimi, 5 arrollados de primavera, 4 nigiris acevichado." },

  // Sushi de autor / Rolls Nikkei
  { categoryName: "Sushi de autor / Rolls Nikkei", name: "La corona de Juana", price: 10990, description: "Envuelto en tempura crocante, relleno de dinamita, queso crema y palta. Coronado con camarón tempurizado, bañado en salsa mostaza miel, teriyaki y ciboulette fresco." },
  { categoryName: "Sushi de autor / Rolls Nikkei", name: "Plátano caribeño", price: 10990, description: "Envuelto en plátano caribeño, relleno con pollo teriyaki, queso crema, cebollín en salsa spicy mayo con teriyaki y lluvia de ciboulette." },
  { categoryName: "Sushi de autor / Rolls Nikkei", name: "Flama Roll", price: 10990, description: "Envuelto en salmón flambeado, relleno con camarón apanado, palta y cilantro. Coronado con salsa yum yum y cebolla crispy." },
  { categoryName: "Sushi de autor / Rolls Nikkei", name: "Tartar Roll", price: 10990, description: "Envuelto en sésamo tostado, relleno con camarón apanado y palta, coronado con un fresco tartar de salmón." },
  { categoryName: "Sushi de autor / Rolls Nikkei", name: "Tempura Tuna Nikkei", price: 9990, description: "Envuelto en salmón apanado, relleno con atún, queso crema, cebollín. Coronado con topping de atún acevichado y camote hilo." },
  { categoryName: "Sushi de autor / Rolls Nikkei", name: "Chicken White", price: 6990, description: "Envuelto en queso crema, relleno con pollo teriyaki, palta, cebollín. Coronado con salsa teriyaki y papas hilo." },

  // Rolls Sin Arroz
  { categoryName: "Rolls Sin Arroz", name: "Protein Roll", price: 10990, description: "Envoltura de panko crocante relleno con camarón, salmón y palta. Coronado en acevichado de salmón." },
  { categoryName: "Rolls Sin Arroz", name: "Fuki Tempura", price: 9990, description: "Envoltura de panko crocante relleno con pollo furai, palta, queso crema y cebollín, bañado en salsa Fuji." },
  { categoryName: "Rolls Sin Arroz", name: "Kobu Nikkei (Keto)", price: 10990, description: "Roll Keto, envuelto en palta relleno con camarón, champiñón, queso crema, palta y cebollín. Cubierto con acevichado de salmón." },

  // Rolls Tempura
  { categoryName: "Rolls Tempura", name: "Tori Hot", price: 8990, description: "Envoltura de panko crocante relleno con pollo teriyaki, queso crema y cebollín." },
  { categoryName: "Rolls Tempura", name: "Ebi Panko", price: 8990, description: "Envoltura de panko crocante relleno con camarón, queso crema y ciboulette." },
  { categoryName: "Rolls Tempura", name: "Sake Hot", price: 8990, description: "Envoltura de panko crocante relleno con salmón, queso crema y cebollín." },

  // Rolls Acevichados
  { categoryName: "Rolls Acevichados", name: "Tempura Acevichado", price: 10990, description: "Envoltura de panko crocante relleno con camarón furai, queso crema y palta. Coronado en acevichado de salmón y ciboulette." },
  { categoryName: "Rolls Acevichados", name: "Ebi Acevichado", price: 8990, description: "Envoltura de palta relleno con camarón furai, queso crema y ciboulette acompañada de salsa acevichada." },

  // Avocado / Sake
  { categoryName: "Avocado / Sake", name: "Tori Palta", price: 8990, description: "Elige la envoltura en palta o salmón. Relleno con pollo teriyaki, queso crema y ciboulette." },
  { categoryName: "Avocado / Sake", name: "Avocado", price: 8990, description: "Elige la envoltura en palta o salmón. Relleno con salmón, queso crema, palta y ciboulette." },

  // Pizza
  { categoryName: "Pizza", name: "Camarón que se Duerme", price: 15990, description: "Salsa de tomate, queso mozzarella, camarón, cebollín y queso crema." },
  { categoryName: "Pizza", name: "Me haces palta", price: 15990, description: "Salsa de tomate, queso mozzarella, carne mechada y palta." },
  { categoryName: "Pizza", name: "Locura de Juana", price: 15990, description: "Salsa de tomate, queso mozzarella, jamón serrano, cebolla caramelizada y palta." },
  { categoryName: "Pizza", name: "Carnívora Enjaulada", price: 15990, description: "Salsa de tomate, queso mozzarella, carne mechada, pepperoni y tocino." },
  { categoryName: "Pizza", name: "Pesto margarita", price: 13990, description: "Salsa de tomate, queso mozzarella, tomate cherry, albahaca fresca y pesto de albahaca de la casa." },
  { categoryName: "Pizza", name: "Pal Monte", price: 15990, description: "Salsa de tomate, queso mozzarella, jamón serrano, tomate cherry y rúcula." },
  { categoryName: "Pizza", name: "Sueño Veggie", price: 14990, description: "Salsa de tomate, queso mozzarella, champiñón, choclo, tomate cherry y cebolla caramelizada." },
  { categoryName: "Pizza", name: "Arma tu pizza", price: 8990, description: "Elige tus ingredientes. Clásicos: $1.290. Premium: $1.990. Vip: $2.490." },

  // Fritas
  { categoryName: "Fritas", name: "Papas Fritas Clásicas 1/2", price: 7990, description: "Las clásicas papitas artesanales." },
  { categoryName: "Fritas", name: "Papas Fritas Supreme para 2", price: 14990, description: "1/2 Kg Papas fritas artesanales, con tocino, tomate cherry, crema ácida, salsa cheddar y ciboulette." },
  { categoryName: "Fritas", name: "Papas Fritas Camarón para 2", price: 14990, description: "1/2 kilo de papas fritas artesanales con camarones frescos, queso cheddar, crema ácida y ciboulette." },
  { categoryName: "Fritas", name: "Papas Palta Mechada para 2", price: 14990, description: "1/2 kg Papas fritas artesanales con carne mechada, palta, salsa de queso cheddar y cebolla caramelizada." },
  { categoryName: "Fritas", name: "Papas Fritas Chingonas para 2", price: 14990, description: "½ kg de papas fritas artesanales con carne mechada, guacamole, tomate cherry, salsa de cilantro y limón de pica." },
  { categoryName: "Fritas", name: "Papas fritas Supreme XL", price: 19990, description: "1 kg Papas fritas artesanales, con tocino, tomate cherry, crema ácida, salsa cheddar y ciboulette. (Para 3-4 personas)" },
  { categoryName: "Fritas", name: "Papas fritas Palta Mechada XL", price: 22990, description: "1 kg Papas fritas con carne mechada, palta, salsa de queso cheddar y cebolla caramelizada. (Para 3-4 personas)" },
  { categoryName: "Fritas", name: "Papas Fritas Chingonas XL", price: 22990, description: "1 kg de papas fritas con carne mechada, guacamole, tomate cherry, salsa de cilantro y limón de pica. (Para 3-4 personas)" },

  // Platos principales
  { categoryName: "Platos principales", name: "Padthai", price: 6990, description: "Fideos de arroz salteados en wok con salsa de tamarindo, ostras y pescado. Huevo, verduras frescas, brotes, cebollín, zanahoria y maní. +Pollo $2.000, +Camarón $2.500." },
  { categoryName: "Platos principales", name: "Ceviche", price: 15990, description: "Salmón, atún y camarones en cubos, marinados en leche de tigre nikkei con cebolla morada, coronado con palta cremosa." },
  { categoryName: "Platos principales", name: "Gohan Protein", price: 10990, description: "Camarón, salmón, champiñón tempura, maíz cancha, queso crema, palta y sésamo." },
  { categoryName: "Platos principales", name: "Gohan Goku", price: 9990, description: "Pollo teriyaki, queso crema, palta, choclo, papa hilo y cebollín coronado con mix de sésamo." },
  { categoryName: "Platos principales", name: "Gohan Kame House", price: 10990, description: "Salmón, queso crema, cebollín, palta y maíz cancha coronado en mix de sésamo + cup acevichado." },
  { categoryName: "Platos principales", name: "Ramen de cerdo", price: 12990, description: "Exquisito caldo de huesos de cerdo y verduras, acompañados de tallarines caseros, con huevo, ciboulette y filete de cerdo." },

  // Salsas
  { categoryName: "Salsas", name: "Salsa Teriyaki", price: 1500, description: null },
  { categoryName: "Salsas", name: "Salsa Acevichada", price: 1500, description: null },
  { categoryName: "Salsas", name: "Salsa Hot flame", price: 1500, description: null },
  { categoryName: "Salsas", name: "Topping Ceviche", price: 1990, description: null },

  // Coctelería de autor
  { categoryName: "Coctelería de autor", name: "Encanto Rosa", price: 7990, description: "Un cóctel suave y seductor, donde el ron y la crema de coco se mezclan con la dulzura de la frambuesa y el azúcar." },
  { categoryName: "Coctelería de autor", name: "Juana Tropical", price: 6990, description: "Creación tropical con Ron Bacardí blanco, crema de coco, mango y maracuyá natural." },
  { categoryName: "Coctelería de autor", name: "Loro Loco", price: 7990, description: "Cóctel vibrante con tequila, jugo de pomelo y limón, combinado con maracuyá y tomillo. Espuma dorada de cerveza Golden." },
  { categoryName: "Coctelería de autor", name: "Sexy Juana", price: 7990, description: "Cóctel refrescante con vodka, frambuesa, limón y maracuyá, con triple sec y espumante." },
  { categoryName: "Coctelería de autor", name: "Marea Alta", price: 7990, description: "Ola de sabores tropicales con ron blanco y negro, crema de coco, limón, maracuyá, mango y curacao." },
  { categoryName: "Coctelería de autor", name: "Naranja Mecánica Sour", price: 7990, description: "Cóctel con gin y Aperol fusionados con limón y goma de romero." },
  { categoryName: "Coctelería de autor", name: "Vuelta la Manzana", price: 7990, description: "Cóctel con Jack de manzana, limón y goma. Espumante y hielo frappé." },
  { categoryName: "Coctelería de autor", name: "Maracazzotti", price: 8990, description: "Ramazzotti, maracuyá y Sprite en un trago fresco y tropical." },

  // Promos
  { categoryName: "Promos", name: "Promo Red Bull + Pisco alto 35°", price: 10990, description: "Dos cortos de Alto de Carmen de 35° + 1 bebida de 350cc + una Red Bull de 250cc." },
  { categoryName: "Promos", name: "Promo 2 Piscola 35°", price: 8990, description: "2 cortos de Pisco Alto del Carmen 35° + 2 Bebidas 220cc." },
  { categoryName: "Promos", name: "Promo 2 Mistral 40°", price: 9990, description: "2 piscolas de Mistral de 40° + 2 Bebidas de 220cc." },
  { categoryName: "Promos", name: "Promo 2 Fernet", price: 8990, description: "2 cortos de Fernet Branca + 1 Bebida de 350cc a elección." },
  { categoryName: "Promos", name: "Promo Ron Habana", price: 8990, description: "2 cortos de Ron Habana Club Añejo Reserva 40° + Bebida 350cc a elección." },
  { categoryName: "Promos", name: "Promo Whisky Clásico", price: 11990, description: "2 cortos de Whisky Jack Daniel's Negro + 1 Bebida de 350cc a elección." },
  { categoryName: "Promos", name: "Jarra de sangría", price: 16990, description: "Para compartir: fresca, frutal y perfecta para la mesa. Ideal para grupos." },

  // Cervezas
  { categoryName: "Cervezas", name: "Schop LOA Otra Ronda", price: 5490, description: "Amber Ale de color cobrizo brillante, con cuerpo y sabor a caramelo, toffee y pan tostado." },
  { categoryName: "Cervezas", name: "Schop LOA entre nubes", price: 5490, description: "Lager suave y refrescante con sabor equilibrado." },
  { categoryName: "Cervezas", name: "Flor De Truco", price: 6290, description: "Estilo moderno hiperlupulado con aromas a piña, mango y maracuyá." },
  { categoryName: "Cervezas", name: "Minga loca Ipa", price: 5690, description: "Cerveza dorada con combinación de lúpulos, amargor y aromas cítricos y frutales." },
  { categoryName: "Cervezas", name: "Michelada", price: 1500, description: "Haz tus cervezas chelada o michelada." },
  { categoryName: "Cervezas", name: "Austral Calafate", price: 4290, description: "Botella 330cc cerveza austral calafate." },
  { categoryName: "Cervezas", name: "Kunstman Torobayo", price: 4290, description: "Botella 330cc de kunstman torobayo." },
  { categoryName: "Cervezas", name: "Corona", price: 3990, description: "Botella 355cc cerveza corona." },
  { categoryName: "Cervezas", name: "Heineken", price: 3990, description: "Botella 350cc cerveza heineken." },
  { categoryName: "Cervezas", name: "Heineken Zero", price: 3990, description: "Botella de Cerveza sin Alcohol de 330cc." },

  // Coctelería clásica
  { categoryName: "Coctelería clásica", name: "Mojito tradicional", price: 7490, description: "Clásico refrescante con Ron de Caldas, menta fresca, limón y soda." },
  { categoryName: "Coctelería clásica", name: "Mojito Raspberry", price: 7990, description: "Bacardí Razz, menta fresca y limón, con frutos rojos." },
  { categoryName: "Coctelería clásica", name: "Mojito Jagger", price: 7990, description: "Jägermeister, menta fresca y limón. Intenso, herbal." },
  { categoryName: "Coctelería clásica", name: "Mojito Sabores", price: 7990, description: "Elige tu sabor: frambuesa, mango o maracuyá. Ron blanco, menta y limón." },
  { categoryName: "Coctelería clásica", name: "Mojito Corona", price: 8490, description: "Mojito con el toque burbujeante de Corona." },
  { categoryName: "Coctelería clásica", name: "Daiquiri sabores", price: 7990, description: "Con Maracuyá, Frambuesa o Mango. Ron Bacardi blanco, limón, fruta natural. Frappé." },
  { categoryName: "Coctelería clásica", name: "Espresso Martini", price: 7990, description: "Vodka, licor de café y espresso." },
  { categoryName: "Coctelería clásica", name: "Ramazzotti", price: 6990, description: "Refrescante, burbujeante y con un toque herbal." },
  { categoryName: "Coctelería clásica", name: "Aperol spritz", price: 6990, description: "Fresco, burbujeante y fácil de tomar." },
  { categoryName: "Coctelería clásica", name: "Gin Berries Bull", price: 8990, description: "Gin, frutos rojos, Red Bull acai, hielo y limón de pica." },
  { categoryName: "Coctelería clásica", name: "Tropical Gin", price: 8990, description: "Red Bull tropical, Gin y pulpa de maracuyá." },
  { categoryName: "Coctelería clásica", name: "Gin Hendricks", price: 7990, description: "Gin Hendricks con tónica y pepino." },
  { categoryName: "Coctelería clásica", name: "Copa de sangría", price: 5990, description: "Vino tinto con frutas de la estación." },
  { categoryName: "Coctelería clásica", name: "Sour catedral peruano", price: 7990, description: "Pisco Tabernero Quebranta." },
  { categoryName: "Coctelería clásica", name: "Pisco Sour Nacional", price: 4990, description: "Fresco, cítrico. Hazlo de maracuyá +$1.000." },
  { categoryName: "Coctelería clásica", name: "Piña Colada", price: 7490, description: "Cremosa, dulce y refrescante." },
  { categoryName: "Coctelería clásica", name: "Margarita", price: 6990, description: "Clásica, fresca y cítrica." },
  { categoryName: "Coctelería clásica", name: "Moscow mule", price: 7990, description: "Vodka, lima y ginger beer." },
  { categoryName: "Coctelería clásica", name: "London Mule", price: 7990, description: "Gin, limón y ginger beer." },
  { categoryName: "Coctelería clásica", name: "Clavo oxidado", price: 6990, description: "Whisky y Drambuie." },
  { categoryName: "Coctelería clásica", name: "Negroni", price: 7990, description: "Clásico italiano intenso, amargo y elegante." },
  { categoryName: "Coctelería clásica", name: "Caipiriña", price: 6990, description: "Cachaça 51, limón sutil, azúcar flor." },
  { categoryName: "Coctelería clásica", name: "Copa De espumante", price: 3490, description: "Valdivieso Brut." },
  { categoryName: "Coctelería clásica", name: "Corto Whisky + Bebida 250cc", price: 6990, description: "Jack Daniel N*7 Apple, Honey. Mejora a Chivas Regal 12 años +$2.490." },
  { categoryName: "Coctelería clásica", name: "Piscola", price: 4990, description: "Corto de Piscola Alto del Carmen 35° + Bebida de 220cc." },
  { categoryName: "Coctelería clásica", name: "Mistral de 40°", price: 5990, description: "1 corto de Mistral de 40° + Bebida de 220cc." },
  { categoryName: "Coctelería clásica", name: "Fernet", price: 6990, description: "Corto de Fernet Branca + Bebida de 220cc." },
  { categoryName: "Coctelería clásica", name: "Ron Habana", price: 5990, description: "Corto de Ron Habana Club Añejo Reserva + Bebida de 220cc." },
  { categoryName: "Coctelería clásica", name: "Vodka Stolichnaya", price: 5990, description: "Corto de Vodka Stolichnaya + Bebida de 220cc." },
  { categoryName: "Coctelería clásica", name: "Shot Don Julio", price: 4990, description: "Don Julio Blanco." },
  { categoryName: "Coctelería clásica", name: "Shot Tequila Olmeca Silver", price: 3190, description: "Tequila Olmeca Silver." },

  // Botellas
  { categoryName: "Botellas", name: "Misionero D' Rengo", price: 6990, description: "Cabernet Sauvignon 375 ml 13° GL." },
  { categoryName: "Botellas", name: "Espumante Valdivieso Brut", price: 12990, description: "Botella 750cc." },
  { categoryName: "Botellas", name: "Espumante Riccadonna Asti", price: 22990, description: "Espumante Italiano 750cc." },
  { categoryName: "Botellas", name: "Jack Daniel's", price: 59990, description: "Honey, Apple, Clásico." },

  // Mocktails
  { categoryName: "Mocktails", name: "Mojito Sabor", price: 6990, description: "Maracuyá, frambuesa, mango, chirimoya. Zumo de lima, menta fresca y agua con gas." },
  { categoryName: "Mocktails", name: "Mojito Tradicional 0.0", price: 6490, description: "Zumo de lima natural, menta fresca y agua con gas." },
  { categoryName: "Mocktails", name: "Piña colada 0.0", price: 6490, description: "Crema de coco con piña, sin alcohol." },
  { categoryName: "Mocktails", name: "Rosato Aurelia", price: 6490, description: "Aperitivo italiano 0.0° Aurelia. Aromas a frutas rojas y cítricos." },

  // Bebestibles
  { categoryName: "Bebestibles", name: "Bebida en lata", price: 2900, description: "Bebida de 350cc: Coca Cola, Coca Cola Zero, Fanta o Sprite." },
  { categoryName: "Bebestibles", name: "Agua Mineral", price: 2990, description: "Agua Purificada con Gas o sin Gas." },
  { categoryName: "Bebestibles", name: "Red Bull Variedades", price: 3490, description: "Yellow, Purple, Tradicional o sin azúcar." },
  { categoryName: "Bebestibles", name: "Limonada menta jengibre", price: 4590, description: "Limonada menta jengibre de la casa." },
  { categoryName: "Bebestibles", name: "Limonada Coco", price: 4690, description: "Limonada con coco natural." },
  { categoryName: "Bebestibles", name: "Jugo Natural Variedades", price: 4590, description: "Frambuesa, Mango, Piña, Chirimoya o Maracuyá." },
  { categoryName: "Bebestibles", name: "Ginger Beer", price: 3990, description: "Refresco de jengibre, burbujeante y refrescante." },
  { categoryName: "Bebestibles", name: "Té Twinings", price: 2970, description: "Té a elección con tetera de agua caliente personal." },
  { categoryName: "Bebestibles", name: "Espresso", price: 2900, description: "Café en grano recién molido 80% robusta 20% arábica." },
  { categoryName: "Bebestibles", name: "Café Americano", price: 3200, description: "Café recién molido 80% robusta 20% arábica." },

  // Postres
  { categoryName: "Postres", name: "Kuchen", price: 3290, description: "Kuchen artesanal Don Julio. Elige tu favorito: Nuez o Maracuyá." },
];

async function main() {
  console.log("=== Updating Juana la Brava menu ===\n");

  // Verify restaurant exists
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: RESTAURANT_ID },
    select: { id: true, name: true },
  });
  if (!restaurant) {
    console.error("Restaurant not found!");
    return;
  }
  console.log(`Restaurant: ${restaurant.name}\n`);

  // ─── 1. Upsert categories ────────────────────────────────────────────
  console.log("--- Categories ---");
  const existingCats = await prisma.category.findMany({
    where: { restaurantId: RESTAURANT_ID },
  });

  const categoryMap: Record<string, string> = {}; // categoryName -> categoryId

  for (const catDef of CATEGORIES) {
    // Try to find existing category by normalized name
    const existing = existingCats.find(
      (c) => normalize(c.name) === normalize(catDef.name)
    );

    if (existing) {
      await prisma.category.update({
        where: { id: existing.id },
        data: {
          name: catDef.name,
          position: catDef.position,
          isActive: true,
          ...(catDef.description !== undefined ? { description: catDef.description } : {}),
          ...(catDef.dishType ? { dishType: catDef.dishType } : {}),
        },
      });
      categoryMap[catDef.name] = existing.id;
      console.log(`  Updated category: ${catDef.name} (pos ${catDef.position})`);
    } else {
      const created = await prisma.category.create({
        data: {
          restaurantId: RESTAURANT_ID,
          name: catDef.name,
          position: catDef.position,
          isActive: true,
          description: catDef.description || null,
          dishType: catDef.dishType || "food",
        },
      });
      categoryMap[catDef.name] = created.id;
      console.log(`  Created category: ${catDef.name} (pos ${catDef.position})`);
    }
  }

  // Deactivate categories not in the new menu
  for (const cat of existingCats) {
    if (!CATEGORIES.some((c) => normalize(c.name) === normalize(cat.name))) {
      await prisma.category.update({
        where: { id: cat.id },
        data: { isActive: false },
      });
      console.log(`  Deactivated category: ${cat.name}`);
    }
  }

  // ─── 2. Upsert dishes ────────────────────────────────────────────────
  console.log("\n--- Dishes ---");
  const existingDishes = await prisma.dish.findMany({
    where: { restaurantId: RESTAURANT_ID },
    include: { category: true },
  });

  let updated = 0;
  let created = 0;
  let photosPreserved = 0;
  const processedDishIds = new Set<string>();

  for (let i = 0; i < DISHES.length; i++) {
    const dishDef = DISHES[i];
    const categoryId = categoryMap[dishDef.categoryName];
    if (!categoryId) {
      console.error(`  Category not found for: ${dishDef.name} -> ${dishDef.categoryName}`);
      continue;
    }

    // Find existing dish by fuzzy name match
    const existing = existingDishes.find((d) => matchName(d.name, dishDef.name));

    if (existing) {
      processedDishIds.add(existing.id);
      const hasPhotos = existing.photos && existing.photos.length > 0;
      if (hasPhotos) photosPreserved++;

      await prisma.dish.update({
        where: { id: existing.id },
        data: {
          name: dishDef.name, // Update to new canonical name
          price: dishDef.price,
          description: dishDef.description,
          categoryId: categoryId,
          position: i,
          isActive: true,
          deletedAt: null,
          // Keep existing photos — do NOT touch photos field
        },
      });
      updated++;
      console.log(
        `  Updated: ${dishDef.name} (was "${existing.name}") | $${dishDef.price}${hasPhotos ? ` [${existing.photos.length} photos kept]` : ""}`
      );
    } else {
      await prisma.dish.create({
        data: {
          restaurantId: RESTAURANT_ID,
          categoryId: categoryId,
          name: dishDef.name,
          price: dishDef.price,
          description: dishDef.description,
          photos: [],
          position: i,
          isActive: true,
        },
      });
      created++;
      console.log(`  Created: ${dishDef.name} | $${dishDef.price}`);
    }
  }

  // ─── 3. Soft-delete dishes not in new menu ──────────────────────────
  let softDeleted = 0;
  for (const dish of existingDishes) {
    if (!processedDishIds.has(dish.id) && dish.isActive) {
      await prisma.dish.update({
        where: { id: dish.id },
        data: { isActive: false, deletedAt: new Date() },
      });
      softDeleted++;
      console.log(`  Soft-deleted: ${dish.name}`);
    }
  }

  // ─── Summary ────────────────────────────────────────────────────────
  console.log("\n=== SUMMARY ===");
  console.log(`  Updated: ${updated}`);
  console.log(`  Created: ${created}`);
  console.log(`  Soft-deleted: ${softDeleted}`);
  console.log(`  Photos preserved: ${photosPreserved}`);
  console.log(`  Total dishes in new menu: ${DISHES.length}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
