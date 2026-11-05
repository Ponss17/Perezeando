import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { loadContent, useContent, useData } from '../../data/load';
import { HERO_W, placePicture, sizedThumb, useImageState } from '../../lib/photo';
import { useT } from '../../i18n';
import { CATEGORIES } from '../../data/config';
import type { Nick, CategoryId, ContentItem, ContentText, Lang, ProvinceContent as ProvinceContentT, ProvinceId } from '../../data/types';
import { catName, select, setProv, setTab, share } from '../../store/actions';
import { wikiTarget, wikiUrl } from '../../lib/wiki';
import { Icon } from '../../components/Icon';
import { SlideTrack } from '../../components/SlideTrack';
import { Attrib, HeroTop, NickSub, Qa, SourceBox, SourceChip, nickRow } from './parts';

const BRAND = '#386641';

/** Ficha de una provincia */
export default function ProvinceDetail({ id }: { id: ProvinceId }) {
  const { t, lang } = useT();
  const data = useData((s) => s.data)!;
  const pp = data.provById.get(id)!;
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.closest('.detail-pane, .panel-body')?.scrollTo({ top: 0 });
  }, [id]);
  const { n, counts } = useMemo(() => {
    const m = new Map<CategoryId, number>();
    let n = 0;
    data.places.forEach((p) => {
      if (p.prov !== id) return;
      n++;
      [p.cat, ...(p.also ?? [])].forEach((c) => m.set(c, (m.get(c) ?? 0) + 1));
    });
    return { n, counts: [...m].sort((a, b) => b[1] - a[1]) };
  }, [data, id]);
  const w = wikiTarget(lang, pp.wiki);
  const brand = { '--c': pp.color || BRAND } as React.CSSProperties;
  const heroSrc = pp.img ? sizedThumb(pp.img.src, HERO_W) : undefined;
  const photo = useImageState(heroSrc);
  const heroFailed = !!pp.img && photo.state === 'err';

  return (
    <section className="tab-pane detail active" data-pane="detail" id="detail" ref={ref}>
      <div
        className={
          'hero' +
          (!pp.img || heroFailed ? ' noimg' : ' ph') +
          (photo.state === 'ok' ? ' loaded' : '') +
          (photo.instant ? ' instant' : '')
        }
        style={brand}
        aria-busy={!!pp.img && photo.state === 'wait'}
      >
        {pp.img && !heroFailed && <span className="hero-skel" aria-hidden="true" />}
        {photo.state === 'ok' && heroSrc && (
          <img className="hero-img" src={heroSrc} alt="" decoding="async" referrerPolicy="no-referrer" />
        )}
        <HeroTop />
        {photo.state === 'ok' && pp.img ? (
          <Attrib img={pp.img} />
        ) : !pp.img || heroFailed ? (
          <span className="hero-ico">
            <Icon name="map" />
          </span>
        ) : null}
      </div>
      <div className="detail-body">
        <div className="eyebrow" style={brand}>
          {t('province')}
          <span className="sep">·</span>Costa Rica
        </div>
        <h2>{pp.name}</h2>
        <NickSub n={pp.nick} />
        <div className="quick">
          <Qa
            icon="filter"
            label={t('filter')}
            cls="primary"
            onClick={() => {
              setTab('explore');
              setProv(id, true);
            }}
          />
          {w && <Qa href={wikiUrl(w)} icon="globe" label="Wikipedia" />}
          <Qa icon="share-2" label={t('share')} onClick={() => share(null)} />
        </div>
        <ProvinceTabs id={id} n={n} counts={counts} area={pp.area} capital={pp.capital} cantones={pp.cantones} nick={pp.nick} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ pestañas */
type PTab = 'food' | 'culture' | 'sports' | 'data';
const PTABS: { id: PTab; icon: string }[] = [
  { id: 'data', icon: 'users' },
  { id: 'food', icon: 'utensils' },
  { id: 'culture', icon: 'drama' },
  { id: 'sports', icon: 'trophy' },
];
/** quita repetidos (mismo Q-id o mismo nombre) entre listas de una pestaña */
function dedupe(lists: ContentItem[][], lang: Lang) {
  const seen = new Set<string>();
  return lists.map((l) =>
    (l ?? []).filter((i) => {
      const k1 = i.qid, k2 = nameOf(i.name, lang).toLowerCase();
      if ((k1 && seen.has(k1)) || seen.has(k2)) return false;
      if (k1) seen.add(k1);
      seen.add(k2);
      return true;
    }),
  );
}
const nameOf = (n: ContentItem['name'], lang: Lang) => (typeof n === 'string' ? n : n[lang] || n.es || n.en).replace(/\s*\([^)]*\)$/, '');
const pick = <T,>(m: Partial<Record<Lang, T>> | undefined, lang: Lang) => m?.[lang] ?? m?.[lang === 'es' ? 'en' : 'es'];

