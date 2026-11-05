import { useEffect, useRef } from 'react';
import { POLICIES } from '../content/policies';
import { useT } from '../i18n';
import { closePolicies } from '../lib/policies';
import { useApp } from '../store/useApp';
import { Icon } from './Icon';

/** Cuadro de políticas: mismo lenguaje visual que el atlas, no una página aparte. */
export function PoliciesPage() {
  const open = useApp((s) => s.policiesOpen);
  const { t, lang } = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const copy = POLICIES[lang];

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    d.setAttribute('closedby', 'none');
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

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
