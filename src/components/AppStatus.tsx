import { useNet, applyUpdate } from '../lib/sw';
import { useT } from '../i18n';

/** Píldora «Sin conexión» + aviso discreto de versión nueva (nunca recarga sola) */
export function AppStatus() {
  const { t } = useT();
  const online = useNet((s) => s.online);
  const update = useNet((s) => s.update);
  return (
    <>
      {!online && (
        <div className="net-pill" role="status" title={t('net_offline_hint')}>
          <i aria-hidden="true" />
          {t('net_offline')}
        </div>
      )}
      {update && (
        <div className="update-toast" role="status">
          <span>{t('update_avail')}</span>
          <span className="dot" aria-hidden="true">·</span>
          <button onClick={applyUpdate}>{t('update_btn')}</button>
        </div>
      )}
    </>
  );
}
