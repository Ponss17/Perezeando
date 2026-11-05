import { useEffect, useRef } from 'react';
import { BrandLogo } from './BrandLogo';
import { POLICIES } from '../content/policies';
import { useT } from '../i18n';
import { closePolicies } from '../lib/policies';
import { useApp } from '../store/useApp';
import { Icon } from './Icon';

export function PoliciesPage() {
  const open = useApp((s) => s.policiesOpen);
  const { t, lang } = useT();
  const closeRef = useRef<HTMLButtonElement>(null);
  const copy = POLICIES[lang];

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePolicies();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div className="policies">
      <header className="policies-bar">
        <BrandLogo />
        <b>{t('brand_name')}</b>
        <button ref={closeRef} type="button" className="policies-back" onClick={closePolicies}>
          <Icon name="x" />
          <span>{t('back_map')}</span>
        </button>
      </header>
      <article className="policies-body">
        <h1>{copy.title}</h1>
        <p className="policies-lede">{copy.lede}</p>
        {copy.sections.map((s) => (
          <section key={s.h}>
            <h2>{s.h}</h2>
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
      </article>
    </div>
  );
}
