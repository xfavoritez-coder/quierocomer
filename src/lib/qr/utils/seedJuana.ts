import { prisma } from "@/lib/prisma";

const CDN = "https://cdn.bistrify.app/";
const LOGO = CDN + "images/juanalabrava_1651096765217_453.png";
const BANNER = "https://cdn.bistrify.app/cdn-cgi/image/w=800,h=400,fit=cover/images/juanalabrava_1652024736505_749.png";

interface Item { name: string; desc: string | null; img: string; price: number; rec?: boolean }

const MENU: Record<string, Item[]> = {
  "Tablas": [
    { name: "Tabla de sushi para 2", desc: "10 piezas Tempura Acevichado, 10 piezas Tori Palta, 5 Dumpling hecho a mano, 4 Nigiris acevichados", img: CDN+"images/items/fd884ad7-3149-4712-8488-547574056ad4.jpg", price: 32990, rec: true },
    { name: "Tabla de sushi para 4", desc: "10 piezas tempura acevichado + 10 piezas Tori palta + 10 piezas Ebi Acevichado + 10 piezas Protein Roll + 4 cortes de sashimi + 5 arrollados primavera + 4 nigiris acevichados", img: CDN+"images/items/1249cd3a-6199-42e4-87cc-ae772a77d4c6.jpg", price: 49990 },
  ],
  "Sushi": [
    { name: "Tartar Roll", desc: "Camarón apanado y palta, envuelto en sésamo tostado, coronado con tartar de salmón. Equilibrio perfecto entre crocancia y frescura.", img: CDN+"images/items/c7ea4c13-bd38-4f92-9d7c-075617b115be.png", price: 10990, rec: true },
    { name: "Flama Roll", desc: "Camarón apanado, palta y cilantro, envuelto en salmón flambeado. Coronado con salsa yum yum y cebolla crispy.", img: CDN+"images/items/ace47192-7059-4fa3-b472-b52c9ead9965.png", price: 10990, rec: true },
    { name: "Parrillero Roll", desc: "Pollo apanado y palta, envuelto en queso flambeado. Terminado con chimichurri casero y jalapeño frito.", img: CDN+"images/items/d6793a2a-1e4c-4427-9816-2a97082ab4aa.png", price: 8990 },
    { name: "Tsunami Roll", desc: "Camarón tempura, salmón, salsa spicy y cilantro, envuelto en palta y coronado con quinoa crispy.", img: CDN+"images/items/784dede9-4042-4f58-88d6-c2553253fc82.png", price: 10990 },
    { name: "Protein Roll (sin arroz)", desc: "Roll sin arroz, relleno de camarón, salmón y palta envuelto en panko, coronado en acevichado de salmón.", img: CDN+"images/items/ee491ffd-6d13-4b19-bc2f-a0fc02a11897.png", price: 10990 },
    { name: "Tempura Acevichado", desc: "Camarón furai, queso crema y palta envuelto en panko coronado en acevichado de salmón y ciboulette.", img: CDN+"images/items/0f9edccf-5f1a-4501-a98a-2373fdedc934.png", price: 10990 },
    { name: "Ebi Acevichado", desc: "Camarón furai, queso crema y ciboulette envuelto en palta acompañado de salsa acevichada.", img: CDN+"images/items/42a1184f-d276-4568-a1f8-22c3ee0982ac.png", price: 8990 },
    { name: "Tori Hot", desc: "Pollo teriyaki, queso crema y cebollín envuelto en panko.", img: CDN+"images/items/16e32525-71c2-41da-a510-e873142a2d95.png", price: 8990 },
    { name: "Tuna Nikkei", desc: "Camarón y palta sobre base de camote furai crujiente, envuelto en atún fresco y bañado en salsa acevichada nikkei.", img: CDN+"images/items/afbff731-7ba5-4962-b493-7d74e7aaa6cb.jpg", price: 9990 },
    { name: "Delicius", desc: "Camarón apanado, cebolla morada crocante, cilantro y queso crema, envuelto en salmón fresco y quinoa crocante.", img: CDN+"images/items/ef5cb1e8-4862-4939-a5a7-9f9c07b1d79f.png", price: 9990 },
    { name: "Elixir", desc: "Camote furai crujiente, palta y ceviche nikkei de champiñones frescos, bañado en salsa acevichada.", img: CDN+"images/items/3b795dab-670d-4b2c-80b4-efd50fc67b68.jpg", price: 8990 },
    { name: "Cangrejo Roll", desc: "Salmón apanado y cilantro, envuelto en cangrejo y coronado con láminas de atún fresco.", img: CDN+"images/items/26d23e33-0f34-443a-a0c4-bbb717522d37.jpg", price: 9990 },
    { name: "Fuki Tempura (sin arroz)", desc: "Roll sin arroz relleno de pollo furai, palta, queso crema y cebollín envuelto en panko.", img: CDN+"images/95671_1652496570679_684.png", price: 9990 },
    { name: "Osaka Keto", desc: "Roll Keto, relleno de camarón, salmón, queso crema y palta envuelto en salmón.", img: CDN+"images/items/113fbda6-d64a-4c09-b37b-64f974680b75.png", price: 10990 },
    { name: "Kobu Nikkei", desc: "Roll Keto relleno con camarón, champiñón, queso crema, palta y cebollín envuelto en palta y cubierto con acevichado de salmón.", img: CDN+"images/items/3815b0b1-9c74-40a4-a056-a807e01a6bb4.png", price: 10990 },
    { name: "Avocado", desc: "Salmón, queso crema, palta y ciboulette envuelto en palta.", img: CDN+"images/95671_1651103573511_389.jpeg", price: 8990 },
    { name: "Montañita", desc: "Camarón furai y queso crema, envuelto en salmón, coronado en acevichado de salmón y camote hilo.", img: CDN+"images/95671_1651102849895_140.jpeg", price: 10990 },
    { name: "Ebi Panko", desc: "Camarón, queso crema y ciboulette envuelto en panko.", img: CDN+"images/95671_1651103015674_171.jpeg", price: 8990 },
    { name: "Tori Palta", desc: "Pollo teriyaki, queso crema y ciboulette envuelto en palta.", img: CDN+"images/95671_1651102446570_946.jpeg", price: 8990 },
    { name: "Camote Nikkei (Vegano)", desc: "Camote tempura, champiñón, palta y ciboulette, envuelto en palta, acompañado de salsa acevichada vegana.", img: CDN+"images/95671_1652496127375_235.png", price: 6990 },
    { name: "Salsa Teriyaki", desc: null, img: CDN+"images/95671_1680959631120_627.jpeg", price: 1790 },
    { name: "Salsa Acevichada", desc: null, img: CDN+"images/726410_1680960146844_259.jpeg", price: 1790 },
    { name: "Salsa Aji Gallina", desc: "Clásica salsa peruana, cremosa, suave y un toque ligeramente picante.", img: CDN+"images/items/b8037f2e-7f45-46b3-a2d3-5d84039737d8.jpg", price: 1790 },
  ],
  "Pizza": [
    { name: "Camarón que se Duerme", desc: "Salsa de tomate, queso mozzarella, camarón, cebollín y queso crema.", img: CDN+"images/561289_1653154010049_593.png", price: 15990, rec: true },
    { name: "Me haces palta", desc: "Salsa de tomate, queso mozzarella, carne mechada y palta.", img: CDN+"images/567697_1653154202062_110.png", price: 15990 },
    { name: "Locura de Juana", desc: "Salsa de tomate, queso mozzarella, jamón serrano, cebolla caramelizada y palta.", img: CDN+"images/567695_1653154308352_991.png", price: 15990, rec: true },
    { name: "Carnivora Enjaulada", desc: "Salsa de tomate, queso mozzarella, carne mechada, pepperoni y tocino.", img: CDN+"images/561288_1653153916454_94.png", price: 15990 },
    { name: "Pesto Margarita", desc: "Salsa de tomate, queso mozzarella, tomate cherry, albahaca fresca y pesto de albahaca de la casa.", img: CDN+"images/567699_1653154064868_533.png", price: 13990 },
    { name: "Pal Monte", desc: "Salsa de tomate, queso mozzarella, jamón serrano, tomate cherry y rúcula.", img: CDN+"images/567698_1653153943018_850.png", price: 15990 },
    { name: "Sueño Veggie", desc: "Salsa de tomate, queso mozzarella, champiñón, choclo, tomate cherry y cebolla caramelizada.", img: CDN+"images/567700_1653154263755_383.png", price: 14990 },
    { name: "Arma tu pizza", desc: "Ingredientes: Clásicos $1.290 / Premium $1.990 / Vip $2.490.", img: CDN+"images/95669_1658683705707_242.jpeg", price: 8990 },
  ],
  "Para compartir": [
    { name: "Chiken Street", desc: "Pollo coreano crocante bañado en salsa agridulce. Jugoso por dentro, crujiente por fuera.", img: CDN+"images/items/a6f30c05-8e64-4d10-aafd-ed7c38927552.png", price: 7990 },
    { name: "Dumpling Camarón", desc: "Dumplings de camarón hechos a mano, rellenos de camarón jugoso y dorados en la base.", img: CDN+"images/items/384aad9f-e234-4270-9336-18c52858f450.jpg", price: 8990 },
    { name: "Dumpling de Cerdo", desc: "Dumplings de cerdo hechos a mano, jugosos y llenos de sabor. Dorados en la base para un toque crujiente.", img: CDN+"images/items/36cc47f1-3abd-4b53-a2cd-4b809884ff44.jpg", price: 8990 },
    { name: "Empanaditas Mechada Queso", desc: "3 empanaditas hechas a mano, doradas y crujientes, rellenas de mechada con queso derretido. Acompañadas de guacamole.", img: CDN+"images/items/e86e2172-186a-4f7e-81d5-3d213f49021f.jpg", price: 8990 },
    { name: "Crispy Rice", desc: "6 bases de arroz crocante rellenos de queso crema, coronados con tartar de salmón fresco.", img: CDN+"images/items/2dcb2ef6-8320-4257-8ba0-2fa4f7aeca47.jpg", price: 8990 },
    { name: "Nigiri de salmón acevichado", desc: "4 nigiris de salmón con salsa acevichada y ciboulette.", img: CDN+"images/95874_1651337389339_598.jpeg", price: 6990 },
    { name: "Sashimi", desc: "5 cortes de salmón fresco.", img: CDN+"images/562828_1653153250618_291.png", price: 7990 },
    { name: "Papas Fritas Clásicas 1/2", desc: "Las clásicas papitas que no pueden faltar.", img: CDN+"images/items/51ed1872-44ba-4230-b1af-6e3179d270b5.jpg", price: 7990 },
    { name: "Papas Fritas Supreme para 2", desc: "1/2 Kg papas fritas, con tocino, tomate cherry, crema ácida, salsa cheddar y ciboulette.", img: CDN+"images/items/aa3f7244-e457-4dc0-a0d4-942872530dea.jpg", price: 14990 },
    { name: "Papas Fritas Camarón para 2", desc: "1/2 kilo de papas fritas con camarones frescos, queso cheddar, crema ácida y ciboulette.", img: CDN+"images/items/41800e48-898f-4062-937c-cb8b70b2a4df.jpg", price: 14990 },
    { name: "Papas Palta Mechada para 2", desc: "1/2 kg papas fritas con carne mechada, palta, salsa de queso cheddar y cebolla caramelizada.", img: CDN+"images/items/e4257a86-74cd-4230-923e-03978070ce8c.jpg", price: 14990 },
    { name: "Papas Fritas Supreme", desc: "1 Kg papas fritas, con tocino, tomate cherry, crema ácida, salsa cheddar y ciboulette.", img: CDN+"images/567709_1653152986309_798.png", price: 19990 },
    { name: "Papas Fritas Palta Mechada", desc: "1 Kg papas fritas con carne mechada, palta, salsa de queso cheddar y cebolla caramelizada.", img: CDN+"images/567708_1653152998583_665.png", price: 22990 },
    { name: "Papas Fritas Chingonas", desc: "1 Kg papas fritas con carne mechada, guacamole, tomate cherry, salsa de cilantro, cilantro y limón.", img: CDN+"images/95874_1651337162027_394.jpeg", price: 22990 },
    { name: "Papas Fritas Veggie", desc: "1 Kg papas fritas, salsa queso cheddar, crema ácida, tomate cherry, cebolla caramelizada, champiñones y ciboulette.", img: CDN+"images/634686_1663810971146_984.png", price: 19990 },
  ],
  "Ceviche y Gohan": [
    { name: "Ceviche Nikkei", desc: "Salmón, atún y camarones en cubos, marinados en leche de tigre nikkei con cebolla morada, coronado con palta cremosa.", img: CDN+"images/items/4c7edd1d-e177-4cea-91dc-498c7f3368ac.jpg", price: 15990, rec: true },
    { name: "Gohan Protein", desc: "Salmón fresco, camarón tempura, camote hilo, champiñón tempura, palta, queso crema y cebollín, coronado con mix de sésamo sobre arroz de sushi fresco.", img: CDN+"images/567706_1663810853196_840.png", price: 10990 },
    { name: "Gohan Goku", desc: "Pollo teriyaki, queso crema, palta, choclo, papa hilo y cebollín coronado con mix de sésamo sobre arroz de sushi del día.", img: CDN+"images/567704_1653153513579_231.png", price: 9990 },
    { name: "Gohan Kame House", desc: "Salmón, queso crema, cebollín y palta, coronado en mix de sésamo sobre arroz de sushi.", img: CDN+"images/567705_1653153525811_94.png", price: 10990 },
    { name: "Gohan Vegeta", desc: "Champiñón tempura, queso crema, palta, choclo y camote frito coronado en mix de sésamo sobre arroz de sushi del día.", img: CDN+"images/567707_1663810910021_781.png", price: 9990 },
  ],
  "Cervezas": [
    { name: "Schop LOA Otra Ronda", desc: "Amber Ale de color cobrizo brillante, con cuerpo y fácil de tomar. Maltas tostadas con sabor a caramelo, toffee y pan tostado.", img: CDN+"images/items/693e7b3e-9900-4e41-a11b-770b79840107.jpg", price: 5490 },
    { name: "Schop LOA Entre Nubes", desc: "Lager suave y refrescante que cautiva con su sabor equilibrado.", img: CDN+"images/items/6513c1bf-8862-44ee-a539-e7ac4c49f715.jpg", price: 5490 },
    { name: "Flor De Truco", desc: "Hazy IPA hiperlupulada con Dry Hop de Citra, Columbus y Mosaic. Lata de 470ml, 6% ABV, IBU 40.", img: CDN+"images/items/171d28b6-c363-42d3-bf33-83219a75be0e.png", price: 6290 },
    { name: "Minga Loca IPA", desc: "IPA dorada con exquisita combinación de lúpulos, amargor y aromas cítricos y frutales. Lata de 470ml, 6.5% ABV, IBU 50.", img: CDN+"images/items/84a055f0-e72b-4acf-819c-e0d875b1c878.png", price: 5690 },
    { name: "Michelada", desc: "Haz tu cerveza Chelada o Michelada.", img: CDN+"images/567720_1678383607283_344.jpeg", price: 1500 },
    { name: "Austral Calafate", desc: "Botella 330cc cerveza Austral Calafate.", img: CDN+"images/567716_1697642264761_959.jpeg", price: 4290 },
    { name: "Kunstman Torobayo", desc: "Botella 330cc de Kunstman Torobayo.", img: CDN+"images/567718_1697642347530_255.jpeg", price: 4290 },
    { name: "Corona", desc: "Botella 355cc cerveza Corona.", img: CDN+"images/567715_1697642218815_34.jpeg", price: 3990 },
    { name: "Heineken", desc: "Botella 350cc cerveza Heineken.", img: CDN+"images/567717_1697642304376_607.jpeg", price: 3990 },
    { name: "Heineken Zero", desc: "Botella de cerveza sin alcohol de 330cc.", img: CDN+"images/items/96641a7a-bf37-46b7-9da9-5cf79b07de8e.jpg", price: 3990 },
  ],
  "Tragos de autor": [
    { name: "Encanto Rosa", desc: "Cóctel suave y seductor, donde el ron y crema de coco se mezclan con frambuesa y azúcar. Servido sobre hielo.", img: CDN+"images/95670_1709237908731_631.jpeg", price: 7990 },
    { name: "Juana Tropical", desc: "Creación tropical con Ron Bacardi blanco, crema de coco, mango y maracuyá natural.", img: CDN+"images/95918_1652015436203_531.jpeg", price: 6990 },
    { name: "Loro Loco", desc: "Cóctel vibrante con tequila, jugo de pomelo y limón, maracuyá y tomillo. Espuma de cerveza Golden.", img: CDN+"images/items/a5435070-062b-48c8-8c97-4337224093c7.jpg", price: 7990 },
    { name: "Sexy Juana", desc: "Cóctel refrescante con vodka, frambuesa, limón y maracuyá, equilibrado con triple sec y espumante.", img: CDN+"images/items/cfdf6d1d-1437-4160-b407-4ae5efe5c6f4.jpg", price: 7990 },
    { name: "Marea Alta", desc: "Sabores tropicales con ron blanco y negro, crema de coco, limón, pulpa de maracuyá y mango, curaçao.", img: CDN+"images/95670_1709237895366_5.jpeg", price: 7990 },
    { name: "Naranja Mecánica Sour", desc: "Cóctel audaz con gin y Aperol, cítrico del limón y toque herbal de goma de romero.", img: CDN+"images/items/b26f69c9-56d7-4c00-b9df-7a72c4fa9b50.jpg", price: 7990 },
    { name: "Vuelta la Manzana", desc: "Cóctel refrescante con Jack de manzana, limón y goma. Espumante y hielo frappé.", img: CDN+"images/items/b53432e1-ae59-4e60-9e7d-b5c2a6e05066.jpg", price: 7990 },
    { name: "Maracazzotti", desc: "Ramazzotti, maracuyá y Sprite. Mezcla fresca, tropical y llena de sabor.", img: CDN+"images/items/c40840af-ac5c-46ad-a84f-e546b2fa98f7.jpg", price: 8990 },
  ],
  "Tragos": [
    { name: "Promo Red Bull + Pisco Alto 35°", desc: "Dos cortos de Alto de Carmen de 35° + 1 bebida de 350cc + Red Bull de 250cc.", img: CDN+"images/items/0cb992ae-527d-46bc-aefa-7c7ede45aa7b.jpg", price: 10990 },
    { name: "Promo 2 Piscola 35°", desc: "2 cortos de Pisco Alto del Carmen 35° + 2 bebidas 220cc.", img: CDN+"images/95670_1652019106358_612.jpeg", price: 8990 },
    { name: "Promo 2 Mistral 40°", desc: "2 Piscolas de Mistral de 40° + 2 bebidas de 220cc.", img: CDN+"images/items/83c9ab8d-eb38-4c12-bcea-b06aaebf216c.jpg", price: 9990 },
    { name: "Promo 2 Fernet", desc: "2 cortos de Fernet Branca + 1 bebida de 350cc a elección.", img: CDN+"images/items/95548f74-4fbb-4faa-bc1f-1fcdbcfe0a32.jpg", price: 8990 },
    { name: "Promo Ron Habana", desc: "2 cortos de Ron Habana Club Añejo Reserva 40° + bebida 350cc a elección.", img: CDN+"images/items/f127937d-c882-41ae-9dd7-0c327aee1d1e.jpg", price: 8990 },
    { name: "Promo Whisky Clásico", desc: "2 cortos de Whisky Jack Daniel's Negro + 1 bebida de 350cc a elección.", img: CDN+"images/items/1a5bc60f-1ee3-4836-a62e-80cdb1676641.jpg", price: 11990 },
    { name: "Mojito Tradicional", desc: "Clásico refrescante con Ron de Caldas, menta fresca, limón y soda.", img: CDN+"images/items/b0af00b7-e8f2-4785-9790-247b92185958.png", price: 7490 },
    { name: "Mojito Raspberry", desc: "Refrescante mezcla de Bacardi Razz, menta fresca y limón, con frutos rojos.", img: CDN+"images/567642_1655855339490_315.png", price: 7990 },
    { name: "Mojito Jagger", desc: "Refrescante mezcla de Jägermeister, menta fresca y limón. Intenso, herbal y con carácter.", img: CDN+"images/items/832e6078-3be0-495a-8a2a-680ef36754a4.jpg", price: 7990 },
    { name: "Mojito Sabores", desc: "Elige tu sabor: frambuesa, mango o maracuyá. Ron blanco, menta fresca y limón.", img: CDN+"images/95670_1652017343995_317.jpeg", price: 7990 },
    { name: "Mojito Corona", desc: "Mezcla refrescante con el toque burbujeante de Corona. Liviano, fresco y peligrosamente rico.", img: CDN+"images/95670_1709406400021_363.jpeg", price: 8490 },
    { name: "Daiquiri Sabores", desc: "Ron Bacardi blanco, zumo de limón, azúcar flor, fruta natural a elección y hielo frappé.", img: CDN+"images/95918_1652015913380_998.jpeg", price: 7990 },
    { name: "Espresso Martini", desc: "Vodka, licor de café y espresso. Trago elegante, intenso y con un toque de energía.", img: CDN+"images/items/32f3acf3-aa90-4ba2-b399-f9149471c984.jpg", price: 7990 },
    { name: "Ramazzotti", desc: "Ramazzotti Spritz refrescante, burbujeante y con un toque herbal. Perfecto para el aperitivo.", img: CDN+"images/items/093ad0f9-9494-4e01-a289-a48c5716d5cc.jpg", price: 6990 },
    { name: "Aperol Spritz", desc: "Fresco, burbujeante y fácil de tomar. El favorito para partir.", img: CDN+"images/items/3270e81b-2327-4b00-a3aa-af9f862c1226.jpg", price: 6990 },
    { name: "Gin Berries Bull", desc: "Gin, frutos rojos, Red Bull açaí, hielo en cubo y limón de pica.", img: CDN+"images/95918_1697814952767_592.png", price: 8990 },
    { name: "Tropical Gin", desc: "Red Bull tropical, gin y pulpa de maracuyá.", img: CDN+"images/95670_1693324424768_799.jpeg", price: 8990 },
    { name: "Gin Hendricks", desc: "El mejor gin Hendricks con tónica y pepino.", img: CDN+"images/95670_1652020825800_462.jpeg", price: 7990 },
    { name: "Copa de Sangría", desc: "Refrescante mezcla de vino tinto con frutas de la estación. Dulce, fresca y perfecta para cualquier momento.", img: CDN+"images/567676_1655855030583_421.png", price: 5990 },
    { name: "Sour Catedral Peruano", desc: "Hecho con pisco Tabernero Quebranta. Intenso, equilibrado y para los que saben de verdad.", img: CDN+"images/95670_1652017966155_312.jpeg", price: 7990 },
    { name: "Pisco Sour Nacional", desc: "Fresco, cítrico y el favorito de siempre. Hazlo de maracuyá +$1.000.", img: CDN+"images/items/d3132b77-2bf5-4fea-bb7d-1b58ebec4b3e.jpg", price: 4990 },
    { name: "Piña Colada", desc: "El clásico tropical: cremosa, dulce y refrescante. Sabor a playa en cada sorbo.", img: CDN+"images/95670_1652017725761_531.jpeg", price: 7490 },
    { name: "Margarita", desc: "Clásica, fresca y cítrica. El equilibrio perfecto entre tequila y limón.", img: CDN+"images/95670_1652020971956_182.jpeg", price: 6990 },
    { name: "Moscow Mule", desc: "Refrescante mezcla de vodka, lima y ginger beer. Burbujeante, cítrico.", img: CDN+"images/95670_1709406625428_559.jpeg", price: 7990 },
    { name: "London Mule", desc: "Refrescante mezcla de gin, limón y ginger beer. Cítrico, burbujeante.", img: CDN+"images/items/471628ed-48b5-4fa4-b72b-175e52c53ce2.jpg", price: 7990 },
    { name: "Clavo Oxidado", desc: "Whisky y Drambuie en una mezcla intensa, suave y con carácter.", img: CDN+"images/95670_1693322413646_316.jpeg", price: 6990 },
    { name: "Negroni", desc: "Clásico italiano de carácter: intenso, amargo y elegante.", img: CDN+"images/95670_1709406695515_106.jpeg", price: 7990 },
    { name: "Caipiriña", desc: "Trago elaborado con Cachaça 51, gajos de limón sutil, azúcar flor, hielo y rodajas de limón.", img: CDN+"images/items/197accf5-dc2b-4e49-be96-405d2ad95850.jpg", price: 6990 },
    { name: "Jarra de Sangría", desc: "Para compartir: fresca, frutal y perfecta para la mesa. Ideal para grupos.", img: CDN+"images/95670_1652020341704_946.jpeg", price: 16990 },
    { name: "Copa de Espumante", desc: "Valdivieso Brut.", img: CDN+"images/items/451eb25f-e3ff-400f-8631-a80c0b87a52d.jpg", price: 3490 },
    { name: "Corto Whisky + Bebida 250cc", desc: "Jack Daniel's N°7, Apple, Honey. Mejora tu Whisky: Chivas Regal 12 años +$2.490.", img: CDN+"images/items/6bde9fa4-cf1c-4e2a-8d2a-8230957620a7.jpg", price: 6990 },
    { name: "Piscola", desc: "Corto de Piscola Alto del Carmen 35° + bebida de 220cc.", img: CDN+"images/items/2bccb957-5952-4124-9e64-3f283691d054.jpg", price: 4990 },
    { name: "Mistral de 40°", desc: "1 corto de Mistral de 40° + bebida de 220cc.", img: CDN+"images/items/bce5f40a-882a-4b94-bc05-1ce630ea9b62.jpg", price: 5990 },
    { name: "Fernet", desc: "Corto de Fernet Branca + bebida de 220cc.", img: CDN+"images/items/52b45757-3345-4060-846b-f497cb6768ec.jpg", price: 6990 },
    { name: "Ron Habana", desc: "Corto de Ron Habana Club Añejo Reserva + bebida de 220cc.", img: CDN+"images/items/132400db-35b3-4859-ba16-b0b90bb132e7.jpg", price: 5990 },
    { name: "Vodka Stolichnaya", desc: "Corto de Vodka Stolichnaya + bebida de 220cc.", img: CDN+"images/items/b6c26c14-c8d5-4232-a64e-14920c6eec3b.jpg", price: 5990 },
    { name: "Shot Don Julio", desc: "Don Julio Blanco, por excelencia uno de los mejores. Solo para entendidos.", img: CDN+"images/items/5f20007b-0594-4858-bf1e-af0f988d7e73.jpg", price: 4990 },
    { name: "Shot Tequila Olmeca Silver", desc: "Tequila Olmeca Silver. Siempre es un buen momento para un tequila.", img: CDN+"images/items/2fd41442-b6ed-44dd-a7e7-01cc57afaade.jpg", price: 3190 },
  ],
  "Botella Vino, Espumante, Whisky": [
    { name: "Misionero D' Rengo", desc: "Cabernet Sauvignon 375ml 13° GL.", img: CDN+"images/items/6c709e97-0e6b-4fce-ac57-b6ae461faf76.png", price: 6990 },
    { name: "Espumante Valdivieso Brut", desc: "Botella 750cc.", img: CDN+"images/items/b40e05ff-fcb0-4011-ab23-ee09d6b15d1c.jpg", price: 12990 },
    { name: "Espumante Riccadonna Asti", desc: "Espumante italiano 750cc.", img: CDN+"images/items/985e8e09-d1b9-4a8a-8df9-cd4a5bdc27e2.jpg", price: 22990 },
    { name: "Jack Daniel's", desc: "Honey, Apple, Clásico.", img: CDN+"images/items/327c958b-b2fb-44d5-aeef-838f3ab341ed.jpg", price: 59990 },
  ],
  "Mocktail": [
    { name: "Aurelia Italiano", desc: "Aperol Spritz Aurelia 0.0%. Mezcla vibrante de naranjas amargas y hierbas aromáticas, espumante sin alcohol y soda.", img: CDN+"images/items/fd7bbdcf-c0ed-4e2f-90a3-9cbb4846d315.jpg", price: 6490 },
    { name: "Espumante 0.0", desc: "Espumante Undurraga 0.0 alcohol.", img: CDN+"images/items/42b5932d-1738-4629-8cc0-d2fa27942f90.png", price: 3990 },
    { name: "Mojito Sabor", desc: "Maracuyá, frambuesa, mango o chirimoya. Zumo de lima natural, menta fresca y agua con gas.", img: CDN+"images/items/004685dc-6d5a-4cfc-b696-5263ba2ec8e4.png", price: 6990 },
    { name: "Piña Colada 0.0", desc: "Crema de coco fusionada con dulzor refrescante de la piña, sin una gota de alcohol.", img: CDN+"images/items/a31dd8c1-4dda-4cb1-83c9-621240b1956a.png", price: 6490 },
    { name: "Rosato Aurelia", desc: "Aperitivo italiano versión 0.0° Aurelia. Experiencia fresca y sofisticada con aromas a frutas rojas y cítricos.", img: CDN+"images/items/ccc81c71-1430-4e4f-a5fb-3b5c942c2a1c.png", price: 6490 },
    { name: "Mojito Tradicional 0.0", desc: "Zumo de lima natural, menta fresca y agua con gas.", img: CDN+"images/items/2ef327b9-bcff-4778-8a92-b2e5eba81374.png", price: 6490 },
    { name: "Gin Praga & Tonic", desc: "Fresco y aromático, elaborado con una selección de botánicos para emular la experiencia del Gin Praga tradicional.", img: CDN+"images/items/004685dc-6d5a-4cfc-b696-5263ba2ec8e4.png", price: 6990 },
    { name: "Momentum Mule", desc: "Versión sin alcohol del licor chileno Momentum premium de flor de saúco. Experiencia sofisticada, refrescante y consciente.", img: CDN+"images/items/004685dc-6d5a-4cfc-b696-5263ba2ec8e4.png", price: 6990 },
  ],
  "Jugos y bebidas": [
    { name: "Bebida en lata", desc: "Coca Cola, Coca Cola Zero, Fanta o Sprite 350cc.", img: CDN+"images/items/a329f37a-1549-4bf5-b6fe-b674a59de25a.png", price: 2900 },
    { name: "Agua Mineral", desc: "Agua purificada con gas o sin gas.", img: CDN+"images/items/8c445674-fae1-4ed9-ad10-57c32bdc5bd0.jpg", price: 2990 },
    { name: "Ginger Beer", desc: null, img: CDN+"images/items/cedc3f62-a84d-4c21-8708-12ca9b80be37.jpg", price: 3990 },
    { name: "Red Bull Yellow", desc: null, img: CDN+"images/items/1dd9487c-3a6c-43bd-89bb-018eab2c1b2a.png", price: 3490 },
    { name: "Red Bull Purple", desc: null, img: CDN+"images/items/9ea6b4d8-372d-4ffd-ba05-d3fed9b76dae.png", price: 3490 },
    { name: "Red Bull Tradicional", desc: null, img: CDN+"images/items/29190733-b324-44e0-9991-f32795368720.jpg", price: 3490 },
    { name: "Limonada Menta Jengibre", desc: "Limonada menta jengibre de la casa.", img: CDN+"images/96683_1652023257412_67.jpeg", price: 4590 },
    { name: "Jugo Natural", desc: "Elige entre frambuesa, mango, chirimoya o maracuyá.", img: CDN+"images/96683_1652023327530_263.jpeg", price: 4590 },
    { name: "Limonada Coco", desc: "Exquisita limonada con coco natural.", img: CDN+"images/567725_1658009429491_84.png", price: 4690 },
    { name: "Té Twinings", desc: "Té Twinings a elección con tetera de agua caliente personal.", img: CDN+"images/583893_1654481523300_961.png", price: 2970 },
    { name: "Espresso", desc: "Café en grano recién molido 80% robusta 20% arábica.", img: CDN+"images/96683_1656290204164_384.png", price: 2900 },
    { name: "Café Americano", desc: "Café en grano recién molido 80% robusta 20% arábica.", img: CDN+"images/96683_1656420084597_762.jpeg", price: 3200 },
  ],
  "Postres": [
    { name: "Kuchen", desc: "Kuchen artesanal Don Julio. Elige tu favorito: Nuez (intenso, clásico y perfecto para café) o Maracuyá (fresco, ligeramente ácido y adictivo).", img: CDN+"images/items/890db370-b653-44cb-918c-438804bc5644.jpg", price: 3290 },
  ],
};

