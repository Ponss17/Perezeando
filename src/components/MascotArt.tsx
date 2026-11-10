import routeSvg from '../mascots/route.svg?raw';
import filtersSvg from '../mascots/filters.svg?raw';
import favsSvg from '../mascots/favs.svg?raw';

export type MascotKind = 'route' | 'filters' | 'favs';

const SVGS: Record<MascotKind, string> = {
  route: routeSvg,
  filters: filtersSvg,
  favs: favsSvg,
};

export function MascotArt({
  kind,
  className = '',
  size = 112,
}: {
  kind: MascotKind;
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={className}
      style={{ width: size, height: size, display: 'block' }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: SVGS[kind] }}
    />
  );
}
