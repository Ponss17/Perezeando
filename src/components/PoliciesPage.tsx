import { POLICIES } from '../content/policies';
import { useT } from '../i18n';
import { closePolicies } from '../lib/policies';
import { useApp } from '../store/useApp';
import { Icon } from './Icon';
import { useModalDialog } from '../hooks/useModalDialog';

export function PoliciesPage() {
  const open = useApp((s) => s.policiesOpen);
  const { t, lang } = useT();
  const ref = useModalDialog(open);
  const copy = POLICIES[lang];

  return (
    <dialog
      id="policies"
      ref={ref}
      aria-labelledby="policies-title"
      onCancel={(e) => e.preventDefault()}
      onClose={() => {
        if (useApp.getState().policiesOpen) closePolicies();
      }}
    >
      {open && (
        <>
          <header className="policies-head">
            <div className="policies-title">
              <p className="brand-kicker">Perezeando</p>
              <h2 id="policies-title">{copy.title}</h2>
            </div>
            <button
              type="button"
              className="icon-btn close"
              aria-label={t('close')}
              onClick={() => ref.current?.close()}
            >
              <Icon name="x" />
            </button>
          </header>
          <div className="policies-sheet">
            <p className="policies-lede">{copy.lede}</p>
            {copy.sections.map((s) => (
              <section key={s.h}>
                <h3>{s.h}</h3>
                {s.p?.map((para) => (
                  <p key={para}>{para}</p>
                ))}
                {s.items && (
                  <ul>
                    {s.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </dialog>
  );
}