export async function seedJuana() {
  const existing = await prisma.restaurant.findUnique({ where: { slug: "juana-la-brava" } });
  if (existing) return existing;

  await prisma.restaurantOwner.upsert({
    where: { id: "seed-owner-juana" },
    update: {},
    create: { id: "seed-owner-juana", email: "juana@seed.local", passwordHash: "seed", name: "Juana Seed" },
  });

  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Juana la Brava",
      slug: "juana-la-brava",
      description: "Pizzas, sushi fusión, tragos de autor y más en un ambiente único.",
      cartaTheme: "PREMIUM",
      phone: "+56900000000",
      address: "Mariano Sánchez Fontecilla 11890, Santiago",
      ownerId: "seed-owner-juana",
      bannerUrl: BANNER,
      logoUrl: LOGO,
    },
  });

  const catNames = Object.keys(MENU);
  for (let i = 0; i < catNames.length; i++) {
    const catName = catNames[i];
    const items = MENU[catName];

    const category = await prisma.category.create({
      data: { restaurantId: restaurant.id, name: catName, position: i, isActive: true },
    });

    for (let j = 0; j < items.length; j++) {
      const it = items[j];
      await prisma.dish.create({
        data: {
          restaurantId: restaurant.id,
          categoryId: category.id,
          name: it.name,
          description: it.desc,
          price: it.price,
          photos: [it.img],
          tags: it.rec ? ["RECOMMENDED"] : [],
          isHero: false,
          position: j,
        },
      });
    }
  }

  return restaurant;
}

