import { Icon } from '../../components/Icon';

interface Props {
  icon: string;
  name: string;
  on: boolean;
  color?: string;
  count?: number;
  onToggle: () => void;
  focusable?: boolean;
  /** ícono propio (p. ej. la chincheta exacta de la categoría) en lugar del círculo */
  marker?: React.ReactNode;
}

/** Interruptor de capa (categoría o superposición) */
export function LayerRow({ icon, name, on, color, count, onToggle, focusable = true, marker }: Props) {
  return (
    <div
      className={'layer' + (color ? '' : ' ref') + (on ? '' : ' off')}
      role="switch"
      aria-checked={on}
      tabIndex={focusable ? 0 : -1}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      {marker ? (
        <span className="lic pin">{marker}</span>
      ) : (
        <span className="lic" style={color ? ({ '--c': color } as React.CSSProperties) : undefined}>
          <Icon name={icon} />
        </span>
      )}
      <span className="lname">{name}</span>
      {count != null && <span className="lcount">{count}</span>}
      <span className="switch" />
    </div>
  );
}
