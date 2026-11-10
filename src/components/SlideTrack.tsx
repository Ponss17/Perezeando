import { useLayoutEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react';

export function SlideTrack({
  index,
  fill,
  onIndex,
  className,
  paneClass,
  panels,
  children,
}: {
  index: number;
  fill?: boolean;
  onIndex?: (index: number) => void;
  className?: string;
  paneClass?: string;
  panels?: boolean;
  children: ReactNode;
}) {
  const items = Array.isArray(children) ? children : children == null ? [] : [children];
  const n = Math.max(items.length, 1);
  const windowRef = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    if (fill) return;
    const pane = windowRef.current?.querySelectorAll<HTMLElement>(':scope > .slide-track > .slide-pane')[
      index
    ];
    if (!pane) return;
    const measure = () => setH(pane.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(pane);
    return () => ro.disconnect();
  }, [fill, index, n]);

  const start = (e: TouchEvent) => {
    const p = e.changedTouches[0];
    touch.current = { x: p.clientX, y: p.clientY };
  };
  const end = (e: TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s || !onIndex) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - s.x;
    const dy = p.clientY - s.y;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy)) return;
    const next = index + (dx < 0 ? 1 : -1);
    if (next >= 0 && next < n) onIndex(next);
  };

  return (
    <div
      className={'slide-window' + (fill ? ' fill' : '') + (className ? ' ' + className : '')}
      ref={windowRef}
      style={fill || !h ? undefined : { height: h }}
      onTouchStart={onIndex ? start : undefined}
      onTouchEnd={onIndex ? end : undefined}
    >
      <div
        className="slide-track"
        style={{ width: `${n * 100}%`, transform: `translateX(${(index * -100) / n}%)` }}
      >
        {items.map((child, i) => (
          <div
            key={i}
            className={'slide-pane' + (paneClass ? ' ' + paneClass : '')}
            style={{ width: `${100 / n}%` }}
            role={panels ? 'tabpanel' : undefined}
            aria-hidden={i !== index}
            inert={i !== index}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}
