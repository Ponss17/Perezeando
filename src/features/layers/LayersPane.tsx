import { useMemo } from 'react';
import { useApp } from '../../store/useApp';
import { useData } from '../../data/load';
import { useT } from '../../i18n';
import { CATEGORIES, GROUPS } from '../../data/config';
import type { CategoryId } from '../../data/types';
import { catName, layersAll, layersNone, toggleCat, toggleGroup } from '../../store/actions';
import { LayerRow } from './LayerRow';
import { CatPin, ShapeSwatch } from '../../components/MiniMarker';
import { Icon } from '../../components/Icon';

export default function LayersPane() {
  const { t, L } = useT();
  const active = useApp((s) => s.active);
  const places = useData((s) => s.data!.places);
  const counts = useMemo(() => {
    const m = new Map<CategoryId, number>();
    places.forEach((p) => [p.cat, ...(p.also ?? [])].forEach((c) => m.set(c, (m.get(c) ?? 0) + 1)));
    return m;
  }, [places]);
  const on = new Set(active);

  return (
    <section className="tab-pane active" data-pane="layers">
      <div className="pane-head">
        <h3 className="pane-title">{t('layers_title')}</h3>
        <div className="seg">
          <button onClick={layersAll}>{t('layers_all')}</button>
          <button onClick={layersNone}>{t('layers_none')}</button>
        </div>
      </div>
      <div id="layerGroups">
        {GROUPS.map((g) => (
          <div className="group" key={g.id}>
            <div className="group-head">
              <span>{L(g.label)}</span>
              <button className="text-btn inline" onClick={() => toggleGroup(g.id)}>
                {g.cats.every((c) => on.has(c)) ? t('layers_none') : t('layers_all')}
              </button>
            </div>
            {g.cats.map((c) => (
              <LayerRow
                key={c}
                marker={<CatPin cat={c} />}
                icon={CATEGORIES[c].icon}
                color={CATEGORIES[c].color}
                name={catName(c)}
                count={counts.get(c) ?? 0}
                on={on.has(c)}
                onToggle={() => toggleCat(c)}
              />
            ))}
          </div>
        ))}
      </div>
      <MarkerKey />
    </section>
  );
}

/** Clave de símbolos del mapa (antes la leyenda flotante): formas y grupos */
function MarkerKey() {
  const { t } = useT();
  return (
    <div className="mk-key" aria-label={t('legend_title')}>
      <div className="mk-key-shapes">
        <span>
          <ShapeSwatch shape="circle" />
          {t('legend_shapes_nat')}
        </span>
        <span>
          <ShapeSwatch shape="square" />
          {t('legend_shapes_cult')}
        </span>
        <span>
          <ShapeSwatch shape="diamond" />
          {t('legend_shapes_sea')}
        </span>
      </div>
      <div className="mk-key-cl">
        <span className="cl-sample" aria-hidden="true">
          <i />
          <i />
          <i>
            <Icon name="flame" />
          </i>
          <b>N</b>
        </span>
        <span>{t('legend_cluster')}</span>
      </div>
    </div>
  );
}
