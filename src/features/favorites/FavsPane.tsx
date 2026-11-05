import { useApp } from '../../store/useApp';
import { useData } from '../../data/load';
import { useT } from '../../i18n';
import type { Place } from '../../data/types';
import { routeWithFavs, toggleFav } from '../../store/actions';
import { Icon } from '../../components/Icon';
import { EmptyState, PlaceItem } from '../../components/PlaceItem';

export default function FavsPane() {
  const { t } = useT();
  const favs = useApp((s) => s.favs);
  const data = useData((s) => s.data)!;
  const list = favs.map((id) => data.byId.get(id)).filter(Boolean) as Place[];
  return (
    <section className="tab-pane active" data-pane="favs">
      <ul className="list" id="favList">
        {list.length ? (
          <>
            <li className="list-head">
              {t('tab_favs')}
              <span>{list.length}</span>
            </li>
            {list.map((p) => (
              <PlaceItem
                key={p.id}
                p={p}
                right={
                  <button
                    className="icon-btn small"
                    aria-label={t('remove')}
                    title={t('remove')}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFav(p.id);
                    }}
                  >
                    <Icon name="x" />
                  </button>
                }
              />
            ))}
          </>
        ) : (
          <EmptyState icon="bookmark" title={t('favs_empty_title')} text={t('favs_empty')} />
        )}
      </ul>
      {list.length >= 2 && (
        <div className="pane-actions wrap">
          <button className="pill wide" onClick={routeWithFavs}>
            <Icon name="route" />
            <span>{t('favs_route')}</span>
          </button>
        </div>
      )}
    </section>
  );
}