/** Comida / Cultura / Deportes / Datos con contenido citado (provinces-content.json, carga diferida) */
type TabsProps = { id: ProvinceId; n: number; counts: [CategoryId, number][]; area: number; capital: string; cantones: number; nick?: Nick };
function ProvinceTabs({ id, n, counts, area, capital, cantones, nick }: TabsProps) {
  const { t, lang } = useT();
  const content = useContent((s) => s.content);
  const national = useContent((s) => s.national);
  const orgs = useContent((s) => s.orgs);
  const [tab, setT] = useState<PTab>('data');
  const [err, setErr] = useState(false);
  useEffect(() => {
    loadContent().catch(() => setErr(true));
  }, []);
  const c = content?.[id];
  const nationalLeft = useMemo(() => {
    if (!c) return [];
    const qids = new Set<string>();
    const names = new Set<string>();
    for (const i of c.food.items) {
      if (i.qid) qids.add(i.qid);
      names.add(nameOf(i.name, lang).toLowerCase());
    }
    return national.filter((x) => !((x.qid && qids.has(x.qid)) || names.has(nameOf(x.name, lang).toLowerCase())));
  }, [c, national, lang]);
  const stadiums = useMemo(() => (c ? dedupe([c.sports.clubs, c.sports.stadiums], lang)[1] : []), [c, lang]);
  const index = PTABS.findIndex((x) => x.id === tab);
  const wait = <p className="muted">{err ? t('content_err') : t('loading')}</p>;
  return (
    <div className="ptabs">
      <div className="ptab-bar" role="tablist" style={{ '--i': index } as CSSProperties}>
        <span className="ptab-pill" aria-hidden="true" />
        {PTABS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            data-ptab={x.id}
            aria-selected={tab === x.id}
            className={tab === x.id ? 'on' : ''}
            onClick={() => setT(x.id)}
          >
            <Icon name={x.icon} />
            <span>{t(('ptab_' + x.id) as 'ptab_food')}</span>
          </button>
        ))}
      </div>
      <SlideTrack index={index} panels paneClass="ptab-pane" onIndex={(i) => setT(PTABS[i].id)}>
        <DataTab c={c} n={n} counts={counts} area={area} capital={capital} cantones={cantones} nick={nick} />
        <>
            {!c ? (
              wait
            ) : (
              <>
                <Items title={t('typical_dishes')} items={c.food.items} max={12} wrap sub={(i) => i.note?.[lang] || i.note?.es} />
                {c.food.intro[0] && <TextBox x={c.food.intro[0]} />}
                <Items
                  title={t('national_dishes')}
                  items={nationalLeft}
                  max={4}
                  compact
                />
                <VoyBox x={pick(c.food.voy, lang)} title={t('voy_eat')} />
                <Empty show={!c.food.intro.length && !c.food.items.length && !pick(c.food.voy, lang)} />
              </>
            )}
        </>
        <>{!c ? wait : <CultureTab c={c} />}</>
        <>
            {!c ? (
              wait
            ) : (
              <>
                <Items title={t('clubs_lbl')} items={c.sports.clubs} crest sub={(i) => i.leagues?.join(' · ') || i.venue} />
                <Items title={t('stadiums_lbl')} items={stadiums} />
                <Items title={t('surf_lbl')} items={c.sports.surf} />
                <VoyBox x={pick(c.sports.voy, lang)} title={t('voy_do')} />
                {id === 'sanjose' && <Items title={t('orgs_lbl')} items={orgs} crest note={t('orgs_note')} />}
                <Empty show={!c.sports.clubs.length && !c.sports.stadiums.length && !pick(c.sports.voy, lang)} />
              </>
            )}
        </>
      </SlideTrack>
    </div>
  );
}

