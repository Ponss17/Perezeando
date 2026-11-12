import { useEffect, useRef, useState } from 'react';
import { fetchWikiSummary, wikiTarget } from '../../lib/wiki';

export function useDetailScroll(id: string) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.closest('.detail-pane, .panel-body')?.scrollTo({ top: 0 });
  }, [id]);
  return ref;
}

type WikiTarget = ReturnType<typeof wikiTarget>;

export function useWikiSummary(w: WikiTarget) {
  const wkey = w ? w.lang + ':' + w.title : '';
  const [wiki, setWiki] = useState<{ key: string; ex?: string; failed?: boolean } | null>(null);
  useEffect(() => {
    if (!w) return;
    let live = true;
    fetchWikiSummary(w)
      .then((d) => live && setWiki({ key: wkey, ex: d.extract ?? '' }))
      .catch(() => live && setWiki({ key: wkey, failed: true }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wkey]);
  return { wkey, wiki: wiki && wiki.key === wkey ? wiki : null };
}
