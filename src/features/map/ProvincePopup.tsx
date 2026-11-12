import { useMemo } from 'react';
import { useData } from '../../data/load';
import { CATEGORIES } from '../../data/config';
import type { CategoryId, PlaceImage, ProvinceId } from '../../data/types';
import { pick, useT } from '../../i18n';
import { setProv, setTab, showProvince } from '../../store/selection';
import { fmt, fmtNum } from '../../lib/format';
import { sizedThumb, useImageState } from '../../lib/photo';
import { Icon } from '../../components/Icon';

function ProvHero({
  img,
  src,
  photo,
  credit,
}: {
  img: PlaceImage;
  src: string;
  photo: ReturnType<typeof useImageState>;
  credit: string;
}) {
  const ready = photo.state === 'ok';
  const label = `${credit}: ${img.artist || img.license || ''}`.trim();
  return (
    <div
      className={'prov-hero' + (ready ? ' loaded' : '') + (photo.instant ? ' instant' : '')}
      aria-busy={!ready}
    >
      {photo.state !== 'err' && <span className="hero-skel" aria-hidden="true" />}
      {ready && <img className="hero-img" src={src} alt="" decoding="async" referrerPolicy="no-referrer" />}
      {ready &&
        (img.page ? (
          <a className="prov-credit" href={img.page} target="_blank" rel="noopener">
            {label}
          </a>
        ) : (
          <span className="prov-credit">{label}</span>
        ))}
    </div>
  );
}

export function ProvincePopup({ id }: { id: ProvinceId }) {
  const { t, lang } = useT();
  const data = useData((s) => s.data)!;
  const pp = data.provById.get(id);
  const { n, top } = useMemo(() => {
    const counts = new Map<CategoryId, number>();
    let n = 0;
    for (const p of data.places) {
      if (p.prov !== id) continue;
      n++;
      counts.set(p.cat, (counts.get(p.cat) ?? 0) + 1);
    }
    const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 4);
    return { n, top };
  }, [data, id]);
  const heroSrc = pp?.img ? sizedThumb(pp.img.src, 500) : undefined;
  const photo = useImageState(heroSrc);
  if (!pp) return null;
  const tone = { '--pc': pp.color || '#386641' } as React.CSSProperties;
  return (
    <div className="prov-pop" style={tone}>
      {pp.img && <ProvHero img={pp.img} src={heroSrc!} photo={photo} credit={t('photo')} />}
      <div className="prov-body">
        <span className="eyebrow">{t('province')}</span>
        <h4>{pp.name}</h4>
        <p className="prov-cap">
          {t('capital')} · {pp.capital}
        </p>
        <ul className="prov-stats">
          <li>
            <b>{fmt(lang, fmtNum('es', pp.area))}</b>
            <span>km²</span>
          </li>
          <li>
            <b>{fmt(lang, pp.cantones)}</b>
            <span>{t('cantones')}</span>
          </li>
          <li>
            <b>{fmt(lang, n)}</b>
            <span>{t('places_lbl')}</span>
          </li>
        </ul>
        {top.length > 0 && (
          <ul className="prov-cats">
            {top.map(([cat, count]) => (
              <li key={cat}>
                <i style={{ '--c': CATEGORIES[cat].color } as React.CSSProperties} />
                {pick(lang, CATEGORIES[cat].name)}
                <b>{count}</b>
              </li>
            ))}
          </ul>
        )}
        <div className="pop-actions">
          <button className="pill sm" onClick={() => showProvince(id)}>
            {t('details')}
          </button>
          <button
            className="pill sm primary"
            onClick={() => {
              setTab('explore');
              setProv(id, true);
            }}
          >
            <Icon name="filter" />
            {t('see_places')}
          </button>
        </div>
      </div>
    </div>
  );
}
