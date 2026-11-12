import { useEffect } from 'react';
import { useApp } from '../store/useApp';
import { useT } from '../i18n';
import { dismissNotice, retryLocate } from '../store/tools';
import { Icon } from './Icon';

const NOTICE_KEYS = {
  denied: ['geo_denied_t', 'geo_denied_d', 'shield'],
  unavailable: ['geo_unavail_t', 'geo_unavail_d', 'locate'],
  timeout: ['geo_timeout_t', 'geo_timeout_d', 'clock'],
  insecure: ['geo_insecure_t', 'geo_insecure_d', 'shield'],
  unsupported: ['geo_unsupported_t', 'geo_unsupported_d', 'info'],
  outside: ['geo_outside_t', 'geo_outside_d', 'info'],
} as const;

export function Notice() {
  const { t } = useT();
  const n = useApp((s) => s.notice);
  useEffect(() => {
    if (!n) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && dismissNotice();
    document.addEventListener('keydown', k);
    const tm = n.code === 'outside' ? setTimeout(dismissNotice, 7000) : undefined;
    return () => {
      document.removeEventListener('keydown', k);
      clearTimeout(tm);
    };
  }, [n]);
  if (!n) return null;
  const [tk, dk, ico] = NOTICE_KEYS[n.code];
  const canRetry = n.code === 'denied' || n.code === 'unavailable' || n.code === 'timeout';
  return (
    <div
      className={'notice' + (n.code === 'outside' ? ' info' : '')}
      role="status"
      aria-live="polite"
      key={n.n}
    >
      <span className="notice-ico" aria-hidden="true">
        <Icon name={ico} />
      </span>
      <div className="notice-text">
        <b>{t(tk)}</b>
        <p>{t(dk)}</p>
        {canRetry && (
          <button type="button" className="notice-act" onClick={retryLocate}>
            {t('retry')}
          </button>
        )}
      </div>
      <button type="button" className="notice-x" aria-label={t('dismiss')} onClick={dismissNotice}>
        <Icon name="x" />
      </button>
    </div>
  );
}
