import { prisma } from "@/lib/prisma";

const CDN = "https://cdn.bistrify.app/";
const LOGO = CDN + "images/juanalabrava_1651096765217_453.png";
const BANNER = "https://cdn.bistrify.app/cdn-cgi/image/w=800,h=400,fit=cover/images/juanalabrava_1652024736505_749.png";

interface Item { name: string; desc: string | null; img: string; price: number; rec?: boolean }

const MENU: Record<string, Item[]> = {
  "Pizza": [
    { name: "Camarón que se Duerme", desc: "Salsa de tomate, queso mozzarella, camarón, cebollin y queso crema", img: CDN+"images/561289_1653154010049_593.png", price: 15990, rec: true },
    { name: "Me haces palta", desc: "Salsa de tomate, queso mozzarella, carne mechada y palta", img: CDN+"images/567697_1653154202062_110.png", price: 13990 },
    { name: "Locura de Juana", desc: "Salsa de tomate, queso mozzarella, jamón serrano, cebolla caramelizada y palta", img: CDN+"images/567695_1653154308352_991.png", price: 14990, rec: true },
    { name: "Carnivora Enjaulada", desc: "Salsa de tomate, queso mozzarella, carne mechada, pepperoni y tocino", img: CDN+"images/561288_1653153916454_94.png", price: 13990 },
    { name: "Pesto Margarita", desc: null, img: CDN+"images/567699_1653154064868_533.png", price: 12990 },
    { name: "Pal Monte", desc: "Salsa de tomate, queso mozzarella, jamón serrano, tomate cherry y rúcula", img: CDN+"images/567698_1653153943018_850.png", price: 14990 },
    { name: "Sueño Veggie", desc: "Salsa de tomate, queso mozzarella, champiñón, choclo, tomate cherry y cebolla caramelizada", img: CDN+"images/567700_1653154263755_383.png", price: 8990 },
    { name: "Arma tu pizza", desc: "Elige tus ingredientes favoritos", img: CDN+"images/95669_1658683705707_242.jpeg", price: 10990 },
  ],
  "Sushi": [
    { name: "Tartar Roll", desc: null, img: CDN+"images/items/c7ea4c13-bd38-4f92-9d7c-075617b115be.png", price: 8990 },
    { name: "Flama Roll", desc: null, img: CDN+"images/items/ace47192-7059-4fa3-b472-b52c9ead9965.png", price: 9990, rec: true },
    { name: "Parrillero Roll", desc: null, img: CDN+"images/items/d6793a2a-1e4c-4427-9816-2a97082ab4aa.png", price: 9990 },
    { name: "Tsunami Roll", desc: null, img: CDN+"images/items/784dede9-4042-4f58-88d6-c2553253fc82.png", price: 8990 },
    { name: "Protein Roll (sin arroz)", desc: null, img: CDN+"images/items/ee491ffd-6d13-4b19-bc2f-a0fc02a11897.png", price: 8990 },
    { name: "Tempura Acevichado", desc: null, img: CDN+"images/items/0f9edccf-5f1a-4501-a98a-2373fdedc934.png", price: 7990 },
    { name: "Ebi Acevichado", desc: null, img: CDN+"images/items/42a1184f-d276-4568-a1f8-22c3ee0982ac.png", price: 7990 },
    { name: "Tori Hot", desc: "Pollo teriyaki, queso crema y cebollín envuelto en panko", img: CDN+"images/items/16e32525-71c2-41da-a510-e873142a2d95.png", price: 7490 },
    { name: "Tuna Nikkei", desc: null, img: CDN+"images/items/afbff731-7ba5-4962-b493-7d74e7aaa6cb.jpg", price: 9990 },
    { name: "Delicius", desc: null, img: CDN+"images/items/ef5cb1e8-4862-4939-a5a7-9f9c07b1d79f.png", price: 8990 },
    { name: "Elixir", desc: null, img: CDN+"images/items/3b795dab-670d-4b2c-80b4-efd50fc67b68.jpg", price: 9990 },
    { name: "Cangrejo Roll", desc: null, img: CDN+"images/items/26d23e33-0f34-443a-a0c4-bbb717522d37.jpg", price: 8990 },
    { name: "Fuki Tempura (sin arroz)", desc: null, img: CDN+"images/95671_1652496570679_684.png", price: 8490 },
    { name: "Osaka Keto", desc: "Roll Keto, relleno de camarón, salmón, queso crema y palta envuelto en salmón", img: CDN+"images/items/113fbda6-d64a-4c09-b37b-64f974680b75.png", price: 9990 },
    { name: "Kobu Nikkei", desc: null, img: CDN+"images/items/3815b0b1-9c74-40a4-a056-a807e01a6bb4.png", price: 8990 },
    { name: "Avocado", desc: "Salmón, queso crema, palta y ciboulette envuelto en palta", img: CDN+"images/95671_1651103573511_389.jpeg", price: 7990 },
    { name: "Montañita", desc: null, img: CDN+"images/95671_1651102849895_140.jpeg", price: 8490 },
    { name: "Ebi Panko", desc: "Camarón, queso crema y ciboulette envuelto en panko", img: CDN+"images/95671_1651103015674_171.jpeg", price: 7990 },
    { name: "Tori Palta", desc: "Pollo teriyaki, queso crema y ciboulette envuelto en palta", img: CDN+"images/95671_1651102446570_946.jpeg", price: 6990 },
    { name: "Camote Nikkei (Vegano)", desc: "Camote tempura, champiñón, palta y ciboulette envuelto en palta", img: CDN+"images/95671_1652496127375_235.png", price: 7990 },
    { name: "Palmi Hot (Vegano)", desc: "Palmito, champiñón, palta y ciboulette envuelto en tempura vegano", img: CDN+"images/95671_1652496250390_601.png", price: 7990 },
    { name: "Bora Bora (sin arroz)", desc: null, img: CDN+"images/95671_1652496462043_474.png", price: 8490 },
  ],
  "Para compartir": [
    { name: "Chiken Street", desc: null, img: CDN+"images/items/a6f30c05-8e64-4d10-aafd-ed7c38927552.png", price: 9990 },
    { name: "Dumpling Camarón", desc: null, img: CDN+"images/items/384aad9f-e234-4270-9336-18c52858f450.jpg", price: 7990 },
    { name: "Dumpling de Cerdo", desc: null, img: CDN+"images/items/36cc47f1-3abd-4b53-a2cd-4b809884ff44.jpg", price: 6990 },
    { name: "Empanaditas Mechada Queso", desc: null, img: CDN+"images/items/e86e2172-186a-4f7e-81d5-3d213f49021f.jpg", price: 5990 },
    { name: "Crispy Rice", desc: null, img: CDN+"images/items/2dcb2ef6-8320-4257-8ba0-2fa4f7aeca47.jpg", price: 6990 },
    { name: "Nigiri de salmón acevichado", desc: "4 nigiris de salmón con salsa acevichada y ciboulette", img: CDN+"images/95874_1651337389339_598.jpeg", price: 5990 },
    { name: "Sashimi", desc: "5 cortes de salmón fresco", img: CDN+"images/562828_1653153250618_291.png", price: 6990 },
    { name: "Tabla de Nigiris", desc: null, img: CDN+"images/items/c27007bb-d9fa-4788-a381-2b61dedbbcde.jpg", price: 9990 },
  ],
  "Hamburguesas": [
    { name: "Jack Sparrow", desc: null, img: CDN+"images/110781_1667961221014_699.jpeg", price: 8990 },
    { name: "Italiano", desc: null, img: CDN+"images/110781_1673962294661_931.jpeg", price: 7990 },
    { name: "Jackson", desc: null, img: CDN+"images/110781_1667961094357_594.jpeg", price: 8990 },
    { name: "Coyote", desc: null, img: CDN+"images/110781_1667961152493_526.jpeg", price: 8490 },
    { name: "Kevin Bacon", desc: null, img: CDN+"images/110781_1667961277145_232.jpeg", price: 9490 },
    { name: "Classic Jack", desc: "Pollo frito al estilo americano, queso cheddar, tomate, lechuga y salsa jack", img: CDN+"images/110781_1676563704265_51.jpeg", price: 8990 },
    { name: "Chicken Tenders", desc: "6 pechugas de pollo frito con 2 salsas de la casa", img: CDN+"images/110781_1667996175407_871.jpeg", price: 7490 },
  ],
  "Ceviche y Gohan": [
    { name: "Ceviche Nikkei", desc: null, img: CDN+"images/items/4c7edd1d-e177-4cea-91dc-498c7f3368ac.jpg", price: 9990 },
    { name: "Gohan Protein", desc: null, img: CDN+"images/567706_1663810853196_840.png", price: 7990 },
    { name: "Gohan Goku", desc: null, img: CDN+"images/567704_1653153513579_231.png", price: 6990 },
    { name: "Gohan Kame House", desc: null, img: CDN+"images/567705_1653153525811_94.png", price: 6990 },
    { name: "Gohan Vegeta", desc: "Champiñón tempura, queso crema, palta, choclo y camote frito", img: CDN+"images/567707_1663810910021_781.png", price: 5490 },
  ],
  "Papas": [
    { name: "Papas Fritas Clásicas", desc: "Las clásicas papitas que no pueden faltar", img: CDN+"images/items/51ed1872-44ba-4230-b1af-6e3179d270b5.jpg", price: 5990 },
    { name: "Papas Supreme para 2", desc: null, img: CDN+"images/items/aa3f7244-e457-4dc0-a0d4-942872530dea.jpg", price: 12990 },
    { name: "Papas Camarón para 2", desc: null, img: CDN+"images/items/41800e48-898f-4062-937c-cb8b70b2a4df.jpg", price: 14990 },
    { name: "Papas Palta Mechada para 2", desc: "Papas fritas con carne mechada, palta, salsa cheddar y cebolla caramelizada", img: CDN+"images/items/e4257a86-74cd-4230-923e-03978070ce8c.jpg", price: 13990 },
    { name: "Papas Chingonas", desc: null, img: CDN+"images/95874_1651337162027_394.jpeg", price: 9990 },
  ],
  "Tablas": [
    { name: "Tabla de sushi para 2", desc: "Tempura Acevichado, Tori Palta, Dumpling y Nigiris", img: CDN+"images/items/fd884ad7-3149-4712-8488-547574056ad4.jpg", price: 29990 },
    { name: "Tabla de sushi para 4", desc: null, img: CDN+"images/items/1249cd3a-6199-42e4-87cc-ae772a77d4c6.jpg", price: 49990 },
  ],
  "Tragos de autor": [
    { name: "Encanto Rosa", desc: null, img: CDN+"images/95670_1709237908731_631.jpeg", price: 6990 },
    { name: "Loro Loco", desc: null, img: CDN+"images/items/a5435070-062b-48c8-8c97-4337224093c7.jpg", price: 7490 },
    { name: "Sexy Juana", desc: null, img: CDN+"images/items/cfdf6d1d-1437-4160-b407-4ae5efe5c6f4.jpg", price: 7490 },
    { name: "Marea Alta", desc: null, img: CDN+"images/95670_1709237895366_5.jpeg", price: 7490 },
    { name: "Naranja Mecánica Sour", desc: null, img: CDN+"images/items/b26f69c9-56d7-4c00-b9df-7a72c4fa9b50.jpg", price: 6990 },
    { name: "Vuelta la Manzana", desc: null, img: CDN+"images/items/b53432e1-ae59-4e60-9e7d-b5c2a6e05066.jpg", price: 7490 },
  ],
  "Tragos": [
    { name: "Mojito tradicional", desc: "Ron, menta fresca, limón y soda", img: CDN+"images/items/b0af00b7-e8f2-4785-9790-247b92185958.png", price: 7990 },
    { name: "Mojito Raspberry", desc: null, img: CDN+"images/567642_1655855339490_315.png", price: 7990 },
    { name: "Mojito Sabores", desc: "Frambuesa, mango o maracuyá", img: CDN+"images/95670_1652017343995_317.jpeg", price: 8490 },
    { name: "Aperol Spritz", desc: "Fresco, burbujeante y fácil de tomar", img: CDN+"images/items/3270e81b-2327-4b00-a3aa-af9f862c1226.jpg", price: 7490 },
    { name: "Espresso Martini", desc: null, img: CDN+"images/items/32f3acf3-aa90-4ba2-b399-f9149471c984.jpg", price: 6990 },
    { name: "Pisco Sour Nacional", desc: null, img: CDN+"images/items/d3132b77-2bf5-4fea-bb7d-1b58ebec4b3e.jpg", price: 5490 },
    { name: "Margarita", desc: null, img: CDN+"images/95670_1652020971956_182.jpeg", price: 6990 },
    { name: "Moscow Mule", desc: null, img: CDN+"images/95670_1709406625428_559.jpeg", price: 7490 },
    { name: "Negroni", desc: "Clásico italiano: intenso, amargo y elegante", img: CDN+"images/95670_1709406695515_106.jpeg", price: 7990 },
  ],
  "Cervezas": [
    { name: "Schop LOA Otra Ronda", desc: null, img: CDN+"images/items/693e7b3e-9900-4e41-a11b-770b79840107.jpg", price: 5490 },
    { name: "Schop LOA Entre Nubes", desc: "Lager suave y refrescante", img: CDN+"images/items/6513c1bf-8862-44ee-a539-e7ac4c49f715.jpg", price: 6290 },
    { name: "Michelada", desc: null, img: CDN+"images/567720_1678383607283_344.jpeg", price: 4290 },
    { name: "Corona", desc: "Botella 355cc", img: CDN+"images/567715_1697642218815_34.jpeg", price: 3990 },
    { name: "Heineken", desc: "Botella 350cc", img: CDN+"images/567717_1697642304376_607.jpeg", price: 3990 },
    { name: "Austral Calafate", desc: "Botella 330cc", img: CDN+"images/567716_1697642264761_959.jpeg", price: 3990 },
  ],
  "Jugos y bebidas": [
    { name: "Limonada menta jengibre", desc: null, img: CDN+"images/96683_1652023257412_67.jpeg", price: 3690 },
    { name: "Jugo Natural", desc: "Frambuesa, Mango, Chirimoya o Maracuyá", img: CDN+"images/96683_1652023327530_263.jpeg", price: 4690 },
    { name: "Limonada Coco", desc: "Limonada con coco natural", img: CDN+"images/567725_1658009429491_84.png", price: 2970 },
    { name: "Bebida en lata", desc: "Coca Cola, Zero, Fanta o Sprite 350cc", img: CDN+"images/items/a329f37a-1549-4bf5-b6fe-b674a59de25a.png", price: 2990 },
    { name: "Agua Mineral", desc: "Con gas o sin gas", img: CDN+"images/items/8c445674-fae1-4ed9-ad10-57c32bdc5bd0.jpg", price: 1990 },
  ],
  "Postres": [
    { name: "Kuchen", desc: "Kuchen artesanal: Nuez o Maracuyá", img: CDN+"images/items/890db370-b653-44cb-918c-438804bc5644.jpg", price: 6490 },
  ],
};

export async function seedJuana() {
  const existing = await prisma.restaurant.findUnique({ where: { slug: "juana-la-brava" } });
  if (existing) return existing;

  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Juana la Brava",
      slug: "juana-la-brava",
      description: "Pizzas, sushi fusión, tragos de autor y hamburguesas en un ambiente único.",
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
    await prisma.review.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.statEvent.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.waiterCall.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.restaurantPromotion.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.birthdayCampaign.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.restaurantScheduleRule.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.customer.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.dish.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.category.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.restaurantTable.deleteMany({ where: { restaurantId: existing.id } });
    await prisma.restaurant.delete({ where: { id: existing.id } });
  }
  return seedJuana();
}
