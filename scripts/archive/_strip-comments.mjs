import fs from 'fs';
import path from 'path';

function walk(d, a = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (['node_modules', 'dist', 'public', '.git'].includes(e.name)) continue;
      walk(p, a);
    } else if (/\.(ts|tsx|css|mjs|js)$/.test(e.name) && !e.name.endsWith('.d.ts') && e.name !== 'icons-data.ts') {
      a.push(p);
    }
  }
  return a;
}

const keep = (s) =>
  /eslint-disable|prettier-ignore|@ts-|webpackChunkName|vite-ignore|istanbul|c8 ignore|spdx|license|copyright/i.test(
    s,
  );

/** Strip // and /* *\/ comments outside of strings/templates/regex roughly via tokenizer */
function stripTsJs(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let state = 'code'; // code | squote | dquote | template | line | block | regex
  let tmplDepth = 0;
  let changed = false;

  while (i < n) {
    const c = src[i];
    const n1 = src[i + 1];

    if (state === 'line') {
      if (c === '\n') {
        state = 'code';
        out += c;
      }
      i++;
      continue;
    }
    if (state === 'block') {
      if (c === '*' && n1 === '/') {
        state = 'code';
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (state === 'squote') {
      out += c;
      if (c === '\\') {
        out += src[i + 1] ?? '';
        i += 2;
        continue;
      }
      if (c === "'") state = 'code';
      i++;
      continue;
    }
    if (state === 'dquote') {
      out += c;
      if (c === '\\') {
        out += src[i + 1] ?? '';
        i += 2;
        continue;
      }
      if (c === '"') state = 'code';
      i++;
      continue;
    }
    if (state === 'template') {
      out += c;
      if (c === '\\') {
        out += src[i + 1] ?? '';
        i += 2;
        continue;
      }
      if (c === '`') {
        state = 'code';
        i++;
        continue;
      }
      if (c === '$' && n1 === '{') {
        tmplDepth++;
        out += '{';
        i += 2;
        // enter nested code until matching }
        let depth = 1;
        while (i < n && depth > 0) {
          const ch = src[i];
          const ch1 = src[i + 1];
          // nested comments in ${}
          if (ch === '/' && ch1 === '/' && depth > 0) {
            const slice = src.slice(i, src.indexOf('\n', i) === -1 ? n : src.indexOf('\n', i));
            if (keep(slice)) {
              out += slice;
              i += slice.length;
              continue;
            }
            changed = true;
            i = src.indexOf('\n', i);
            if (i < 0) i = n;
            continue;
          }
          if (ch === '/' && ch1 === '*') {
            const end = src.indexOf('*/', i + 2);
            const slice = src.slice(i, end < 0 ? n : end + 2);
            if (keep(slice)) {
              out += slice;
              i += slice.length;
              continue;
            }
            changed = true;
            i = end < 0 ? n : end + 2;
            continue;
          }
          if (ch === "'" || ch === '"' || ch === '`') {
            // naive: copy quoted
            out += ch;
            i++;
            const q = ch;
            while (i < n) {
              out += src[i];
              if (src[i] === '\\') {
                out += src[i + 1] ?? '';
                i += 2;
                continue;
              }
              if (src[i] === q) {
                i++;
                break;
              }
              i++;
            }
            continue;
          }
          if (ch === '{') depth++;
          if (ch === '}') depth--;
          out += ch;
          i++;
        }
        tmplDepth--;
        continue;
      }
      i++;
      continue;
    }

    // code
    if (c === "'") {
      out += c;
      state = 'squote';
      i++;
      continue;
    }
    if (c === '"') {
      out += c;
      state = 'dquote';
      i++;
      continue;
    }
    if (c === '`') {
      out += c;
      state = 'template';
      i++;
      continue;
    }
    if (c === '/' && n1 === '/') {
      const end = src.indexOf('\n', i);
      const slice = src.slice(i, end < 0 ? n : end);
      if (keep(slice)) {
        out += slice;
        i += slice.length;
        continue;
      }
      changed = true;
      state = 'line';
      i += 2;
      continue;
    }
    if (c === '/' && n1 === '*') {
      const end = src.indexOf('*/', i + 2);
      const slice = src.slice(i, end < 0 ? n : end + 2);
      if (keep(slice)) {
        out += slice;
        i += slice.length;
        continue;
      }
      changed = true;
      state = 'block';
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  // collapse 3+ blank lines
  out = out.replace(/\n{3,}/g, '\n\n');
  return { out, changed };
}

function stripCss(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let changed = false;
  while (i < n) {
    const c = src[i];
    const n1 = src[i + 1];
    if (c === '"' || c === "'") {
      out += c;
      i++;
      while (i < n) {
        out += src[i];
        if (src[i] === '\\') {
          out += src[i + 1] ?? '';
          i += 2;
          continue;
        }
        if (src[i] === c) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (c === '/' && n1 === '*') {
      const end = src.indexOf('*/', i + 2);
      const slice = src.slice(i, end < 0 ? n : end + 2);
      if (keep(slice)) {
        out += slice;
        i += slice.length;
        continue;
      }
      changed = true;
      i = end < 0 ? n : end + 2;
      continue;
    }
    out += c;
    i++;
  }
  out = out.replace(/\n{3,}/g, '\n\n');
  return { out, changed };
}

const files = [...walk('src'), ...walk('scripts')].filter(
  (f) => !f.includes('_strip-comments') && !f.includes('_audit-'),
);

let n = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const isCss = f.endsWith('.css');
  const { out, changed } = isCss ? stripCss(src) : stripTsJs(src);
  if (changed && out !== src) {
    fs.writeFileSync(f, out);
    n++;
    console.log('stripped', f.replaceAll('\\', '/'));
  }
}
console.log('DONE', n, 'files');
