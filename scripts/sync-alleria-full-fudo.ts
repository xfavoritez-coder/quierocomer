import { PrismaClient, DishDietType } from "@prisma/client";

const prisma = new PrismaClient();
const RESTAURANT_SLUG = "alleria-pizza";
const DRY_RUN = process.env.DRY_RUN === "1";

interface FudoDish {
  name: string;
  price: number;
  description: string;
  dishDiet?: DishDietType;
  isSpicy?: boolean;
  containsNuts?: boolean;
}

interface FudoCategory {
  name: string;
  dishType: string;
  dishes: FudoDish[];
}

// ============ DATA FROM fu.do (source of truth) ============
const FUDO: FudoCategory[] = [
  {
    name: "Antipasti",
    dishType: "entry",
    dishes: [
      { name: "Montanara Napolitana", price: 9400, description: "Típica entrada napoletana para estimular el apetito. Consiste en la combinación de nuestra masa de pizza frita con pomodoro San Marzano (condimentado con ajo, albahaca y aceite de oliva), Grana Padano rallado, un toque de pesto genovese y albahaca fresca (2 unid).", dishDiet: "VEGETARIAN" },
      { name: "Bruschetta di Mortadella", price: 11200, description: "Pan artesanal crocante con harina Italiana Doble 0 con Mortadella di Pistacho de Bologna, Mozzarella di Búfala D.O.C., Pesto Genovese, tomate deshidratado agridulce y Grana Padano. (2und)", dishDiet: "OMNIVORE", containsNuts: true },
      { name: "Antipasti para dos", price: 24500, description: "Tabla para compartir, con productos propios de la gastronomía Italiana y mediterránea compuesta de una base de Rúcula fresca, Mortadella di Pistacho de Bologna, prosciutto Crudo, Gorgonzola azul, nueces, miel, burrata Fresca (Mozzarella di Búfala), polpetta de vacuno. Acompañada de vegetales como alcachofas italianas, berenjenas con tomate cherry, mini aceitunas italianas, aceite de oliva y grana padano rallado.", dishDiet: "OMNIVORE", containsNuts: true },
    ],
  },
  {
    name: "Pizzas Tradizionali",
    dishType: "food",
    dishes: [
      { name: "Marinara", price: 10290, description: "Doble porción de pomodoro San Marzano, orégano, ajo, tomate deshidratado italiano, aceite de oliva y albahaca.", dishDiet: "VEGAN" },
      { name: "Margherita", price: 11800, description: "Podomoro San Marzano, Mozarella Fior di Latte, aceite de oliva y albahaca.", dishDiet: "VEGETARIAN" },
      { name: "Mini Margherita", price: 9200, description: "Mini pizza SOLO PARA LOS MAS PEQUEÑOS con Pomodoro San Marzano, Mozzarella Fior di Latte, aceite de olvia y albahaca.", dishDiet: "VEGETARIAN" },
      { name: "TheTop Pizza", price: 11800, description: "Dos de las pizzas más populares y antiguas de la gastronomía napoletana unidas en un exquisito resultado. Mitad Margherita (Pomodoro San Marzano, Mozzarella Fior di Latte, aceite de olvia y albahaca). Mitad Marinara (Doble porción de pomodoro San Marzano, orégano, ajo y un toque de tomate deshidrato italiano).", dishDiet: "VEGETARIAN" },
      { name: "Margherita Búfala D.O.C", price: 15400, description: "Pomodoro San Marzano, Mozarella di Búfala, Grana Padano rallado, aceite de oliva y albahaca.", dishDiet: "VEGETARIAN" },
      { name: "Diavola", price: 16300, description: "Pomodoro San Marzano, Mozarella Fior di Latte, salchicha picante Calabreza, aceitunas verdes de Gaeta, Grana Padano rallado, aceite de oliva y albahaca.", dishDiet: "OMNIVORE", isSpicy: true },
      { name: "Ortolana", price: 17400, description: "Pomodoro San Marzano, Mozzarella Fior di Latte, berenjena salteada con pomodorini rojo, pimentón, champiñones, Grana Padano rallado, aceite de oliva y albahaca.", dishDiet: "VEGETARIAN" },
      { name: "Capricciosa", price: 19390, description: "Pomorodo San Marzano, Mozzarella Fior Di Latte, Prosciutto Cotto (jamón cocido/artesanal), champiñones, aceitunas verdes de Gaeta. A crudo corazón de alcachofas italianas al centro, aceite de oliva y albahaca.", dishDiet: "OMNIVORE" },
      { name: "Quattro Formaggi", price: 22060, description: "Mozzarella Fior Di Latte, provolone de Cabra, Gorgonzola Azul, pistacho granulado. Incluye canasto de Grana Padano crocante relleno con ricota fresca, pistacho y albahaca.", dishDiet: "VEGETARIAN", containsNuts: true },
      { name: "Calzone al Forno", price: 19490, description: "Pizza rellena de Mozarella Fior di Latte, ricotta, salame Napoli, un toque de pimienta, albahaca y pomodoro", dishDiet: "OMNIVORE" },
      { name: "Mini Calzone al Forno", price: 13590, description: "Mini pizza rellena de Mozarella Fior di Latte, ricotta, salame Napoli, un toque de pimienta y albahaca.", dishDiet: "OMNIVORE" },
    ],
  },
  {
    name: "Pizzas Speciali",
    dishType: "food",
    dishes: [
      { name: "Primavera", price: 21070, description: "Toque de pomodoro San Marzano (POCO POMODORO) Mozarella Fior di Latte. A crudo rúcula fresca, Prosciutto Crudo, Grana Padano, tomate deshidratado italiano y aceite de oliva.", dishDiet: "OMNIVORE" },
      { name: "Connye Vegan", price: 18200, description: "Troquetto relleno con queso vegano, berenjena, pimentón y champiñones. Cubierta con un toque de pomodoro San Marzano, rúcula fresca, aceitunas verdes de Gaeta, corazón de alcachofas italianas y aceite de oliva.", dishDiet: "VEGAN" },
      { name: "Carlo Romano", price: 19490, description: "Toque de pomodoro San Marzano, Mozarella Fior di Latte, aceitunas verdes de Gaeta, tomate deshidratado italiano y orégano. A crudo filete de anchoas del Mediterráneo, aceite de oliva y albahaca.", dishDiet: "OMNIVORE" },
      { name: "Don Lucariello", price: 21290, description: "Toque de pomodoro San Marzano, Mozzarella Fior di Latte, champiñones, tomate deshidratado italiano. A crudo Coppa crocante (tocino italiano), Grana Padano rallado y albahaca.", dishDiet: "OMNIVORE" },
      { name: "Sofía", price: 20620, description: "Pesto Genovese, Mozarella Fior di Latte y tomate deshidratado italiano. A crudo Mortadella con Pistacho de Bologna, ricotta fresca, pistacho granulado y albahaca.", dishDiet: "OMNIVORE", containsNuts: true },
      { name: "Mediterránea", price: 19700, description: "Pizza bianca, Mozzarella Fior di Latte, pomodorini amarillo, tomate deshidratado italiano, ricotta fresca, anchoas mediterráneas, alcaparras, aceite de oliva, albahaca, un toque de orégano, y aceitunas.", dishDiet: "OMNIVORE" },
      { name: "Malaquias Concha", price: 22390, description: "Pasta de Trufa Negra, pomodoro San Marzano, Mozarella Fior di Latte, Gorgonzola Azul. A crudo Prosciutto Crudo y Grana Padano, aromatizada con aceite de Trufa Blanca y albahaca.", dishDiet: "OMNIVORE" },
      { name: "Arlecchino", price: 23160, description: "Salsa pomodorini amarillo, Mozarella Fior di Latte, alcaparras mediterráneas, aceitunas verdes de Gaeta, pimentones salteados, tomates deshidratados, pomodorini amarillo, salame Napoli, orégano y pimienta. A crudo provolone de Cabra y albahaca.", dishDiet: "OMNIVORE" },
      { name: "Don Vittorio", price: 23360, description: "Mozarella Fior di Latte, Gorgonzola Azul, provolone de Cabra, nueces mariposa y miel de campo. Incluye canasto de Grana Padano crocante relleno con Ricotta fresca y albahaca.", dishDiet: "VEGETARIAN", containsNuts: true },
      { name: "Mercadante", price: 23460, description: "Pizza bianca con un toque de pasta de trufa negra, mozarella Fior di Latte, gorgonzola dolce, prosciutto cotto, champiñon salteado, aromatizada con aceite de trufa blanca, grana padano y albahaca.", dishDiet: "OMNIVORE" },
      { name: "Alleria", price: 23590, description: "Pizza bianca, Mozarella Fior di Latte,berenjena salteada con pomodorini rojo, Polpettas de vacuno inspiradas en receta napoletana de la nonna, aromatizada con aceite de Trufa Blanca, Grana Padano rallado y albahaca.", dishDiet: "OMNIVORE" },
      { name: "Don Ricardo", price: 22490, description: "Inspiración de nuestro Pizzaiolo, fusión de presentaciones clásicas napoletanas. Margherita di Búfala D.O.C (Pomodoro San Marzano, Mozarella di Búfala, aceite de oliva y albahaca) borde relleno al estilo Calzone al Forno (Mozarella Fior di Latte, ricotta, salame Napoli y un toque de pimienta).", dishDiet: "OMNIVORE" },
      { name: "La Demonia", price: 23800, description: "Para los amantes del picante. Un toque de salsa pomodoro San Marzano, mozarella di Búfala, gorgonzola dolce, mini aceitunas italianas, salchicha picante Calabreza, pasta di Peperoncino Calabreza, grana padano rallado, albahaca fresca y aceite de Oliva.", dishDiet: "OMNIVORE", isSpicy: true },
      { name: "Don Marocchino", price: 25140, description: "Pomodoro San Marzano, Mozarella di Búfala. A crudo Mortadella di Pistacho de Bologna, Ricotta fresca, exquisita Burrata al centro, pistacho granulado, aceite de oliva y albahaca.", dishDiet: "OMNIVORE", containsNuts: true },
      { name: "Toscana", price: 26790, description: "Pesto Genovese, Mozarella Fior di Latte y hongos porcini ahumados. A crudo Prosciutto Crudo, tomate deshidratado italiano, exquisita Burrata al centro, pistacho granulado, aceite de oliva y albahaca.", dishDiet: "OMNIVORE", containsNuts: true },
      { name: "Luciano", price: 22500, description: "Base de berenjena al funghetto, salteada con pomodorini rojo, ajo y albahaca. A crudo Prosciutto Cotto (jamón cocido/artesanal), stracciatella fresca, Grana Padano rallado, pimienta, aceite de oliva y albahaca.", dishDiet: "OMNIVORE" },
      { name: "Filomena", price: 18100, description: "Pizza bianca con base de crema, Provolone Dolce di cabra, Mozzarella Fior di Latte, Salame Milano, Grana Padano D.O.C, aceite de oliva y hojas de albahaca.", dishDiet: "OMNIVORE" },
      { name: "Cristoforo Colombo", price: 17490, description: "Pizza de Mozarella Fior di Latte, ricotta, salame Napoli, un toque de pimienta y albahaca.", dishDiet: "OMNIVORE" },
      { name: "Rosatina", price: 29400, description: "Pizza a base de crema de calabaza, salchicha de campo salteado en vino blanco, y puerro, fior di latte, terminado con coppa crocante y pecorino romano rallado al momento.", dishDiet: "OMNIVORE" },
    ],
  },
  {
    name: "Pastas",
    dishType: "food",
    dishes: [
      { name: "Gnocchi alla Sorrentina", price: 21400, description: "Gnocchi de papa en salsa Ragú con Mozzarella Fior Di Latte y Grana Padano. Decorado con Mozarella di Búfala D.O.C, Ricotta, un toque de pimienta y albahaca fresca.", dishDiet: "OMNIVORE" },
      { name: "Gnocchi quatro formaggi", price: 21400, description: "Gnochis artesanales de papas con cuatro variantes de formaggio italiano premium: gorgonzola dolce de la sardeña, provolone auricchio dolce stagionado, grana padano DOC y mozzarella fior di latte fresca.", dishDiet: "VEGETARIAN" },
      { name: "Pasta seca alla puttanesca", price: 21400, description: "La puttanesca es una salsa típica Napolitana, un plato que nunca falta en la mesa de una familia Napolitana. Su perfil aromático es un equilibrio entre el salado dulce de las alcaparras, el amargo de las aceitunas, el picante del peperoncino y la acidez del pomodoro. Es una salsa muy sabrosa, veraz y con una gran personalidad.", dishDiet: "VEGAN", isSpicy: true },
      { name: "Lasagna Artesanal en Ragu Napolitano", price: 16990, description: "Ragú napolitano, bechamel, finas láminas de pasta artesanal, fior di latte, granapadano y nuestra base de pomodoro.", dishDiet: "OMNIVORE" },
    ],
  },
  {
    name: "Risottos",
    dishType: "food",
    dishes: [
      { name: "Risotto porcini", price: 21990, description: "Risotto arborio con hongo porcini de la Toscana deshidratados, hongos frescos con notas de trufa blanca, pesto artesanal y nueces.", dishDiet: "VEGETARIAN", containsNuts: true },
    ],
  },
  {
    name: "Postres",
    dishType: "dessert",
    dishes: [
      { name: "Angioletti Fritti con Nutella", price: 13900, description: "Masa de pizza frita cubierta de Nutella, azúcar flor y pistacho granulado (12 unid).", dishDiet: "VEGETARIAN", containsNuts: true },
      { name: "MINI Angioletti Fritti Con Nutella", price: 6900, description: "Masa de pizza cubierta de Nutella, azúcar flor y pistacho granulado (6 unid).", dishDiet: "VEGETARIAN", containsNuts: true },
      { name: "Cannoli Alleria", price: 9900, description: "Dulce típico de Italia de la región de Sicilia. Consiste en una masa dulce aromatizada con vino Marsala Lazzaroni y canela, relleno de crema de tiramisu y nutella, decorado con cacao y perlas de chocolate amargo. (2und)", dishDiet: "VEGETARIAN", containsNuts: true },
      { name: "Cannoli di Pistacho", price: 9900, description: "Dulce típico de Italia de la región de Sicilia. Consiste en una masa dulce aromatizada con vino Marsala Lazzaroni y canela, relleno de crema de pistacho, decorado con azúcar flor y pistacho granulado. (2und)", dishDiet: "VEGETARIAN", containsNuts: true },
      { name: "Cannolis 2 Sabores", price: 9900, description: "Un cannoli di Pistacho y un cannoli Alleria.", dishDiet: "VEGETARIAN", containsNuts: true },
      { name: "Gelato de Fior di Latte", price: 4700, description: "Helado artesanal con mermelada de frutos rojos.", dishDiet: "VEGETARIAN" },
      { name: "Gelato de Amaretto", price: 4700, description: "Helado artesanal de Amaretto con salsa de caramelo salado y pralines de frutos secos.", dishDiet: "VEGETARIAN", containsNuts: true },
      { name: "Gelato Menta Cioccolato", price: 4700, description: "Cremoso de menta, chocolate y nutella.", dishDiet: "VEGETARIAN" },
      { name: "Gelato Caramello Salato", price: 4700, description: "Cremoso helado artesanal, caramelo salado y pralines de nueces.", dishDiet: "VEGETARIAN", containsNuts: true },
      { name: "Tiramisú clásico", price: 6400, description: "Postre de origen italiano compuesto de galletas empapadas en café con licor de amaretto, alternadas con queso mascarpone, azúcar, espolvoreado con cacao en polvo. Para una persona.", dishDiet: "VEGETARIAN" },
      { name: "Tiramisu Alleria", price: 6400, description: "Tiramisú Clásico con toques de ganache de nutella, galletas savoiardi y queso mascarpone. Para una persona.", dishDiet: "VEGETARIAN", containsNuts: true },
    ],
  },
  {
    name: "Cafetería",
    dishType: "drink",
    dishes: [
      { name: "Te negro english breakfast", price: 2200, description: "Sobre de té negro clásico, marca Twinings.", dishDiet: "VEGAN" },
      { name: "Espresso", price: 2500, description: "Café de origen Italiano.", dishDiet: "VEGAN" },
      { name: "Espresso Doble", price: 2700, description: "Doble extracción de espresso de origen italiano.", dishDiet: "VEGAN" },
      { name: "Americano", price: 2700, description: "Espresso de origen italiano diluido con agua caliente.", dishDiet: "VEGAN" },
      { name: "Ristretto", price: 2300, description: "Extracción más pequeña de espresso de origen italiano.", dishDiet: "VEGAN" },
      { name: "Macchiato", price: 2800, description: "Espresso de origen italiano con un toque de leche espumada.", dishDiet: "VEGETARIAN" },
      { name: "Cortado", price: 2900, description: "Espresso de origen italiano con un toque de leche caliente para reducir la intensidad del café.", dishDiet: "VEGETARIAN" },
      { name: "Cortado Doble", price: 3200, description: "Espresso doble de origen italiano con un toque de leche caliente para reducir la intensidad del café.", dishDiet: "VEGETARIAN" },
      { name: "Capuccino", price: 3500, description: "Espresso de origen italiano con leche caliente preparada con mayor cremosidad.", dishDiet: "VEGETARIAN" },
      { name: "Latte", price: 4300, description: "Espresso con leche texturizada.", dishDiet: "VEGETARIAN" },
      { name: "Mocaccino", price: 3700, description: "Espresso de origen italiano con cacao dulce.", dishDiet: "VEGETARIAN" },
      { name: "Affogato Disaronno", price: 3300, description: "Helado artesanal de vainilla, espresso de origen italiano, crema Chantilly y un toque de Disaronno (Licor de Amaretto).", dishDiet: "VEGETARIAN", containsNuts: true },
      { name: "Café Bombón", price: 3900, description: "Café espresso de origen italiano, endulzado con leche condensada y crema chantilly.", dishDiet: "VEGETARIAN" },
      { name: "Infusión de menta", price: 2200, description: "Sobre de infusión menta pura, marca Twinings.", dishDiet: "VEGAN" },
      { name: "Infusión de manzanilla", price: 2200, description: "Sobre de infusión de manzanilla pura, marca Twinings.", dishDiet: "VEGAN" },
      { name: "Te negro canela y cardamomo", price: 2200, description: "Sobre de te negro sabor canela y cardamomo, marca Twinings.", dishDiet: "VEGAN" },
      { name: "Té negro frutos rojos", price: 2200, description: "Sobre de té negro sabor frutos rojos, marca Twinings.", dishDiet: "VEGAN" },
      { name: "Infusión limón y jengibre", price: 2200, description: "Sobre de infusión sabor limón y jengibre, marca Twinings.", dishDiet: "VEGAN" },
      { name: "Infusion de naranja, mango y canela", price: 2200, description: "Sobre de infusión sabor naranja, mango y canela, marca Twinings.", dishDiet: "VEGAN" },
      { name: "Infusión de frutos silvestres", price: 2200, description: "Sobre de infusión sabor frutos silvestres, marca Twinings.", dishDiet: "VEGAN" },
    ],
  },
  {
    name: "Bebidas",
    dishType: "drink",
    dishes: [
      { name: "Peroni Lager 0° Alcohol", price: 3500, description: "Cerveza italiana sin alcohol — botella 330cc.", dishDiet: "VEGAN" },
      { name: "Aranciata Rosa San Pellegrino", price: 4100, description: "Bebida italiana gasificada con sabor a naranja roja — 330ml.", dishDiet: "VEGAN" },
      { name: "Aranciata San Pellegrino.", price: 4100, description: "Bebida italiana gasificada con sabor a naranja — 330ml.", dishDiet: "VEGAN" },
      { name: "Arancia & Fico de India San Pellegrino", price: 4100, description: "Bebida italiana gasificada con sabor a tuna y limón — 330ml.", dishDiet: "VEGAN" },
      { name: "Limonata San Pellegrino", price: 4100, description: "Bebida italiana gasificada con sabor a limón — 330ml.", dishDiet: "VEGAN" },
      { name: "Clementina San Pellegrino.", price: 4100, description: "Bebida italiana gasificada con sabor a mandarina — 330ml.", dishDiet: "VEGAN" },
      { name: "Pompelmo San Pellegrino.", price: 4100, description: "Bebida italiana gasificada con sabor a pomelo — 330ml.", dishDiet: "VEGAN" },
      { name: "Coca-Cola Original", price: 2600, description: "Lata 350ml.", dishDiet: "VEGAN" },
      { name: "Coca-Cola S/azúcar", price: 2600, description: "Lata 350ml.", dishDiet: "VEGAN" },
      { name: "Sprite", price: 2600, description: "Lata 350ml.", dishDiet: "VEGAN" },
      { name: "Sprite Zero", price: 2600, description: "Lata 350ml.", dishDiet: "VEGAN" },
      { name: "Fanta Original", price: 2600, description: "Lata 350ml.", dishDiet: "VEGAN" },
      { name: "Fanta Zero", price: 2600, description: "Lata 350ml.", dishDiet: "VEGAN" },
      { name: "Jugo de Mango", price: 5700, description: "Jugo de pulpa natural de mango.", dishDiet: "VEGAN" },
      { name: "Jugo de Frutilla", price: 5200, description: "Jugo natural de frutilla.", dishDiet: "VEGAN" },
      { name: "Jugo de Chirimoya", price: 5900, description: "Jugo natural de chirimoya.", dishDiet: "VEGAN" },
      { name: "Jugo de Piña", price: 5700, description: "Jugo natural de piña.", dishDiet: "VEGAN" },
      { name: "Agua C/gas chelada Benedictino", price: 2500, description: "Agua con gas estilo chelada.", dishDiet: "VEGAN" },
      { name: "Zumo de limon", price: 1000, description: "Zumo de limón 2 oz recién exprimido.", dishDiet: "VEGAN" },
      { name: "Agua purificada con gas zero", price: 1500, description: "Agua premium purificada con gas zero — 500ml.", dishDiet: "VEGAN" },
      { name: "Agua purificada sin gas zero", price: 1500, description: "Agua purificada premium sin gas zero — 500 ml.", dishDiet: "VEGAN" },
    ],
  },
  {
    name: "Adicionales",
    dishType: "food",
    dishes: [
      { name: "Adicional de Verdura.", price: 3000, description: "1 Porción de: champignon, pimentón salteado, berenjena, alcachofa, tomate cherry, tomate amarillo, tomate deshidratado.", dishDiet: "VEGAN" },
      { name: "Adicional de Embutido Italiano.", price: 4700, description: "1 Porción de Embutido Italiano: salame picante, salame napole, salame milano, jamon cotto, prosciutto crudo, coppa, mortadela pistacho.", dishDiet: "OMNIVORE", containsNuts: true },
      { name: "Adicional de Queso Italiano.", price: 4500, description: "1 Porción de queso italiano: gorgonzola, provolone, fior di late, granapadano laminado, bufala, ricotta, cesta de granapanado con ricotta.", dishDiet: "VEGETARIAN" },
      { name: "Adicional Burrata D.O.C", price: 9000, description: "1 Porción de Burrata fresca Italiana D.O.C.", dishDiet: "VEGETARIAN" },
      { name: "Adicional de Polpetta.", price: 9000, description: "3 unidades de polpetta artesanales en sala pomodoro.", dishDiet: "OMNIVORE" },
      { name: "Adicional Funghi Porcini Italiano.", price: 4000, description: "1 Porción de funghi porcini italiano salteado en aceite de oliva.", dishDiet: "VEGAN" },
      { name: "Adicional de Trufa y Pesto.", price: 2000, description: "1 adicional de: aceite de trufas blancas o crema de trufas negras o crema de pesto artesanal.", dishDiet: "VEGETARIAN" },
      { name: "Adicional de Anchoas Italianas.", price: 2000, description: "1 Porción de: Anchoas italianas.", dishDiet: "OMNIVORE" },
    ],
  },
  {
    name: "Peri Bambini",
    dishType: "food",
    dishes: [
      { name: "Sorrentino", price: 16900, description: "Espaguetis en salsa pomodoro, fior di latte, grana padano. Incluye bebida + helado de vainilla o mini angioletti (2 unidades).", dishDiet: "VEGETARIAN" },
      { name: "Diavoletta", price: 16900, description: "Salsa pomodoro, albahaca, grana padano D.O.P., mozzarella fior di latte, peperoni kids. Incluye bebida + helado de vainilla o mini angioletti (2 unidades).", dishDiet: "VEGETARIAN" },
      { name: "Paperino", price: 16900, description: "Base de crema de leche, salchicha de campo, papas artesanales fritas, grana padano D.O.P., albahaca, mozzarella fior di latte. Incluye bebida + helado de vainilla o mini angioletti (2 unidades).", dishDiet: "OMNIVORE" },
      { name: "Mimosa", price: 16900, description: "Base de crema de leche, jamón artesanal, maíz (choclo), grana padano D.O.P., albahaca, mozzarella fior di latte. Incluye bebida + helado de vainilla o mini angioletti (2 unidades).", dishDiet: "OMNIVORE" },
    ],
  },
];

