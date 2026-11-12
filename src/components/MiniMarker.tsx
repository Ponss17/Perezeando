import type { CategoryId } from '../data/types';
import { CAT_SHAPE, CATEGORIES } from '../data/config';
import type { MarkerShape } from '../data/config';
import { PIN, PIN_PAD, pinShapeMarkup, shapePath } from '../lib/markerShape';
import { Icon } from './Icon';

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

const S = PIN + PIN_PAD * 2;
const CROP = 5;
const VB = `${CROP} ${CROP} ${S - CROP * 2} ${S - CROP * 2}`;

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

export function ShapeSwatch({ shape, size = 13 }: { shape: MarkerShape; size?: number }) {
  const c = S / 2;
  return (
    <svg className="shape-sw" width={size} height={size} viewBox={VB} aria-hidden="true">
      <path d={shapePath(shape, c, PIN / 2 - 1.5)} />
    </svg>
  );
}
