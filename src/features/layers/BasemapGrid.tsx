import { BASEMAPS, BASEMAP_IDS } from '../../data/config';
import { useApp } from '../../store/useApp';
import { useT } from '../../i18n';
import { setBase } from '../../store/tools';
import { Icon } from '../../components/Icon';

export function BasemapGrid() {
  const { L } = useT();
  const base = useApp((s) => s.base);
  return (
    <div className="basemaps">
      {BASEMAP_IDS.map((id) => {
        const b = BASEMAPS[id];
        return (
          <button
            key={id}
            className={'bm' + (base === id ? ' active' : '')}
            onClick={() => setBase(id)}
            aria-pressed={base === id}
          >
            <div
              className="bm-img"
              style={{ backgroundColor: b.thumb, backgroundImage: `url('${b.preview}')` }}
            >
              {base === id && (
                <i className="bm-check">
                  <Icon name="check" />
                </i>
              )}
            </div>
            <span>{L(b.name)}</span>
          </button>
        );
      })}
    </div>
  );
}
