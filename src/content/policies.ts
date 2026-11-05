import type { Lang } from '../data/types';

export interface PolicySection {
  h: string;
  p?: string[];
  items?: string[];
}

export interface PolicyCopy {
  title: string;
  lede: string;
  sections: PolicySection[];
}

const es: PolicyCopy = {
  title: 'Políticas de uso y derechos de autor',
  lede: 'Perezeando es un atlas de consulta sobre Costa Rica. Acá se dice de quién es cada contenido, para qué sirve el sitio y qué datos quedan en el navegador.',
  sections: [
    {
      h: 'Qué es este sitio',
      p: [
        'Perezeando reúne lugares del territorio continental y del mar territorial: naturaleza, cultura, deporte, gastronomía y transporte. Sirve para consultarlos en un mapa.',
        'No es un sitio oficial del Estado, no administra los lugares que muestra y no vende entradas ni servicios.',
      ],
    },
    {
      h: 'Uso informativo',
      p: [
        'La información es de consulta. Un horario, un sendero, una carretera o el estado de un parque pueden cambiar. Las distancias y los tiempos de ruta son estimaciones. Si el servicio de rutas no responde, el trazado queda en línea recta.',
        'Conviene revisar el estado del camino y los avisos de quien administra el lugar antes de salir.',
      ],
    },
    {
      h: 'Derechos de autor',
      p: [
        'Los derechos de los mapas, las fotografías, los artículos y las bases de datos pertenecen a sus autores. Se usan con la licencia de cada uno. Perezeando no se atribuye ese material.',
        'Las descripciones escritas para este atlas son de Perezeando. Cuando una ficha muestra un extracto de Wikipedia, ese texto es de sus autores y la ficha enlaza el artículo.',
        'Cada fotografía indica el autor y la licencia. Esa atribución hay que conservarla si se reutiliza la imagen.',
      ],
    },
    {
      h: 'Mapas, fotos y textos',
      items: [
        'Límites provinciales: geoBoundaries (gbOpen CRI ADM1), derivado de OpenStreetMap, ODbL 1.0.',
        'Mapas base: © OpenStreetMap contributors; Esri (imagen satelital, calles y lienzo); OpenTopoMap (CC BY-SA).',
        'Relieve: Mapzen Terrain Tiles, AWS Open Data.',
        'Parte de los lugares (surf, gastronomía, cataratas, miradores y sitios arqueológicos) procede de OpenStreetMap, ODbL 1.0, en un extracto de Geofabrik.',
        'Rutas: OSRM (router.project-osrm.org), sobre datos de OpenStreetMap.',
        'Textos de enciclopedia e imágenes complementarias: Wikipedia y Wikimedia Commons. El autor y la licencia van en la ficha.',
      ],
    },
    {
      h: 'Nombres y marcas',
      p: [
        'Los nombres de lugares, estadios, equipos y marcas pertenecen a sus titulares. El atlas los usa para identificar el sitio.',
        'Un apodo se muestra cuando tiene una fuente pública. Mostrarlo no implica vínculo con el titular.',
      ],
    },
    {
      h: 'Datos en este dispositivo',
      p: [
        'No hay cuentas de usuario. Los favoritos, la ruta, el tema y las capas se guardan en el navegador de este dispositivo.',
        'La ubicación solo se pide si la persona la activa, y no se envía a un servidor de Perezeando.',
      ],
    },
    {
      h: 'Software',
      p: [
        'MapLibre GL JS (BSD-3), React (MIT), Zustand (MIT), Fuse.js (Apache-2.0) y los iconos Lucide (ISC).',
      ],
    },
  ],
};

const en: PolicyCopy = {
  title: 'Use and copyright',
  lede: 'Perezeando is a reference atlas of Costa Rica. This note states who owns each kind of material, what the site is for, and which data stays in the browser.',
  sections: [
    {
      h: 'What this site is',
      p: [
        'Perezeando gathers places on the mainland and in the territorial sea: nature, culture, sport, food, and transport. It is a map for looking them up.',
        'It is not an official government site. It does not manage the places it shows, and it does not sell tickets or services.',
      ],
    },
    {
      h: 'Informational use',
      p: [
        'The information is for reference. Hours, trails, roads, and park conditions change. Distances and route times are estimates. If the routing service does not respond, the line is drawn straight.',
        'Check the road and the notices from whoever manages the place before you go.',
      ],
    },
    {
      h: 'Copyright',
      p: [
        'Rights in the maps, photographs, articles, and databases stay with their authors. Each one is used under its own license. Perezeando does not claim that material as its own.',
        'Descriptions written for this atlas belong to Perezeando. When a card shows a Wikipedia excerpt, that text belongs to its authors and the card links to the article.',
        'Each photograph names its author and license. Keep that credit if you reuse the image.',
      ],
    },
    {
      h: 'Maps, photos, and text',
      items: [
        'Province boundaries: geoBoundaries (gbOpen CRI ADM1), derived from OpenStreetMap, ODbL 1.0.',
        'Base maps: © OpenStreetMap contributors; Esri (satellite, streets, and canvas); OpenTopoMap (CC BY-SA).',
        'Terrain: Mapzen Terrain Tiles, AWS Open Data.',
        'Some places (surf, food, waterfalls, viewpoints, and archaeological sites) come from OpenStreetMap, ODbL 1.0, via a Geofabrik extract.',
        'Routes: OSRM (router.project-osrm.org), on OpenStreetMap data.',
        'Encyclopedia text and extra images: Wikipedia and Wikimedia Commons. The author and license appear on the card.',
      ],
    },
    {
      h: 'Names and marks',
      p: [
        'Place names, stadiums, teams, and marks belong to their owners. The atlas uses them to identify a site.',
        'A nickname is shown when a public source records it. Showing it does not imply a link with the owner.',
      ],
    },
    {
      h: 'Data on this device',
      p: [
        'There are no user accounts. Favorites, the route, the theme, and the layers are stored in this device’s browser.',
        'Location is requested only if the person turns it on, and it is not sent to a Perezeando server.',
      ],
    },
    {
      h: 'Software',
      p: [
        'MapLibre GL JS (BSD-3), React (MIT), Zustand (MIT), Fuse.js (Apache-2.0), and Lucide icons (ISC).',
      ],
    },
  ],
};

export const POLICIES: Record<Lang, PolicyCopy> = { es, en };
