import { useShallow } from 'zustand/react/shallow';
import { BrandLogo } from './BrandLogo';
import { useApp } from '../store/useApp';
import { useData } from '../data/load';
import { locale, useT } from '../i18n';
import { CATEGORIES, CATEGORY_ORDER } from '../data/config';
import { catName, provName } from '../store/labels';
import { visiblePlaces } from '../lib/selectors';

export function PrintParts() {
  const { t, lang } = useT();
  const s = useApp(
    useShallow((x) => ({
      active: x.active,
      prov: x.prov,
      cat: x.cat,
      route: x.route,
      sel: x.sel,
    })),
  );
  const data = useData((x) => x.data);
  if (!data) return null;
  const n = visiblePlaces(s, data.places).length;
  const focus = s.sel?.kind === 'place' ? data.byId.get(s.sel.id) : null;
  const scope = [
    s.prov === 'all' ? t('all_provinces') : provName(s.prov),
    s.cat === 'all' ? t('all_categories') : catName(s.cat),
  ];
  if (s.route.length >= 2) {
    const a = data.byId.get(s.route[0]);
    const b = data.byId.get(s.route[s.route.length - 1]);
    if (a && b) scope.push(`${t('tab_route')}: ${a.name[lang]} → ${b.name[lang]}`);
  }
  const cats = CATEGORY_ORDER.filter((c) => s.active.includes(c) && (s.cat === 'all' || c === s.cat));
  const when = new Date().toLocaleDateString(locale(lang), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return (
    <div className="print-sheet" aria-hidden="true">
      <header className="print-head">
        <div className="print-brand">
          <BrandLogo />
          <div className="print-brand-text">
            <p className="print-kicker">{t('brand_kicker')}</p>
            <p className="print-name">{t('brand_name')}</p>
          </div>
        </div>
        <div className="print-meta">
          <h1>{focus ? focus.name[lang] : t('title')}</h1>
          <p className="print-scope">
            {focus ? `${catName(focus.cat)} · ` : ''}
            {scope.join(' · ')}
          </p>
          <p className="print-stats">
            {n} {t('count_places')} · {t('printed')} {when}
          </p>
        </div>
      </header>
      <figure className="print-figure">
        <img id="printImg" className="print-img" alt="" />
      </figure>
      {cats.length > 0 && (
        <section className="print-legend">
          <h2>{t('legend_title')}</h2>
          <ul>
            {cats.map((c) => (
              <li key={c}>
                <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
                  <circle cx="5.5" cy="5.5" r="5" fill={CATEGORIES[c].color} />
                </svg>
                <span>{catName(c)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <footer className="print-foot">
        <span>{t('print_foot')}</span>
        <span>{t('print_sources')}</span>
      </footer>
    </div>
  );
}
