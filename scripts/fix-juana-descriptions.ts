import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const rid = "cmoaphtgc0001enb4rsa2c5v9";

const updates: [string, string][] = [
  ["Pisco Sour Nacional", "Pisco Sour 🇨🇱 Fresco, cítrico y el favorito de siempre. 👉 Hazlo de maracuyá +$1.000 🍑"],
  ["Mojito tradicional", "Clásico refrescante con Ron de Caldas, menta fresca, limón y soda. Perfecto para partir o acompañar. 🍃🍋"],
  ["Mojito Raspberry", "Mojito de la casa 🍓 Refrescante mezcla de Bacardí Razz, menta fresca y limón, con un toque de frutos rojos. Dulce, fresco y peligrosamente rico."],
  ["Mojito Jagger", "🍹 Refrescante mezcla de Jägermeister, menta fresca y limón. Intenso, herbal y con carácter."],
  ["Mojito Sabores", "🍹 Elige tu sabor: frambuesa, mango o maracuyá. Refrescante mezcla de ron blanco, menta fresca y limón."],
  ["Mojito Corona", "Mojito Corona 🍺🍹 Una mezcla refrescante con el toque burbujeante de Corona. Liviano, fresco y peligrosamente rico."],
  ["Daiquiri sabores", "Daiquiri con fruta natural. Pídelo con Maracuyá, Frambuesa o Mango. Ron Bacardi blanco, zumo de limón, azúcar flor, fruta natural a elección y hielo. Se sirve frappé."],
  ["Espresso Martini", "El Espresso Martini combina vodka, licor de café y espresso, creando un trago elegante, intenso y con un toque de energía."],
  ["Ramazzotti", "🍊 Refrescante, burbujeante y con un toque herbal. Perfecto para el aperitivo."],
  ["Aperol spritz", "🍊 Fresco, burbujeante y fácil de tomar. El favorito para partir."],
  ["Gin Berries Bull", "Gin, frutos rojos, Red Bull acai, hielo en cubo y limón de pica."],
  ["Tropical Gin", "Red Bull tropical, Gin y pulpa de maracuyá."],
  ["Gin Hendricks", "El mejor gin Hendricks con tónica y pepino."],
  ["Copa de sangría", "🍷 Refrescante mezcla de vino tinto con frutas de la estación. Dulce, fresca y perfecta para cualquier momento."],
  ["Sour catedral peruano", "Sour Catedral Peruano 🇵🇪 Hecho con pisco Tabernero Quebranta. Intenso, equilibrado y para los que saben de verdad."],
  ["Piña Colada", "🍍🥥 El clásico tropical: cremosa, dulce y refrescante. Sabor a playa en cada sorbo."],
  ["Margarita", "🍸 Clásica, fresca y cítrica. El equilibrio perfecto entre tequila y limón."],
  ["Moscow mule", "🍸 Refrescante mezcla de vodka, lima y ginger beer. Burbujeante, cítrico."],
  ["London Mule", "🍸 Refrescante mezcla de gin, limón y ginger beer. Cítrico, burbujeante."],
  ["Clavo oxidado", "🥃 Whisky y Drambuie en una mezcla intensa, suave y con carácter. Para los que buscan algo distinto."],
  ["Negroni", "🥃 Clásico italiano de carácter: intenso, amargo y elegante."],
  ["Caipiriña", "Refrescante Trago Elaborado con Cachaça 51, Gajos de Limón Sutil, Azúcar Flor, Hielo y Decorado con Rodajas de Limón."],
  ["Copa De espumante", "Valdivieso Brut"],
  ["Corto Whisky + Bebida 250cc", "Jack Daniel N*7 Apple, Honey 👉 Mejora tu Whisky Chivas Regal 12años +$2.490"],
  ["Piscola", "Corto de Piscola Alto del Carmen 35° + Bebida de 220 cc"],
  ["Mistral de 40°", "1 corto de Mistral de 40° + Bebida de 220 cc"],
  ["Fernet", "Corto de Fernet Branca + Bebida de 220 cc"],
  ["Ron Habana", "Corto de Ron Habana Club Añejo Reserva + Bebida de 220 cc"],
  ["Vodka Stolichnaya", "Corto de Vodka stolichnaya + Bebida de 220 cc"],
  ["Shot Don Julio", "¡Don julio Blanco por excelencia uno de los mejores, solo para entendidos!"],
  ["Shot Tequila Olmeca Silver", "¡Tequila Olmeca Silver Siempre es un buen momento para un tequila!"],
  ["Chicken Street", "Pollo coreano crocante 🐔 bañado en salsa agridulce Hot Flame o BBQ. ¡Jugoso por dentro, crujiente por fuera 👉 Ideal para compartir!"],
  ["Schop LOA Otra Ronda", "Schop LOA Otra Ronda, es una Amber Ale de color cobrizo brillante, con cuerpo y super fácil de tomar. Sus maltas tostadas nos regalan un rico sabor a caramelo, toffee y pan tostado."],
  ["Schop LOA entre nubes", "Schop LOA entre nubes, una lager suave y refrescante que cautiva con su sabor equilibrado. Perfecta para cualquier ocasión."],
  ["Flor De Truco", "Es un estilo moderno e híperlupulado con un Dry Hop de 3 exquisitos lúpulos: Citra, Columbus y Mosaic, que nos entrega aromas y notas a piña, mango y maracuyá."],
  ["Minga loca Ipa", "Minga Loca es una cerveza dorada que destaca por su exquisita combinación de lúpulos, dándole un rico amargor y una explosión de aromas cítricos y frutales."],
  ["Michelada", "Haz tus cervezas chelada o michelada."],
  ["Austral Calafate", "Botella 330 cc cerveza austral calafate."],
  ["Kunstman Torobayo", "Botella 330 cc de kunstman torobayo."],
  ["Corona", "Botella 355cc cerveza corona."],
  ["Heineken", "Botella 350cc cerveza heineken."],
  ["Heineken Zero", "Botella de Cerveza sin Alcohol de 330 cc"],
  ["Promo Red Bull + Pisco alto 35°", "Juana te da alas! 🪽 Dos Cortos de Alto de Carmen de 35°+ 1 bebida de 350cc + una Red Bull de 250cc."],
  ["Jarra de sangría", "Para compartir: fresca, frutal y perfecta para la mesa. 👉 Ideal para grupos"],
  ["Encanto Rosa", "Un cóctel suave y seductor, donde el ron y la crema de coco se mezclan con la dulzura de la frambuesa y el azúcar. Servido sobre hielo, es una bebida fresca y deliciosa."],
  ["Juana Tropical", "Creación tropical de nuestro bartender. Exquisito trago con Ron Bacardí blanco, crema de coco, mango y maracuyá natural."],
  ["Loro Loco", "Un cóctel vibrante y refrescante, con tequila, jugo de pomelo y limón, combinado con la dulzura del maracuyá y el toque herbáceo del tomillo. Su espuma dorada de cerveza Golden lo convierte en una experiencia única."],
  ["Sexy Juana", "Un cóctel refrescante y afrutado, con vodka, frambuesa, limón y maracuyá, perfectamente equilibrado con un toque de triple sec y un final burbujeante de espumante."],
  ["Marea Alta", "Una ola de sabores tropicales con ron blanco y negro, crema de coco, y el toque ácido del limón. La pulpa de maracuyá y mango aportan frescura, mientras que el curacao le da un giro vibrante."],
  ["Naranja Mecánica Sour", "Un cóctel audaz y sofisticado, con gin y Aperol que se fusionan con el cítrico del limón y el toque herbal de la goma de romero. Su textura suave."],
  ["Vuelta la Manzana", "Un cóctel refrescante y afrutado, con la intensidad del Jack de manzana y el toque cítrico del limón, suavizado con goma. La burbujea del espumante y el hielo frappé le dan un giro fresco."],
  ["Maracazzotti", "Ramazzotti, maracuyá y Sprite se mezclan en un trago fresco, tropical y lleno de sabor."],
  ["Mojito Sabor", "Mezcla equilibrada de zumo de lima natural, menta fresca y un toque espumante de agua con gas. Elige: maracuyá, frambuesa, mango o chirimoya."],
  ["Mojito Tradicional 0.0", "Mezcla equilibrada de zumo de lima natural, menta fresca y un toque espumante de agua con gas."],
  ["Piña colada 0.0", "Disfruta la suavidad de la crema de coco fusionada con el dulzor refrescante de la piña, sin una gota de alcohol."],
  ["Rosato Aurelia", "Aperitivo italiano versión 0.0° Aurelia. Una experiencia fresca y sofisticada, con aromas a frutas rojas y cítricos."],
  ["Red Bull Variedades", "Elige tu Red Bull: Yellow, Purple, Tradicional o sin azúcar."],
  ["Limonada menta jengibre", "Limonada menta jengibre de la casa."],
  ["Limonada Coco", "Exquisita limonada con coco natural."],
  ["Jugo Natural Variedades", "Elige entre Frambuesa, Mango, Piña, Chirimoya o Maracuyá."],
  ["Ginger Beer", "Refresco de jengibre, burbujeante y refrescante, con un toque especiado y equilibrado."],
  ["Té Twinings", "Té twining a elección con tetera de agua caliente personal."],
  ["Espresso", "Café en Grano recién molido 80% robusta 20% Arábica."],
  ["Café Americano", "Café recién molido 80% robusta 20% Arábica."],
  ["Kuchen", "Kuchen artesanal Don Julio: kúchenes recién horneados, de masa suave con rellenos generosos. Elige tu favorito: 🥜 Nuez o 🥭 Maracuyá."],
  ["Misionero D' Rengo", "Cabernet Sauvignon 375 ml 13° GL"],
  ["Espumante Valdivieso Brut", "Botella 750cc"],
  ["Espumante Riccadonna Asti", "Espumante Italiano 750cc"],
  ["Jack Daniel's", "Honey, Apple, Clásico"],
  ["Bebida en lata", "Bebida de 350cc: Coca Cola, Coca Cola Zero, Fanta o Sprite."],
  ["Agua Mineral", "Agua Purificada con Gas o sin Gas."],
  ["Padthai", "Fideos de arroz salteados en wok, combinados con una sabrosa salsa a base de tamarindo, ostras y pescado. Añadimos huevo y verduras frescas, brotes, cebollín, zanahoria y un toque crujiente de maní. +Pollo $2.000 / +Camarón $2.500"],
  ["Ceviche", "Salmón, atún y camarones en cubos, marinados en nuestra suave leche de tigre nikkei con cebolla morada, coronado con palta cremosa. Un ceviche fresco, equilibrado y lleno de sabor."],
  ["Ramen de cerdo", "Exquisito caldo de huesos de cerdo y verduras, acompañados de tallarines caseros, con huevo, ciboulette y filete de cerdo."],
  ["Papas Fritas Clásicas 1/2", "¡Las clásicas papitas artesanales que no pueden faltar!"],
  ["Papas Fritas Supreme para 2", "1/2 Kg Papas fritas artesanales, con tocino, tomate cherry, crema ácida, salsa cheddar y ciboulette."],
  ["Papas Fritas Camarón para 2", "1/2 kilo de ricas papas fritas artesanales con camarones frescos, queso cheddar, crema acida y decorada con ciboulette."],
  ["Papas Palta Mechada para 2", "1/2 kg Papas fritas artesanales con carne mechada, palta, salsa de queso cheddar y cebolla caramelizada."],
  ["Papas Fritas Chingonas para 2", "½ kg de papas fritas artesanales con carne mechada, guacamole, tomate cherry, salsa de cilantro, cilantro y acompañados de limón de pica."],
  ["Papas fritas Supreme XL", "1 kg Papas fritas artesanales, con tocino, tomate cherry, crema ácida, salsa cheddar y ciboulette. (Para 3 - 4 personas)"],
  ["Papas fritas Palta Mechada XL", "1 kg Papas fritas artesanales con carne mechada, palta, salsa de queso cheddar y cebolla caramelizada. (Para 3 - 4 personas)"],
  ["Papas Fritas Chingonas XL", "1 kg Papas fritas artesanales con carne mechada, guacamole, tomate cherry, salsa de cilantro, cilantro y acompañados de limón de pica. (Para 3 - 4 personas)"],
  ["Promo 2 Piscola 35°", "2 cortos de Pisco Alto del Carmen 35° + 2 Bebidas 220 cc"],
  ["Promo 2 Mistral 40°", "2 piscolas de Mistral de 40° + 2 Bebidas de 220 cc"],
  ["Promo 2 Fernet", "2 cortos de Fernet Branca + 1 Bebida de 350 cc a elección"],
  ["Promo Ron Habana", "2 cortos de Ron Habana Club Añejo Reserva 40° + Bebida 350 cc a elección"],
  ["Promo Whisky Clásico", "2 cortos de Whisky Jack Daniel's Negro + 1 Bebida de 350 cc a elección"],
];

async function run() {
  let updated = 0;
  let notFound: string[] = [];
  for (const [name, desc] of updates) {
    const dish = await p.dish.findFirst({ where: { restaurantId: rid, name: { equals: name, mode: "insensitive" }, isActive: true } });
    if (dish) {
      await p.dish.update({ where: { id: dish.id }, data: { description: desc } });
      updated++;
    } else {
      notFound.push(name);
    }
  }
  console.log("Updated", updated, "descriptions");
  if (notFound.length) console.log("Not found:", notFound.join(", "));
  await p.$disconnect();
}
run();