function DataTab({ c, n, counts, area, capital, cantones, nick }: Omit<TabsProps, 'id'> & { c?: ProvinceContentT }) {
  const { t, lang } = useT();
  const pop = c?.facts.pop;
  const ar = area || c?.facts.area;
  const num = (x: number, d = 0) => x.toLocaleString(lang, { maximumFractionDigits: d });
  const rows: [string, string][] = [
    [t('capital'), capital || c?.facts.capital || '—'],
    ...(pop ? [[`${t('population')}${c?.facts.popYear ? ` (${c.facts.popYear})` : ''}`, num(pop)] as [string, string]] : []),
    ...(ar ? [[t('area'), `${num(ar)} km²`] as [string, string]] : []),
    ...(pop && ar ? [[t('density'), `${num(pop / ar, 1)} ${t('per_km2')}`] as [string, string]] : []),
    ...(cantones ? [[t('cantones'), String(cantones)] as [string, string]] : []),
  ];
  const nr = nickRow(nick, t as (k: string) => string);
  const voy = c && ((lang === 'es' ? c.facts.esvoy : c.facts.envoy) ?? c.facts.esvoy ?? c.facts.envoy);
  return (
    <>
      <dl className="pfacts">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        {nr && (
          <div className="pfacts-wide">
            <dt>{nr[0]}</dt>
            <dd>{nr[1]}</dd>
          </div>
        )}
      </dl>
      <h3 className="section-title">
        {t('places_here')} <span className="count">{n}</span>
      </h3>
      <ul className="cat-chips">
        {counts.map(([cat, k]) => (
          <li key={cat} style={{ '--c': CATEGORIES[cat].color } as React.CSSProperties}>
            <Icon name={CATEGORIES[cat].icon} />
            {catName(cat)} <b>{k}</b>
          </li>
        ))}
      </ul>
      {(c?.facts.src || voy) && (
        <p className="src-foot">
          {t('sources')}:{' '}
          {c?.facts.src && <SourceChip name={c.facts.src.name} url={c.facts.src.url} />}
          {voy && <SourceChip name="Wikivoyage" url={voy} license="CC BY-SA 4.0" />}
        </p>
      )}
    </>
  );
}

function CultureTab({ c }: { c: ProvinceContentT }) {
  const { t, lang } = useT();
  const [h, m, ch, a] = useMemo(
    () => dedupe([c.culture.heritage, c.culture.museums, c.culture.churches, c.culture.archaeology], lang),
    [c, lang],
  );
  return (
    <>
      {c.culture.wiki && <TextBox x={c.culture.wiki} />}
      <Items title={t('heritage_lbl')} items={h} max={6} />
      <Items title={t('museums_lbl')} items={m} max={6} />
      <Items title={t('churches_lbl')} items={ch} max={6} />
      <Items title={t('archaeology_lbl')} items={a} max={6} />
      <VoyBox x={pick(c.culture.voy, lang)} title={t('voy_see')} />
      <Empty show={!h.length && !m.length && !ch.length && !a.length && !c.culture.wiki} />
    </>
  );
}

function Empty({ show }: { show: boolean }) {
  const { t } = useT();
  return show ? <p className="muted">{t('content_none')}</p> : null;
}

function TextBox({ x }: { x: ContentText }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <SourceBox label={x.section ? `${t('from')} ${x.src.name} · ${x.section}` : `${t('from')} ${x.src.name}`} sources={[x.src]}>
      <p className={open ? '' : 'clamp'}>{x.text}</p>
      <button type="button" className="link-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? t('read_less') : t('read_more')}
        <Icon name={open ? 'chevron-up' : 'chevron-down'} />
      </button>
    </SourceBox>
  );
}

function VoyBox({ x, title }: { x?: ContentText; title: string }) {
  const { t } = useT();
  if (!x) return null;
  return (
    <SourceBox label={`${title} · ${t('from')} Wikivoyage`} icon="book-open" sources={[x.src]}>
      <p className="clamp">{x.text}</p>
    </SourceBox>
  );
}

