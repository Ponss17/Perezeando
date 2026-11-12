import { norm } from '../../lib/format';

export function Highlight({ text, q }: { text: string; q?: string }) {
  if (!q) return <>{text}</>;
  const nt = norm(text);
  if (nt.length !== text.length) return <>{text}</>;
  const terms = norm(q)
    .split(/\s+/)
    .filter((x) => x.length > 1);
  const marks = new Array<boolean>(text.length).fill(false);
  for (const term of terms) {
    let i = nt.indexOf(term);
    while (i >= 0) {
      for (let k = i; k < i + term.length; k++) marks[k] = true;
      i = nt.indexOf(term, i + 1);
    }
  }
  const out: React.ReactNode[] = [];
  let buf = '';
  let on = false;
  const flush = (k: number) => {
    if (buf) out.push(on ? <mark key={k}>{buf}</mark> : buf);
    buf = '';
  };
  for (let i = 0; i < text.length; i++) {
    if (marks[i] !== on) {
      flush(i);
      on = marks[i];
    }
    buf += text[i];
  }
  flush(text.length);
  return <>{out}</>;
}
