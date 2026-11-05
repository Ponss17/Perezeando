import type { CategoryId } from '../data/types';
import { CAT_SHAPE, CATEGORIES } from '../data/config';
import type { MarkerShape } from '../data/config';
import { PIN, PIN_PAD, pinShapeMarkup, shapePath } from '../lib/markerShape';
import { Icon } from './Icon';

/** Mini marcador HTML (forma/color/ícono de la categoría) para chips y fichas */
export function MiniMarker({ cat, size }: { cat: CategoryId; size?: number }) {
  const c = CATEGORIES[cat];
  return (
    <span
      className={'mk ' + CAT_SHAPE[cat]}
      style={{ '--c': c.color, ...(size ? { '--s': size + 'px' } : {}) } as React.CSSProperties}
    >
      <Icon name={c.icon} />
    </span>
  );
}

/* recorte del lienzo de la chincheta: deja la forma (y el rombo, que es más ancho) con su borde */
const S = PIN + PIN_PAD * 2;
const CROP = 5;
const VB = `${CROP} ${CROP} ${S - CROP * 2} ${S - CROP * 2}`;

/** La chincheta exacta del mapa (misma geometría SVG que se rasteriza), como ícono */
export function CatPin({ cat, size = 26 }: { cat: CategoryId; size?: number }) {
  return (
    <svg
      className="cat-pin"
      width={size}
      height={size}
      viewBox={VB}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: pinShapeMarkup(cat) }}
    />
  );
}

/** Solo la forma (sin ícono), para la clave de símbolos */
export function ShapeSwatch({ shape, size = 13 }: { shape: MarkerShape; size?: number }) {
  const c = S / 2;
  return (
    <svg className="shape-sw" width={size} height={size} viewBox={VB} aria-hidden="true">
      <path d={shapePath(shape, c, PIN / 2 - 1.5)} />
    </svg>
  );
}
