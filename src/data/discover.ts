import type { IntentionTag } from './types';

/** Secciones curadas del home de Explorar (ids reales del atlas) */
export const DISCOVER_SECTIONS: { id: string; labelKey: string; ids: string[] }[] = [
  {
    id: 'imperdibles',
    labelKey: 'discover_must',
    ids: [
      'vol-volcan-arenal',
      'par-p-n-manuel-antonio',
      'par-p-n-corcovado',
      'par-p-n-tortuguero',
      'bos-bosque-nuboso-monteverde',
      'rio-rio-celeste',
      'cat-catarata-la-fortuna',
      'par-p-n-isla-del-coco',
      'par-p-n-chirripo',
      'par-p-n-marino-ballena',
    ],
  },
  {
    id: 'poco_conocidos',
    labelKey: 'discover_hidden',
    ids: [
      'par-p-n-cahuita',
      'par-p-n-barra-honda',
      'par-p-n-la-cangreja',
      'cat-catarata-el-toro',
      'wd-playa-la-islita',
      'pla-playa-naranjo-santa-rosa',
      'dat-zona-longeva-nicoya',
      'pla-playa-ostional',
    ],
  },
  {
    id: 'fin_de_semana',
    labelKey: 'discover_weekend',
    ids: [
      'vol-volcan-poas',
      'vol-volcan-irazu',
      'par-p-n-volcan-poas',
      'par-p-n-carara',
      'cat-catarata-nauyaca',
      'pla-playa-manuel-antonio',
      'par-p-n-manuel-antonio',
      'ciu-la-fortuna',
      'ciu-monteverde-santa-elena',
      'par-p-n-volcan-tenorio',
    ],
  },
];

/**
 * Tags de intención: lista curada a mano (ids del atlas).
 * No se inventan fichas; solo agrupa lugares ya existentes.
 */
export const INTENTION_IDS: Record<IntentionTag, string[]> = {
  kids: [
    'par-p-n-manuel-antonio',
    'pla-playa-manuel-antonio',
    'pla-playa-conchal',
    'pla-playa-samara',
    'vol-volcan-poas',
    'par-p-n-volcan-poas',
    'cat-catarata-la-fortuna',
    'par-p-n-marino-ballena',
  ],
  calm_beach: [
    'pla-playa-conchal',
    'wd-playa-la-islita',
    'pla-playa-flamingo',
    'pla-playa-samara',
    'pla-playa-punta-uva',
    'pla-playa-manzanillo',
    'par-p-n-cahuita',
    'pla-playa-montezuma',
  ],
  adventure: [
    'par-p-n-corcovado',
    'par-p-n-isla-del-coco',
    'par-p-n-chirripo',
    'cat-catarata-nauyaca',
    'rio-rio-celeste',
    'vol-volcan-arenal',
    'pla-bahia-drake',
    'pla-playa-pavones',
    'par-p-n-volcan-rincon-de-la-vieja',
  ],
};

export const INTENTION_ORDER: IntentionTag[] = ['calm_beach', 'kids', 'adventure'];

export function intentionOf(id: string): IntentionTag[] {
  return INTENTION_ORDER.filter((t) => INTENTION_IDS[t].includes(id));
}
