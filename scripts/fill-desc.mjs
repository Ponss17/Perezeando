import fs from 'node:fs';
import { fold, isEnglishLooking } from './shared.mjs';

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
  'volcan de costa rica',
  'volcan extinto en costa rica',
  'estratovolcan de costa rica',
  'estratovolcan localizado costa rica',
]);

const ONE = {
  volcanes: ['Volcán registrado en el mapa de Costa Rica', 'Volcano recorded on the Costa Rica map'],
  cerros: ['Cerro o elevación del relieve costarricense', 'Hill or highland feature in Costa Rica'],
  parques: ['Parque nacional u área protegida del SINAC', 'National park or SINAC protected area'],
  bosques: ['Área silvestre protegida de Costa Rica', 'Protected wildland area in Costa Rica'],
  cataratas: ['Catarata o salto de agua en territorio costarricense', 'Waterfall in Costa Rican territory'],
  rios: ['Curso de agua que atraviesa territorio costarricense', 'River course through Costa Rican territory'],
  islas: ['Isla o islote del territorio costarricense', 'Island or islet in Costa Rican territory'],
  playas: ['Playa del litoral costarricense', 'Beach on the Costa Rican coast'],
  museos: ['Museo o espacio cultural abierto al público', 'Museum or cultural venue open to visitors'],
  iglesias: ['Templo o iglesia de interés local', 'Church or temple of local interest'],
  arqueologia: ['Sitio arqueológico documentado en Costa Rica', 'Documented archaeological site in Costa Rica'],
  deportes: ['Recinto deportivo de uso público o club', 'Sports venue for public or club use'],
  hitos: ['Lugar de interés geográfico o cultural', 'Place of geographic or cultural interest'],
  ciudades: ['Cantón o centro poblado de Costa Rica', 'Canton or settlement in Costa Rica'],
  gastronomia: ['Puesto o mercado de comida local', 'Local food stall or market'],
  surf: ['Spot de surf del litoral costarricense', 'Surf spot on the Costa Rican coast'],
  aeropuertos: ['Aeródromo o aeropuerto de acceso regional', 'Airfield or airport with regional access'],
  puertos: ['Puerto o terminal marítima de Costa Rica', 'Port or maritime terminal in Costa Rica'],
  submarinas: ['Relieve del fondo marino en aguas costarricenses', 'Seafloor landform in Costa Rican waters'],
  hitosOceanicos: ['Hito oceánico en el mar territorial', 'Ocean landmark in territorial waters'],
  immas: ['Área marina de importancia para mamíferos (IMMA)', 'Important Marine Mammal Area (IMMA)'],
  isras: ['Área marina de relevancia ecológica (ISRA)', 'Important Shark and Ray Area (ISRA)'],
  fauna: ['Especie de fauna marina presente en aguas costarricenses', 'Marine wildlife species in Costa Rican waters'],
  faunaTerrestre: ['Especie de fauna terrestre presente en Costa Rica', 'Terrestrial wildlife species in Costa Rica'],
};



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
  if (/catedral|cathedral/.test(n)) {
    return say(`Catedral o templo principal ${w.es}, de interés cultural local.`, `Main cathedral or church ${w.en}, of local cultural interest.`);
  }
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
    if (/biosfera|biosphere/.test(n)) {
      return say(`Reserva de la biosfera ${w.es}, reconocida por su valor ecológico.`, `Biosphere reserve ${w.en}, recognized for its ecological value.`);
    }
    if (/wetland|humedal/.test(n)) {
      return say(`Humedal protegido ${w.es}, parte de las áreas silvestres del país.`, `Protected wetland ${w.en}, part of the country’s wildland areas.`);
    }
    if (/experimental forest|bosque experimental/.test(n)) {
      return say(`Bosque experimental ${w.es}, orientado a investigación y manejo.`, `Experimental forest ${w.en}, focused on research and management.`);
    }
    if (/corredor biologico|biological corridor/.test(n)) {
      return say(`Corredor biológico ${w.es}, que conecta fragmentos de hábitat.`, `Biological corridor ${w.en} linking habitat fragments.`);
    }
    if (/area de conservacion|conservation area/.test(n)) {
      return say(`Área de conservación ${w.es}, con gestión territorial del SINAC.`, `Conservation area ${w.en} under SINAC territorial management.`);
    }
    if (/santuario/.test(n)) {
      return say(`Santuario de fauna ${w.es}, orientado a la protección de especies.`, `Wildlife sanctuary ${w.en} focused on species protection.`);
    }
  }
  return null;
}

export function fillDesc(p) {
  const cur = String(p.desc?.es || '').trim();
  const brief = BRIEFS[p.id];
  const thin =
    !cur ||
    cur.length < 50 ||
    GENERIC.has(fold(cur)) ||
    isEnglishLooking(cur) ||
    (!!brief && (cur.length <= 55 || isEnglishLooking(cur)));
  if (!thin) return null;
  if (brief?.es && String(brief.es).trim().length >= 50) {
    const out = { es: brief.es, en: brief.en || brief.es };
    if (brief.src?.url && brief.src?.name) out.src = brief.src;
    return out;
  }
  const named = fromName(p);
  if (named) return named;
  const pair = ONE[p.cat];
  if (!pair) return null;
  const w = where(p.prov);
  return {
    es: `${pair[0]} ${w.es}.`,
    en: `${pair[1]} ${w.en}.`,
  };
}
