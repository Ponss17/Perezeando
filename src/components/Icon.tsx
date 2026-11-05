import { memo } from 'react';
import { ICONS } from '../lib/icons';

/** Icono Lucide en línea (SVG) */
export const Icon = memo(function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <svg
      className={'ico ' + className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[name] ?? '' }}
    />
  );
});
