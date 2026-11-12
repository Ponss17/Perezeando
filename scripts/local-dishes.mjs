import { dishKey } from './shared.mjs';

const gastro = {
  name: 'Wikipedia',
  url: 'https://es.wikipedia.org/wiki/Gastronom%C3%ADa_de_Costa_Rica',
  license: 'CC BY-SA 4.0',
};
const limonWiki = {
  name: 'Wikipedia',
  url: 'https://es.wikipedia.org/wiki/Gastronom%C3%ADa_de_la_provincia_de_Lim%C3%B3n',
  license: 'CC BY-SA 4.0',
};
const nacion = {
  name: 'La Nación',
  url: 'https://www.nacion.com/viva/gastronomia/la-corte-o-el-carmen-esta-es-la-historia-familiar/AZLPA23YRZCFHISTX2GFLJNBI4/story/',
};
const ucr = (slug) => ({
  name: 'UCR · Alimentación y Cultura',
  url: `https://alimentacionycultura.ucr.ac.cr/index.php/alimentacion-cultura-y-celebracion/saberes-y-sabores-ticos/${slug}/`,
});

const dish = (es, en, noteEs, noteEn, src) => ({
  name: { es, en },
  note: { es: noteEs, en: noteEn },
  ...(src ? { src } : {}),
});

