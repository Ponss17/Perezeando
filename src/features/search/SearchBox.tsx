import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { useT } from '../../i18n';
import { getApp, setApp, useApp } from '../../store/useApp';
import { getData } from '../../data/load';
import { select, setSheet, setTab } from '../../store/selection';
import { isMobile } from '../../lib/selectors';
import { computeResults, useKb } from './results';
import { warmSearch } from './searchIndex';

export function SearchBox() {
  const { t } = useT();
  const query = useApp((s) => s.query);
  const [val, setVal] = useState(query);
  const ref = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (query === '' && document.activeElement !== ref.current) setVal('');
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const a = document.activeElement as HTMLElement | null;
      if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(a?.tagName ?? '')) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const ensureExplore = () => {
    const s = getApp();
    if (s.tab !== 'explore' || s.detailOpen) setTab('explore');
  };

  const commit = (v: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setApp(v ? { query: v, near: false } : { query: v });
      useKb.setState({ i: -1 });
      ensureExplore();
    }, 140);
  };

  const clear = (focus: boolean) => {
    setVal('');
    clearTimeout(timer.current);
    setApp({ query: '' });
    useKb.setState({ i: -1 });
    if (focus) ref.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const d = getData();
    if (!d) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = document.querySelectorAll('#resultList .item[data-id]').length;
      const i = Math.max(0, Math.min(n - 1, useKb.getState().i + (e.key === 'ArrowDown' ? 1 : -1)));
      useKb.setState({ i });
      document.querySelectorAll('#resultList .item[data-id]')[i]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      clearTimeout(timer.current);
      const s = { ...getApp(), query: val };
      const r = computeResults(s, d);
      const i = useKb.getState().i;
      const p = r.list[i >= 0 ? i : 0];
      if (p) {
        setApp({ query: val });
        select(p.id);
        ref.current?.blur();
      }
    } else if (e.key === 'Escape') {
      clear(false);
    }
  };

  return (
    <div className="search">
      <span className="search-ico">
        <Icon name="search" />
      </span>
      <input
        ref={ref}
        id="searchInput"
        type="search"
        autoComplete="off"
        spellCheck={false}
        placeholder={t('search_ph')}
        aria-label={t('search_ph')}
        value={val}
        onChange={(e) => {
          setVal(e.target.value);
          commit(e.target.value);
        }}
        onFocus={() => {
          if (isMobile()) setSheet('full');
          ensureExplore();
          const d = getData();
          if (d) warmSearch(d);
        }}
        onKeyDown={onKeyDown}
      />
      {!val && <kbd className="search-kbd">/</kbd>}
      {val && (
        <button className="icon-btn small" aria-label={t('clear')} onClick={() => clear(true)}>
          <Icon name="x" />
        </button>
      )}
    </div>
  );
}