export async function reseedJuana() {
  const existing = await prisma.restaurant.findUnique({ where: { slug: "juana-la-brava" } });
  if (existing) {
    const rid = existing.id;
    // Use raw SQL to cleanly cascade-delete everything for this restaurant
    await prisma.$executeRaw`DELETE FROM "DishFavorite" WHERE "restaurantId" = ${rid}`;
    await prisma.$executeRaw`DELETE FROM "DishImpression" WHERE "restaurantId" = ${rid}`;
    await prisma.$executeRaw`DELETE FROM "DishIngredient" WHERE "dishId" IN (SELECT id FROM "Dish" WHERE "restaurantId" = ${rid})`;
    await prisma.$executeRaw`DELETE FROM "Review" WHERE "restaurantId" = ${rid}`;
    await prisma.$executeRaw`DELETE FROM "QRUserInteraction" WHERE "restaurantId" = ${rid}`;
    await prisma.$executeRaw`DELETE FROM "ExperienceSubmission" WHERE "experienceId" IN (SELECT id FROM "Experience" WHERE "restaurantId" = ${rid})`;
    await prisma.$executeRaw`DELETE FROM "Experience" WHERE "restaurantId" = ${rid}`;
    await prisma.$executeRaw`DELETE FROM "RestaurantTicket" WHERE "restaurantId" = ${rid}`;
    await prisma.$executeRaw`DELETE FROM "CampaignRecipient" WHERE "campaignId" IN (SELECT id FROM "Campaign" WHERE "restaurantId" = ${rid})`;
    await prisma.$executeRaw`DELETE FROM "Campaign" WHERE "restaurantId" = ${rid}`;
    await prisma.$executeRaw`DELETE FROM "Segment" WHERE "restaurantId" = ${rid}`;
    await prisma.$executeRaw`DELETE FROM "Promotion" WHERE "restaurantId" = ${rid}`;
    await prisma.$executeRaw`DELETE FROM "AutomationRule" WHERE "restaurantId" = ${rid}`;
    await prisma.$executeRaw`DELETE FROM "GenioInsight" WHERE "restaurantId" = ${rid}`;
    await prisma.$executeRaw`DELETE FROM "Session" WHERE "restaurantId" = ${rid}`;
    await prisma.$executeRaw`DELETE FROM "WaiterPushSubscription" WHERE "restaurantId" = ${rid}`;
    await prisma.$executeRaw`DELETE FROM "StatEvent" WHERE "restaurantId" = ${rid}`;
    await prisma.$executeRaw`DELETE FROM "WaiterCall" WHERE "restaurantId" = ${rid}`;
    await prisma.$executeRaw`DELETE FROM "RestaurantPromotion" WHERE "restaurantId" = ${rid}`;
    await prisma.$executeRaw`DELETE FROM "BirthdayCampaign" WHERE "restaurantId" = ${rid}`;
    await prisma.$executeRaw`DELETE FROM "RestaurantScheduleRule" WHERE "restaurantId" = ${rid}`;
    await prisma.$executeRaw`DELETE FROM "Customer" WHERE "restaurantId" = ${rid}`;
    await prisma.$executeRaw`DELETE FROM "ModifierTemplateOption" WHERE "groupId" IN (SELECT id FROM "ModifierTemplateGroup" WHERE "templateId" IN (SELECT id FROM "ModifierTemplate" WHERE "restaurantId" = ${rid}))`;
    await prisma.$executeRaw`DELETE FROM "ModifierTemplateGroup" WHERE "templateId" IN (SELECT id FROM "ModifierTemplate" WHERE "restaurantId" = ${rid})`;
    await prisma.$executeRaw`DELETE FROM "ModifierTemplate" WHERE "restaurantId" = ${rid}`;
    await prisma.$executeRaw`DELETE FROM "_DishToModifierTemplate" WHERE "A" IN (SELECT id FROM "Dish" WHERE "restaurantId" = ${rid})`;
    await prisma.$executeRaw`DELETE FROM "Dish" WHERE "restaurantId" = ${rid}`;
    await prisma.$executeRaw`DELETE FROM "Category" WHERE "restaurantId" = ${rid}`;
    await prisma.$executeRaw`DELETE FROM "RestaurantTable" WHERE "restaurantId" = ${rid}`;
    await prisma.$executeRaw`DELETE FROM "Restaurant" WHERE "id" = ${rid}`;
  }
  return seedJuana();
}
