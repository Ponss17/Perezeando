import { BrandLogo } from './BrandLogo';
import { useT } from '../i18n';

export function BootSplash({ leaving, error }: { leaving?: boolean; error?: string | null }) {
  const { t } = useT();
  return (
    <div className={'boot-splash' + (leaving ? ' is-leaving' : '')} aria-busy={!leaving} aria-live="polite">
      <div className="boot-brand">
        <BrandLogo />
        <div className="boot-text">
          <p className="brand-kicker">Perezeando</p>
          <b>{t('boot_title')}</b>
          <span>{error || t('boot_loading')}</span>
        </div>
      </div>
      {!error && <span className="spinner boot-spin" />}
    </div>
  );
}
