import { useEffect, useLayoutEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
  count?: number;
  /** color de la categoría (punto) */
  color?: string;
  icon?: string;
}

interface Props {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  ariaLabel: string;
}

/** Lista desplegable accesible (patrón combobox + listbox de ARIA) */
export function Select({ value, options, onChange, ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ s: '', t: 0 });
  const id = useId();
  const cur = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const sel = options[cur];

  const openList = () => {
    setHi(cur);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', down, true);
    return () => document.removeEventListener('pointerdown', down, true);
  }, [open]);

  // Ajusta la altura y abre hacia arriba si no cabe abajo (p. ej. hoja móvil a media altura)
  useLayoutEffect(() => {
    const ul = list.current;
    const r = root.current?.getBoundingClientRect();
    if (!open || !ul || !r) return;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const below = vh - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 220 && above > below;
    ul.classList.toggle('up', up);
    ul.style.maxHeight = Math.max(140, Math.min(340, up ? above : below)) + 'px';
  }, [open]);

  useEffect(() => {
    if (open)
      list.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, hi]);

  const pick = (i: number) => {
    setOpen(false);
    if (options[i] && options[i].value !== value) onChange(options[i].value);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const n = options.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return openList();
      setHi((h) => (h + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
    } else if (e.key === 'Home' && open) {
      e.preventDefault();
      setHi(0);
    } else if (e.key === 'End' && open) {
      e.preventDefault();
      setHi(n - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (e.key === ' ' && typed.current.s) return;
      e.preventDefault();
      if (open) pick(hi);
      else openList();
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    } else if (e.key === 'Tab') {
      setOpen(false);
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const now = Date.now();
      const tq = typed.current;
      tq.s = now - tq.t > 700 ? e.key.toLowerCase() : tq.s + e.key.toLowerCase();
      tq.t = now;
      const norm = (s: string) =>
        s
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
      const q = norm(tq.s);
      const start = open ? hi : cur;
      for (let k = 1; k <= n; k++) {
        const i = (start + (tq.s.length > 1 ? k - 1 : k)) % n;
        if (norm(options[i].label).startsWith(q)) {
          if (open) setHi(i);
          else pick(i);
          break;
        }
      }
    }
  };

  const rows = useMemo(() => {
    const out: React.ReactNode[] = [];
    let g: string | undefined;
    options.forEach((o, i) => {
      if (o.group && o.group !== g) {
        g = o.group;
        out.push(
          <li key={'g' + i} className="sx-group" role="presentation">
            {o.group}
          </li>,
        );
      }
      out.push(
        <li
          key={o.value}
          id={`${id}-${i}`}
          data-i={i}
          role="option"
          aria-selected={o.value === value}
          className={'sx-opt' + (i === hi ? ' hi' : '') + (o.value === value ? ' on' : '')}
          onPointerMove={() => setHi(i)}
          onClick={() => pick(i)}
        >
          {o.color ? (
            <span className="sx-dot" style={{ '--c': o.color } as React.CSSProperties}>
              {o.icon && <Icon name={o.icon} />}
            </span>
          ) : null}
          <span className="sx-lbl">{o.label}</span>
          {o.count != null && <span className="sx-count">{o.count}</span>}
          <span className="sx-check">{o.value === value && <Icon name="check" />}</span>
        </li>,
      );
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, value, hi, id]);

  return (
    <div className={'sx' + (open ? ' open' : '')} ref={root}>
      <button
        type="button"
        className="sx-trigger"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id + '-list'}
        aria-activedescendant={open ? `${id}-${hi}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKey}
      >
        {sel?.color && <span className="sx-dot sm" style={{ '--c': sel.color } as React.CSSProperties} />}
        <span className="sx-val">{sel?.label}</span>
        <Icon name="chevron-down" />
      </button>
      {open && (
        <ul className="sx-list" id={id + '-list'} role="listbox" aria-label={ariaLabel} ref={list}>
          {rows}
        </ul>
      )}
    </div>
  );
}
