import fs from 'node:fs';

const BRIEFS = JSON.parse(fs.readFileSync(new URL('./data/briefs.json', import.meta.url), 'utf8'));

const PROV = {
  sanjose: ['San José', 'San José'],
  alajuela: ['Alajuela', 'Alajuela'],
  cartago: ['Cartago', 'Cartago'],
  heredia: ['Heredia', 'Heredia'],
  guanacaste: ['Guanacaste', 'Guanacaste'],
  puntarenas: ['Puntarenas', 'Puntarenas'],
  limon: ['Limón', 'Limón'],
};

const GENERIC = new Set([
  'canton de costa rica',
  'rio en costa rica',
  'montana en costa rica',
  'area protegida en costa rica',
  'area protegida de costa rica',
  'isla en costa rica',
  'reserva natural en costa rica',
  'recinto deportivo',
  'recinto deportivo en costa rica',
  'estadio de futbol en costa rica',
  'estadio de futbol costarricense',
  'infrastructura deportiva',
  'parque nacional en costa rica',
]);

const ONE = {
  volcanes: ['Volcán', 'Volcano'],
  cerros: ['Cerro', 'Peak'],
  parques: ['Parque nacional', 'National park'],
  bosques: ['Área silvestre', 'Protected area'],
  cataratas: ['Catarata', 'Waterfall'],
  rios: ['Río', 'River'],
  islas: ['Isla', 'Island'],
  playas: ['Playa', 'Beach'],
  museos: ['Museo', 'Museum'],
  iglesias: ['Iglesia', 'Church'],
  arqueologia: ['Sitio arqueológico', 'Archaeological site'],
  deportes: ['Recinto deportivo', 'Sports ground'],
  hitos: ['Lugar de interés', 'Place of interest'],
  ciudades: ['Cantón', 'Canton'],
  gastronomia: ['Puesto de comida', 'Food stop'],
  surf: ['Spot de surf', 'Surf spot'],
  aeropuertos: ['Aeropuerto', 'Airport'],
  puertos: ['Puerto', 'Port'],
};

const fold = (x) =>
  String(x || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

function where(prov) {
  if (prov === 'mar' || !PROV[prov]) {
    return { es: 'en el mar territorial de Costa Rica', en: 'in Costa Rican territorial waters' };
  }
  const [es, en] = PROV[prov];
  return { es: `en la provincia de ${es}`, en: `in ${en} Province` };
}

function say(es, en) {
  return { es, en };
}

function fromName(p) {
  const n = fold(p.name?.es || p.name?.en || '');
  const w = where(p.prov);
  if (/catedral|cathedral/.test(n)) return say(`Catedral ${w.es}.`, `Cathedral ${w.en}.`);
  if (p.cat === 'bosques' || /refuge|reserve|protected|wetland|humedal|refugio|reserva|zona protectora|biosfera|corredor|conservacion|santuario/.test(n)) {
    if ((/mixed/.test(n) || /mixto/.test(n)) && /refuge|refugio/.test(n)) {
      return say(
        `Refugio de vida silvestre mixto ${w.es}. Forma parte de las áreas silvestres protegidas del país.`,
        `Mixed wildlife refuge ${w.en}. It is part of Costa Rica's protected areas.`,
      );
    }
    if (/wildlife refuge|refugio de vida|refugio nacional/.test(n)) {
      return say(
        `Refugio de vida silvestre ${w.es}. Forma parte de las áreas silvestres protegidas del país.`,
        `Wildlife refuge ${w.en}. It is part of Costa Rica's protected areas.`,
      );
    }
    if (/protected zone|zona protectora/.test(n)) {
      return say(
        `Zona protectora ${w.es}. Forma parte de las áreas silvestres protegidas del país.`,
        `Protected zone ${w.en}. It is part of Costa Rica's protected areas.`,
      );
    }
    if (/forest reserve|reserva forestal/.test(n)) {
      return say(
        `Reserva forestal ${w.es}. Forma parte de las áreas silvestres protegidas del país.`,
        `Forest reserve ${w.en}. It is part of Costa Rica's protected areas.`,
      );
    }
    if (/biological reserve|reserva biologica/.test(n)) {
      return say(
        `Reserva biológica ${w.es}. Forma parte de las áreas silvestres protegidas del país.`,
        `Biological reserve ${w.en}. It is part of Costa Rica's protected areas.`,
      );
    }
    if (/biosfera|biosphere/.test(n)) return say(`Reserva de la biosfera ${w.es}.`, `Biosphere reserve ${w.en}.`);
    if (/wetland|humedal/.test(n)) return say(`Humedal protegido ${w.es}.`, `Protected wetland ${w.en}.`);
    if (/experimental forest|bosque experimental/.test(n)) return say(`Bosque experimental ${w.es}.`, `Experimental forest ${w.en}.`);
    if (/corredor biologico|biological corridor/.test(n)) return say(`Corredor biológico ${w.es}.`, `Biological corridor ${w.en}.`);
    if (/area de conservacion|conservation area/.test(n)) return say(`Área de conservación ${w.es}.`, `Conservation area ${w.en}.`);
    if (/santuario/.test(n)) return say(`Santuario de fauna ${w.es}.`, `Wildlife sanctuary ${w.en}.`);
  }
  return null;
}

/** Sustituye una ficha vacía o genérica. Devuelve null si el texto actual se queda. */
export function fillDesc(p) {
  const cur = String(p.desc?.es || '').trim();
  const brief = BRIEFS[p.id];
  const thin = !cur || GENERIC.has(fold(cur)) || (!!brief && cur.length <= 45);
  if (!thin) return null;
  if (brief?.es) return { es: brief.es, en: brief.en || brief.es };
  const named = fromName(p);
  if (named) return named;
  const pair = ONE[p.cat];
  if (!pair) return null;
  const w = where(p.prov);
  return { es: `${pair[0]} ${w.es}.`, en: `${pair[1]} ${w.en}.` };
}