// ============ helpers ============
const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ").replace(/[.,]/g, "").replace(/\bd\.o\.[cp]/g, "doc").replace(/[áä]/g, "a").replace(/[éë]/g, "e").replace(/[íï]/g, "i").replace(/[óö]/g, "o").replace(/[úü]/g, "u").replace(/ñ/g, "n");

// Aliases para casos donde el nombre cambió ligeramente
const NAME_ALIASES: Record<string, string> = {
  // DB → fu.do canonical
  "tiramisu alleria": "tiramisu alleria",
  "tiramisú alleria": "tiramisu alleria",
  "gnocchi quattro formaggi": "gnocchi quatro formaggi",
  "gelato fior di latte": "gelato de fior di latte",
  "gelato amaretto": "gelato de amaretto",
  "lasagna artesanal en ragu napolitano": "lasagna artesanal en ragu napolitano",
  "lasagna artesanal en ragú napolitano": "lasagna artesanal en ragu napolitano",
  "agua purificada con gas": "agua purificada con gas zero",
  "agua purificada sin gas": "agua purificada sin gas zero",
  "zumo de limón": "zumo de limon",
};

function aliasOf(name: string): string {
  const n = norm(name);
  return NAME_ALIASES[n] || n;
}

async function main() {
  const r = await prisma.restaurant.findFirst({ where: { slug: RESTAURANT_SLUG } });
  if (!r) throw new Error("Alleria no encontrado");

  const note = (s: string) => console.log(s);
  note(`\n=== ${DRY_RUN ? "DRY RUN " : ""}Sync FULL Alleria desde fu.do ===\n`);

  // ============ 1. Categorías: position + dishType ============
  note("--- 1. Categorías (orden + tipo) ---");
  const allCats = await prisma.category.findMany({ where: { restaurantId: r.id } });
  for (let i = 0; i < FUDO.length; i++) {
    const fc = FUDO[i];
    let cat = allCats.find(c => norm(c.name) === norm(fc.name));
    if (!cat) {
      note(`📁 Crear: ${fc.name} <${fc.dishType}> pos=${i}`);
      if (!DRY_RUN) cat = await prisma.category.create({ data: { restaurantId: r.id, name: fc.name, dishType: fc.dishType, position: i, isActive: true } });
    } else {
      const needsUpdate = cat.position !== i || cat.dishType !== fc.dishType;
      if (needsUpdate) {
        note(`✓ ${cat.name}: pos ${cat.position}→${i}, type ${cat.dishType}→${fc.dishType}`);
        if (!DRY_RUN) await prisma.category.update({ where: { id: cat.id }, data: { position: i, dishType: fc.dishType } });
      }
    }
  }

  // Reload categorias
  const cats = await prisma.category.findMany({ where: { restaurantId: r.id } });
  const catByName = (n: string) => cats.find(c => norm(c.name) === norm(n));

  // Reload all dishes (incluso deletedAt para evitar duplicados)
  const allDishes = await prisma.dish.findMany({ where: { restaurantId: r.id } });
  // Para matching: solo activos y no deleted
  const liveDishes = allDishes.filter(d => !d.deletedAt && d.isActive);

  // Index FUDO names for "is in fudo?" check
  const fudoNamesByCat: Record<string, Set<string>> = {};
  for (const fc of FUDO) {
    fudoNamesByCat[norm(fc.name)] = new Set(fc.dishes.map(d => aliasOf(d.name)));
  }

  // ============ 2. Para cada plato fu.do: upsert ============
  note("\n--- 2. Sincronizar platos (upsert) ---");
  for (const fc of FUDO) {
    const cat = catByName(fc.name);
    if (!cat) { note(`⚠️  Categoría no encontrada después de crear: ${fc.name}`); continue; }
    for (let i = 0; i < fc.dishes.length; i++) {
      const fd = fc.dishes[i];
      const fdName = aliasOf(fd.name);
      // Buscar plato existente por alias
      const existing = liveDishes.find(d => aliasOf(d.name) === fdName);
      if (existing) {
        // Update si el nombre, precio, descripción, posición o categoría cambiaron
        const needsUpdate =
          existing.name !== fd.name ||
          existing.price !== fd.price ||
          existing.description !== fd.description ||
          existing.position !== i ||
          existing.categoryId !== cat.id ||
          existing.dishDiet !== (fd.dishDiet || "OMNIVORE") ||
          existing.containsNuts !== (fd.containsNuts || false) ||
          existing.isSpicy !== (fd.isSpicy || false);
        if (needsUpdate) {
          note(`✓ ${cat.name} / ${fd.name} (id ${existing.id})`);
          if (!DRY_RUN) await prisma.dish.update({
            where: { id: existing.id },
            data: {
              name: fd.name,
              price: fd.price,
              description: fd.description,
              position: i,
              categoryId: cat.id,
              dishDiet: fd.dishDiet || "OMNIVORE",
              containsNuts: fd.containsNuts || false,
              isSpicy: fd.isSpicy || false,
            },
          });
        }
      } else {
        note(`➕ ${cat.name} / ${fd.name} — $${fd.price.toLocaleString("es-CL")}`);
        if (!DRY_RUN) await prisma.dish.create({
          data: {
            restaurantId: r.id,
            categoryId: cat.id,
            name: fd.name,
            description: fd.description,
            price: fd.price,
            position: i,
            dishDiet: fd.dishDiet || "OMNIVORE",
            containsNuts: fd.containsNuts || false,
            isSpicy: fd.isSpicy || false,
            photos: [],
            tags: [],
            isActive: true,
          },
        });
      }
    }
  }

  // ============ 3. Eliminar platos que NO están en fu.do (en categorías sincronizadas) ============
  note("\n--- 3. Eliminar platos no en fu.do ---");
  const fudoCatNames = new Set(FUDO.map(c => norm(c.name)));
  for (const d of liveDishes) {
    const cat = cats.find(c => c.id === d.categoryId);
    if (!cat) continue;
    if (!fudoCatNames.has(norm(cat.name))) continue; // categoría no manejada
    const fudoSet = fudoNamesByCat[norm(cat.name)];
    if (!fudoSet) continue;
    if (!fudoSet.has(aliasOf(d.name))) {
      note(`🗑️  ${cat.name} / ${d.name} — $${d.price.toLocaleString("es-CL")}`);
      if (!DRY_RUN) await prisma.dish.update({ where: { id: d.id }, data: { deletedAt: new Date(), isActive: false } });
    }
  }

  // ============ 4. Borrar fotos de Cafetería (las que tiene son auto-generadas y no representativas) ============
  note("\n--- 4. Borrar fotos de Cafetería (no son representativas) ---");
  const cafeCat = catByName("Cafetería");
  if (cafeCat) {
    const cafeDishes = await prisma.dish.findMany({ where: { categoryId: cafeCat.id, deletedAt: null } });
    for (const d of cafeDishes) {
      if (d.photos.length > 0) {
        note(`📷 Quitar foto: ${d.name}`);
        if (!DRY_RUN) await prisma.dish.update({ where: { id: d.id }, data: { photos: [] } });
      }
    }
  }

  note(`\n=== ${DRY_RUN ? "DRY RUN — sin cambios" : "Sync completo"} ===`);
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