export const LOCAL_DISHES = {
  alajuela: [
    dish('Pastelillos', 'Pastelillos', 'Empanada frita de harina con pollo, papa o carne. El bocado del centro de Alajuela.', 'Fried wheat turnover with chicken, potato or beef. Downtown Alajuela’s snack.', nacion),
    dish('Empanadas arregladas', 'Dressed empanadas', 'Empanada de maíz con repollo picado, tomate y salsas. Así se piden: arregladas.', 'Corn empanada topped with chopped cabbage, tomato and sauces.'),
    dish('Crema', 'Sweet cream', 'Crema dulce de leche, espesa y fría, que se vende en vaso junto a los pastelillos.', 'Thick, cold, sweet milk cream, sold by the cup next to the pastelillos.'),
    dish('Queso palmito', 'Palmito cheese', 'Queso en hebras, típico de Zarcero. Se come solo o en un gallo.', 'String cheese from Zarcero, eaten plain or in a tortilla.', gastro),
    dish('Chorreadas', 'Fresh-corn cakes', 'Tortitas de maíz tierno, con natilla y un poco de sal.', 'Cakes of fresh corn, with sour cream and a pinch of salt.', gastro),
    dish('Fresas con crema', 'Strawberries and cream', 'Fresas de Poás, de Poasito y Fraijanes, servidas con crema.', 'Strawberries from Poás (Poasito and Fraijanes), served with cream.'),
    dish('Melcochas', 'Sugar-cane taffy', 'Dulce de tapa de dulce estirado. Tradición de trapiche en San Ramón.', 'Pulled sugar-cane candy, a trapiche tradition in San Ramón.'),
    dish('Picadillo de arracache', 'Arracache hash', 'Picadillo de ese tubérculo, común en turnos y sodas de la provincia.', 'Hash of arracache root, served at town fairs and sodas.', gastro),
    dish('Pozol', 'Corn pozol', 'Bebida espesa de maíz, morada o blanca, dulce y con canela.', 'Thick corn drink, purple or white, sweetened and spiced with cinnamon.', gastro),
    dish('Empanadas de engrudo', 'Engrudo turnovers', 'Empanada horneada de San Pedro de Poás, con relleno dulce de queso y achiote.', 'Baked turnover from San Pedro de Poás, with a sweet cheese filling tinted with achiote.'),
    dish('Café de altura', 'Highland coffee', 'Café de las faldas de Poás, Naranjo, Grecia y Zarcero.', 'Coffee from the slopes of Poás, Naranjo, Grecia and Zarcero.'),
  ],
  sanjose: [
    dish('Chifrijo', 'Chifrijo', 'Arroz, frijoles, chicharrón y pico de gallo. Nació en un bar de San José.', 'Rice, beans, pork crackling and pico de gallo. Born in a San José bar.', gastro),
    dish('Casado', 'Casado', 'Arroz, frijoles, carne, ensalada y plátano. El almuerzo de soda.', 'Rice, beans, meat, salad and plantain: the everyday soda lunch.', gastro),
    dish('Olla de carne', 'Beef stew', 'Caldo de res con elote, yuca, ñampí y verduras.', 'Beef broth with corn on the cob, cassava, yam and vegetables.', gastro),
    dish('Gallo', 'Gallo', 'Tortilla doblada con carne, chorizo, arracache o flor de itabo.', 'A tortilla folded over meat, sausage, arracache or itabo blossom.', gastro),
    dish('Chicharrón', 'Pork crackling', 'Chicharrón crocante, muy pedido en Aserrí y en las ferias.', 'Crisp pork crackling, a favorite in Aserrí and at fairs.'),
    dish('Picadillo de chicasquil', 'Chicasquil hash', 'Picadillo de la hoja, clásico de las fiestas de Escazú.', 'Hash of chicasquil leaves, a staple of the Escazú fair.'),
    dish('Café de Tarrazú', 'Tarrazú coffee', 'Café de altura de Tarrazú, Dota y León Cortés.', 'High-grown coffee from Tarrazú, Dota and León Cortés.'),
    dish('Caramelos de chiverre', 'Chiverre candy', 'Dulce de Semana Santa, muy de Santa María de Dota.', 'Holy Week candy, especially from Santa María de Dota.'),
    dish('Tamal', 'Tamal', 'Masa de maíz con carne y arroz, en hoja de plátano. El de diciembre.', 'Corn dough with meat and rice, in a plantain leaf. The December one.', gastro),
    dish('Prestíños', 'Prestíños', 'Hojaldre frito con miel de tapa de dulce, de fin de año.', 'Fried pastry with sugar-cane syrup, a year-end sweet.', gastro),
  ],
  cartago: [
    dish('Queso Turrialba', 'Turrialba cheese', 'Queso fresco de las faldas del volcán. Tiene denominación de origen.', 'Fresh cheese from the volcano’s slopes, with a protected origin name.', ucr('saberes-y-sabores-ticos-cartago')),
    dish('Tamal asado', 'Baked tamal', 'Tamal dulce de maíz, horneado. Muy de Paraíso y del Valle del Guarco.', 'Sweet corn tamal, baked. A Paraíso and Valle del Guarco specialty.'),
    dish('Torrejas', 'Torrejas', 'Pan remojado en leche y huevo, frito y bañado en miel.', 'Bread soaked in milk and egg, fried and dipped in syrup.', gastro),
    dish('Fresas con crema', 'Strawberries and cream', 'Fresas de Llano Grande y Cervantes, servidas con crema.', 'Strawberries from Llano Grande and Cervantes, served with cream.'),
    dish('Papas con natilla', 'Potatoes and sour cream', 'Papas de Tierra Blanca, en picadillo o con natilla.', 'Potatoes from Tierra Blanca, as a hash or with sour cream.'),
    dish('Trucha', 'Trout', 'Trucha de los ríos de Orosi y Cachí, frita o al ajillo.', 'Trout from the Orosi and Cachí rivers, fried or with garlic.'),
    dish('Picadillo de boda', 'Wedding hash', 'Picadillo de fiesta, con chayote, carne desmechada y verdura.', 'A celebration hash of chayote, shredded meat and greens.'),
    dish('Empanadas de chiverre', 'Chiverre turnovers', 'Empanadas dulces de Semana Santa, rellenas de miel de chiverre.', 'Sweet Holy Week turnovers filled with chiverre preserve.', gastro),
  ],
  heredia: [
    dish('Fresas con crema', 'Strawberries and cream', 'Fresas de Barva, San Rafael y San Isidro, con crema.', 'Strawberries from Barva, San Rafael and San Isidro, with cream.'),
    dish('Café chorreado', 'Cloth-brewed coffee', 'Café de la zona de Barva, colado en chorreador de tela.', 'Coffee from the Barva area, brewed in a cloth bag.', gastro),
    dish('Picadillo de palmito', 'Heart-of-palm hash', 'Palmito picado y fresco, de la zona de Sarapiquí.', 'Chopped fresh heart of palm, from the Sarapiquí area.', gastro),
    dish('Chorreadas', 'Fresh-corn cakes', 'Tortitas de maíz nuevo, con natilla.', 'Cakes of fresh corn, served with sour cream.', gastro),
    dish('Flor de itabo', 'Itabo blossom', 'La flor en huevo o en picadillo, de la época seca.', 'The blossom scrambled with egg or in a hash, in the dry season.', gastro),
    dish('Queso fresco', 'Fresh cheese', 'Queso tierno de las fincas lecheras del norte de Heredia.', 'Soft cheese from the dairy farms of northern Heredia.', gastro),
    dish('Agua dulce', 'Agua dulce', 'Bebida caliente de tapa de dulce, compañera del café.', 'Hot drink of sugar-cane syrup, served with coffee.', gastro),
    dish('Tamalitos de elote', 'Sweet corn tamales', 'Tamal pequeño y dulce de elote tierno, envuelto en hoja.', 'Small sweet tamal of tender corn, wrapped in a leaf.', gastro),
  ],
  guanacaste: [
    dish('Rosquillas', 'Rosquillas', 'Rosca de maíz y queso, horneada, salada o dulce.', 'Baked ring of corn and cheese, savory or sweet.', gastro),
    dish('Tanelas', 'Tanelas', 'Galleta gruesa de maíz, para el café o el atol.', 'Thick corn cookie, eaten with coffee or atol.', gastro),
    dish('Perrerreque', 'Perrerreque', 'Panecillo dulce de maíz tierno y queso.', 'Sweet bun of fresh corn and cheese.', gastro),
    dish('Yoltamal', 'Yoltamal', 'Tamal de elote tierno, envuelto en su hoja.', 'Tamal of tender corn, wrapped in the husk.', gastro),
    dish('Arroz de maíz', 'Corn rice', 'Guiso dulce de maíz quebrado, con leche o tapa de dulce.', 'Sweet stew of cracked corn, with milk or sugar-cane syrup.', gastro),
    dish('Queso Bagaces', 'Bagaces cheese', 'Queso seco, salado y a veces ahumado. Se desmiga al apretarlo.', 'Dry, salty cheese, sometimes smoked. It crumbles when pressed.', ucr('saberes-y-sabores-ticos-guanacaste')),
    dish('Tamal guanacasteco', 'Guanacaste tamal', 'Tamal grande, con masa, arroz, cerdo y verdura.', 'A large tamal of dough, rice, pork and vegetables.', gastro),
    dish('Pinolillo', 'Pinolillo', 'Bebida de maíz tostado molido con cacao.', 'Drink of toasted ground corn and cacao.', gastro),
    dish('Chicheme', 'Chicheme', 'Bebida de maíz morado, jengibre y tapa de dulce.', 'Purple-corn drink with ginger and sugar-cane syrup.', gastro),
    dish('Vino de coyol', 'Coyol wine', 'Savia fermentada de la palma de coyol. Solo hay en temporada.', 'Fermented sap of the coyol palm. Only in season.', gastro),
    dish('Cuajada', 'Fresh curds', 'Cuajada de la bajura, con tortilla palmeada.', 'Fresh curds from the lowlands, with a hand-patted tortilla.', gastro),
  ],
  puntarenas: [
    dish('Churchill', 'Churchill', 'Granizado del malecón: hielo, jarabe, leche en polvo y leches.', 'Shaved ice from the boardwalk, with syrup, powdered milk and condensed milk.', gastro),
    dish('Ceviche', 'Ceviche', 'Corvina u otro pescado del día, con limón, culantro y chile.', 'Corvina or the day’s catch, with lime, cilantro and chili.', gastro),
    dish('Arroz guacho', 'Soupy seafood rice', 'Arroz caldoso de mariscos: camarón, calamar o pescado.', 'Soupy rice with shrimp, squid or fish.', gastro),
    dish('Pescado frito', 'Fried fish', 'Pescado entero frito, con patacones y ensalada.', 'Whole fried fish with fried plantain and salad.', gastro),
    dish('Piangua', 'Piangua clam', 'Almeja del manglar, en ceviche. Típica de Sierpe, Osa y Golfito.', 'Mangrove clam, served as ceviche. Typical of Sierpe, Osa and Golfito.', gastro),
    dish('Cambute', 'Cambute conch', 'Caracol del Pacífico sur, en ceviche o guisado.', 'Southern Pacific conch, as ceviche or in a stew.', gastro),
    dish('Chuchecas', 'Chucheca clams', 'Almeja grande del golfo, al ajillo o en sopa.', 'Large gulf clam, with garlic or in a soup.', gastro),
    dish('Olla de mariscos', 'Seafood stew', 'Sopa del puerto con lo que llegó en la lancha.', 'Harbor soup made with whatever the boat brought in.', gastro),
    dish('Cóctel de frutas', 'Fruit cup', 'Vaso de frutas picadas del Paseo de los Turistas.', 'Cup of chopped fruit from the Paseo de los Turistas.'),
  ],
  limon: [
    dish('Rice and beans', 'Rice and beans', 'Arroz y frijoles rojos cocidos con leche de coco. No es gallo pinto.', 'Rice and red beans cooked in coconut milk. Not the same as gallo pinto.', limonWiki),
    dish('Rondón', 'Rundown', 'Guiso de pescado o carne en leche de coco, con tubérculos y dumplings.', 'Fish or meat stewed in coconut milk, with roots and dumplings.', limonWiki),
    dish('Patí', 'Patty', 'Empanada de harina, picante, rellena de carne. Se come de camino.', 'Spicy meat turnover in wheat dough. Eaten on the go.', limonWiki),
    dish('Pan bon', 'Pan bon', 'Pan negro especiado, con frutas y un toque de azúcar quemada.', 'Dark spiced bread with fruit and a touch of burnt sugar.', limonWiki),
    dish('Agua de sapo', 'Agua de sapo', 'Fresco de tapa de dulce, limón y jengibre. También le dicen hiel.', 'Cooler of sugar-cane syrup, lime and ginger. Also called hiel.', limonWiki),
    dish('Plantintá', 'Plantain tart', 'Tarta de plátano maduro, con canela y coco.', 'Ripe-plantain tart with cinnamon and coconut.', limonWiki),
    dish('Pollo caribeño', 'Caribbean chicken', 'Pollo guisado con especias, coco y chile panameño.', 'Chicken stewed with spices, coconut and hot chili.', limonWiki),
    dish('Pescado frito', 'Fried fish', 'Pescado frito en aceite de coco, con patacones.', 'Fish fried in coconut oil, with fried plantain.', limonWiki),
    dish('Resbaladera', 'Resbaladera', 'Bebida de arroz y cebada, con canela y nuez moscada.', 'Rice-and-barley drink with cinnamon and nutmeg.', limonWiki),
    dish('Cacao de Talamanca', 'Talamanca cacao', 'Chocolate de cacao local, a veces sin azúcar, con plátano maduro.', 'Chocolate from local cacao, sometimes unsweetened, with ripe plantain.', limonWiki),
  ],
};

const DROP = new Set(['crema agria', 'salsa lizano', 'leche de coco']);

export { dishKey };

function takeMedia(hit, w) {
  if (!hit.img && w.img) hit.img = w.img;
  if (!hit.qid && w.qid) hit.qid = w.qid;
  if (!hit.src && w.src) hit.src = w.src;
}

export function mergeDishes(wikiItems, localItems, mediaPool = []) {
  const locals = localItems.map((d) => ({ scope: 'regional', ...d }));
  const by = new Map(locals.map((d) => [dishKey(d.name), d]));
  for (const w of mediaPool) {
    const hit = by.get(dishKey(w.name));
    if (hit) takeMedia(hit, w);
  }
  const rest = [];
  for (const w of wikiItems || []) {
    const k = dishKey(w.name);
    if (DROP.has(k)) continue;
    const hit = by.get(k);
    if (hit) takeMedia(hit, w);
    else rest.push(w);
  }
  return [...locals, ...rest];
}
