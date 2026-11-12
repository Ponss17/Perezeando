import type { DictKey } from '../i18n/es';

export const DISCOVER_SECTIONS: { id: string; labelKey: DictKey; ids: string[] }[] = [
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