function CardPic({ pic }: { pic: string | ReturnType<typeof placePicture> }) {
  const [bad, setBad] = useState(false);
  if (!pic || bad) return <Icon name="image-off" />;
  const tile = typeof pic === 'string' ? null : pic.kind === 'tile' ? pic : null;
  return (
    <img
      src={typeof pic === 'string' ? pic : pic.src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={tile ? 'sat-tile' : undefined}
      style={tile ? ({ '--px': tile.x + 'px', '--py': tile.y + 'px' } as CSSProperties) : undefined}
      onError={() => setBad(true)}
    />
  );
}

const MAX = 8;
function Items({ title, items, sub, crest, max = MAX, compact, note, wrap }: { title: string; items: ContentItem[]; sub?: (i: ContentItem) => string | undefined; crest?: boolean; max?: number; compact?: boolean; note?: string; wrap?: boolean }) {
  const { lang, t } = useT();
  const places = useData((s) => s.data?.byId);
  const [all, setAll] = useState(false);
  if (!items?.length) return null;
  const shown = all ? items : items.slice(0, max);
  return (
    <>
      <h3 className="section-title">
        {title} <span className="count">{items.length}</span>
      </h3>
      {note && <p className="section-sub">{note}</p>}
      <ul className={'item-cards' + (compact ? ' compact' : '')}>
        {shown.map((i) => {
          const nm = nameOf(i.name, lang);
          const pid = i.id && places?.has(i.id) ? i.id : undefined;
          const s = sub?.(i);
          const linked = pid ? places?.get(pid) : undefined;
          const pic = i.img ? i.img.src.replace('/960px-', '/250px-') : linked ? placePicture(linked) : null;
          const body = (
            <>
              {crest ? (
                <Crest i={i} name={nm} />
              ) : (
              <span className="ic-ph">
                <CardPic pic={pic} />
              </span>
              )}
              <span className="ic-txt">
                <b>{nm}</b>
                {s && <small className={wrap ? 'ic-note' : undefined}>{s}</small>}
                {crest && i.crest && (
                  <small className="ic-attr">
                    <a href={i.crest.page} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>
                      {t('crest_img')}: {i.crest.from === 'commons' ? 'Wikimedia Commons' : 'Wikipedia'}
                    </a>
                    {i.crest.license ? ` · ${i.crest.license}` : ''}
                  </small>
                )}
                {!crest && i.img?.artist && (
                  <small className="ic-attr" title={i.img.license}>
                    © {i.img.artist.replace(/<[^>]+>/g, '')}
                    {i.img.license ? ` · ${i.img.license}` : ''}
                  </small>
                )}
              </span>
            </>
          );
          return (
            <li key={(i.qid ?? '') + nm}>
              {pid ? (
                <button type="button" className="ic" onClick={() => select(pid)}>
                  {body}
                  <Icon name="chevron-right" />
                </button>
              ) : (
                <div className="ic">
                  {body}
                  {i.src && (
                    <a className="ic-src" href={i.src.url} target="_blank" rel="noopener" title={i.src.name}>
                      <Icon name="arrow-up-right" />
                    </a>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {items.length > max && (
        <button type="button" className="link-btn more" onClick={() => setAll(!all)}>
          {all ? t('show_less') : `${t('show_all')} (${items.length})`}
        </button>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- escudos */
const MONO_COLORS = ['#386641', '#6A994E', '#BC4749', '#1f8a9e', '#b5602f', '#5b5f97', '#8a6d3b'];
const MONO_SKIP = /^(club|sport|fútbol|futbol|football|fc|ad|as|cs|asociación|asociacion|deportiva|deportivo|de|del|la|el|los|las|y)$/i;
function initials(name: string) {
  const w = name.split(/[\s.-]+/).filter((x) => x && !MONO_SKIP.test(x));
  return (w.length >= 2 ? w[0][0] + w[1][0] : (w[0] || name).slice(0, 2)).toUpperCase();
}
function Crest({ i, name }: { i: ContentItem; name: string }) {
  const { t } = useT();
  const [bad, setBad] = useState(false);
  if (i.crest && !bad)
    return (
      <span className="ic-ph ic-crest">
        <img src={i.crest.src} alt="" loading="lazy" decoding="async" onError={() => setBad(true)} />
      </span>
    );
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const col = MONO_COLORS[h % MONO_COLORS.length];
  return (
    <span className="ic-ph ic-crest ic-mono" title={t('crest_mono')}>
      <svg viewBox="0 0 40 46" aria-hidden="true">
        <path d="M20 2 L37 8 V22 C37 33 29.5 40.5 20 44 C10.5 40.5 3 33 3 22 V8 Z" fill="none" stroke={col} strokeWidth="2" strokeDasharray="3 2.2" />
        <text x="20" y="27.5" textAnchor="middle" fontSize="13" fontWeight="700" fill={col} letterSpacing=".5">
          {initials(name)}
        </text>
      </svg>
    </span>
  );
}
