import type { ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { useT } from '../../i18n';
import { closeDetail } from '../../store/actions';
import type { Nick, PlaceImage } from '../../data/types';

export function HeroTop() {
  const { t } = useT();
  return (
    <div className="hero-top">
      <button className="round" aria-label={t('back')} title={t('back')} onClick={() => closeDetail('back')}>
        <Icon name="arrow-left" />
      </button>
      <button
        className="round"
        aria-label={t('close')}
        title={t('close')}
        onClick={() => closeDetail('close')}
      >
        <Icon name="x" />
      </button>
    </div>
  );
}

export function Attrib({
  img,
  href,
  label,
  license,
}: {
  img?: PlaceImage;
  href?: string;
  label?: string;
  license?: string;
}) {
  const { t } = useT();
  return (
    <div className="attrib">
      {t('photo')}:{' '}
      <a href={href ?? img?.page ?? '#'} target="_blank" rel="noopener">
        {label ?? img?.artist ?? 'Wikimedia Commons'}
      </a>
      {license ? ' · ' + license : img?.license ? ' · ' + img.license : label ? ' · Wikimedia Commons' : ''}
    </div>
  );
}

interface QaProps {
  icon: string;
  label: string;
  href?: string;
  onClick?: () => void;
  cls?: string;
  pressed?: boolean;
}

/** Acción rápida de la ficha */
export function Qa({ icon, label, href, onClick, cls = '', pressed }: QaProps) {
  const inner = (
    <>
      <span className="qa-ico">
        <Icon name={icon} />
      </span>
      <span className="qa-lbl">{label}</span>
    </>
  );
  return href ? (
    <a className={'qa ' + cls} href={href} target="_blank" rel="noopener">
      {inner}
    </a>
  ) : (
    <button className={'qa ' + cls} onClick={onClick} aria-pressed={pressed}>
      {inner}
    </button>
  );
}

export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  const { t } = useT();
  return (
    <>
      <h3 className="section-title">{t('facts_title')}</h3>
      <dl className="facts">
        {rows.map(([k, v]) => (
          <div className="fact" key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}


/** Chip de fuente (marrón): nombre + enlace al origen del dato */
export function SourceChip({ name, url, license }: { name: string; url: string; license?: string }) {
  return (
    <a className="src-chip" href={url} target="_blank" rel="noopener" title={license ? `${name} · ${license}` : name}>
      <Icon name="book-open" />
      {name}
      <Icon name="arrow-up-right" />
    </a>
  );
}

/** Caja de contenido citado: encabezado "Según <fuente>" + cuerpo + chips de fuente */
export function SourceBox({
  label,
  icon = 'globe',
  children,
  sources = [],
  className = '',
}: {
  label: ReactNode;
  icon?: string;
  children?: ReactNode;
  sources?: { name: string; url: string; license?: string }[];
  className?: string;
}) {
  return (
    <div className={`wiki-extract src-box ${className}`}>
      <div className="wiki-src">
        <Icon name={icon} />
        {label}
      </div>
      {children}
      {sources.length > 0 && (
        <div className="src-chips">
          {sources.map((s) => (
            <SourceChip key={s.url} {...s} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Apodo bajo el título (cursiva), solo si hay fuente */
export function NickSub({ n }: { n?: Nick }) {
  const a = n?.nickname ?? n?.popularNickname;
  if (!a) return null;
  return (
    <p className="nick-sub" lang="es">
      <em>«{a}»</em>
    </p>
  );
}

/** Valor de la fila Gentilicio: «josefino · apodo popular: Chepe» + enlace a la fuente */
export function nickRow(n: Nick | undefined, t: (k: string) => string): [string, ReactNode] | null {
  if (!n || (!n.demonym && !n.popularNickname && !n.popularDemonym)) return null;
  const parts: string[] = [];
  if (n.demonym) parts.push(n.demonym);
  if (n.popularDemonym) parts.push(`${t('demonym_pop')}: ${n.popularDemonym}`);
  const pn = n.nickname && n.popularNickname ? n.popularNickname : !n.nickname ? n.popularNickname : undefined;
  if (pn) parts.push(`${t('nick_pop')}: ${pn}`);
  return [
    n.demonym ? t('demonym') : t('nick_pop_lbl'),
    <span className="nick-val">
      {parts.join(' · ')}{' '}
      <a href={n.src} target="_blank" rel="noopener" className="nick-src" title={t('source')}>
        <Icon name="external-link" />
      </a>
    </span>,
  ];
}
