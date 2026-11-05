/**
 * Lector mínimo de archivos .osm.pbf (formato de Geofabrik/planet), sin dependencias:
 * solo node:zlib. Recorre bloques y entrega nodos, vías y relaciones con sus etiquetas.
 * Pensado para extractos chicos (Costa Rica ≈ 40 MB): unos segundos por pasada.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

class R {
  constructor(buf, pos = 0, end = buf.length) { this.b = buf; this.p = pos; this.e = end; }
  more() { return this.p < this.e; }
  varint() {
    let r = 0, m = 1, c;
    do { c = this.b[this.p++]; r += (c & 0x7f) * m; m *= 128; } while (c & 0x80);
    return r;
  }
  sv() { const n = this.varint(); return n % 2 ? -(n + 1) / 2 : n / 2; }
  tag() { const t = this.varint(); return [Math.floor(t / 8), t & 7]; }
  bytes() { const n = this.varint(); const s = this.p; this.p += n; return [s, this.p]; }
  skip(w) {
    if (w === 0) this.varint(); else if (w === 1) this.p += 8; else if (w === 2) { const n = this.varint(); this.p += n; } else if (w === 5) this.p += 4;
    else throw new Error('wire type ' + w);
  }
  packed(fn) { const [s, e] = this.bytes(); const out = []; const r = new R(this.b, s, e); while (r.more()) out.push(fn(r)); return out; }
}
const U = (r) => r.varint(), S = (r) => r.sv();
const dec = new TextDecoder();

function* blocks(file) {
  const fd = fs.openSync(file, 'r');
  const head = Buffer.alloc(4);
  let off = 0;
  try {
    while (fs.readSync(fd, head, 0, 4, off) === 4) {
      const hl = head.readUInt32BE(0); off += 4;
      const hb = Buffer.alloc(hl); fs.readSync(fd, hb, 0, hl, off); off += hl;
      let type = '', size = 0;
      const r = new R(hb);
      while (r.more()) { const [f, w] = r.tag(); if (f === 1) { const [s, e] = r.bytes(); type = dec.decode(hb.subarray(s, e)); } else if (f === 3) size = r.varint(); else r.skip(w); }
      const bb = Buffer.alloc(size); fs.readSync(fd, bb, 0, size, off); off += size;
      if (type !== 'OSMData') continue;
      const br = new R(bb);
      let data = null;
      while (br.more()) {
        const [f, w] = br.tag();
        if (f === 1) { const [s, e] = br.bytes(); data = bb.subarray(s, e); }
        else if (f === 3) { const [s, e] = br.bytes(); data = zlib.inflateSync(bb.subarray(s, e)); }
        else if (w === 2 && f !== 1 && f !== 3) { br.skip(w); if (f !== 2) throw new Error('compresión no soportada (campo ' + f + ')'); }
        else br.skip(w);
      }
      if (data) yield data;
    }
  } finally { fs.closeSync(fd); }
}

/**
 * Recorre el archivo. `want` = { nodes, ways, relations } (booleans) para saltar lo que no interesa.
 * Callbacks: node(id, lat, lng, tags|null), way(id, tags|null, refs()), relation(id, tags|null, members()).
 * Los tags se decodifican solo si hay etiquetas; refs/members son funciones (perezosas).
 */
export function scan(file, cb) {
  for (const buf of blocks(file)) {
    const r = new R(buf);
    let st = [], gran = 100, latOff = 0, lonOff = 0;
    const groups = [];
    while (r.more()) {
      const [f, w] = r.tag();
      if (f === 1) { const [s, e] = r.bytes(); const sr = new R(buf, s, e); while (sr.more()) { const [g, ww] = sr.tag(); if (g === 1) { const [a, b] = sr.bytes(); st.push(dec.decode(buf.subarray(a, b))); } else sr.skip(ww); } }
      else if (f === 2) groups.push(r.bytes());
      else if (f === 17) gran = r.varint(); else if (f === 19) latOff = r.sv(); else if (f === 20) lonOff = r.sv();
      else r.skip(w);
    }
    const ll = (v, o) => (o + gran * v) / 1e9;
    for (const [gs, ge] of groups) {
      const g = new R(buf, gs, ge);
      while (g.more()) {
        const [f, w] = g.tag();
        if (f === 2 && cb.node) { // DenseNodes
          const [s, e] = g.bytes(); const d = new R(buf, s, e);
          let ids = [], lats = [], lons = [], kv = null;
          while (d.more()) { const [h, ww] = d.tag(); if (h === 1) ids = d.packed(S); else if (h === 8) lats = d.packed(S); else if (h === 9) lons = d.packed(S); else if (h === 10) kv = d.packed(U); else d.skip(ww); }
          let id = 0, la = 0, lo = 0, k = 0;
          for (let i = 0; i < ids.length; i++) {
            id += ids[i]; la += lats[i]; lo += lons[i];
            let tags = null;
            if (kv) { while (kv[k] !== 0 && k < kv.length) { (tags ||= {})[st[kv[k]]] = st[kv[k + 1]]; k += 2; } k++; }
            cb.node(id, ll(la, latOff), ll(lo, lonOff), tags);
          }
        } else if (f === 1 && cb.node) { // Node suelto
          const [s, e] = g.bytes(); const d = new R(buf, s, e);
          let id = 0, la = 0, lo = 0, ks = [], vs = [];
          while (d.more()) { const [h, ww] = d.tag(); if (h === 1) id = d.sv(); else if (h === 2) ks = d.packed(U); else if (h === 3) vs = d.packed(U); else if (h === 8) la = d.sv(); else if (h === 9) lo = d.sv(); else d.skip(ww); }
          let tags = null; ks.forEach((x, i) => ((tags ||= {})[st[x]] = st[vs[i]]));
          cb.node(id, ll(la, latOff), ll(lo, lonOff), tags);
        } else if (f === 3 && cb.way) {
          const [s, e] = g.bytes(); const d = new R(buf, s, e);
          let id = 0, ks = [], vs = [], rs = null;
          while (d.more()) { const [h, ww] = d.tag(); if (h === 1) id = d.varint(); else if (h === 2) ks = d.packed(U); else if (h === 3) vs = d.packed(U); else if (h === 8) rs = d.bytes(); else d.skip(ww); }
          let tags = null; ks.forEach((x, i) => ((tags ||= {})[st[x]] = st[vs[i]]));
          cb.way(id, tags, () => { if (!rs) return []; const rr = new R(buf, rs[0], rs[1]); const out = []; let v = 0; while (rr.more()) out.push((v += rr.sv())); return out; });
        } else if (f === 4 && cb.relation) {
          const [s, e] = g.bytes(); const d = new R(buf, s, e);
          let id = 0, ks = [], vs = [], mem = [], ty = [];
          while (d.more()) { const [h, ww] = d.tag(); if (h === 1) id = d.varint(); else if (h === 2) ks = d.packed(U); else if (h === 3) vs = d.packed(U); else if (h === 9) mem = d.packed(S); else if (h === 10) ty = d.packed(U); else d.skip(ww); }
          let tags = null; ks.forEach((x, i) => ((tags ||= {})[st[x]] = st[vs[i]]));
          cb.relation(id, tags, () => { let v = 0; return mem.map((m, i) => ({ id: (v += m), type: ['node', 'way', 'relation'][ty[i]] })); });
        } else g.skip(w);
      }
    }
  }
}

/**
 * Busca elementos con `match(tags)` y les calcula el centro (como `out center` de Overpass).
 * Devuelve [{type,id,tags,lat,lon}] en 2–3 pasadas sobre el archivo.
 */
export function extract(file, match) {
  const hits = [], wayRefs = new Map(), relWays = new Map(), needNodes = new Set();
  scan(file, {
    node(id, lat, lon, tags) { if (tags && match(tags)) hits.push({ type: 'node', id, tags, lat, lon }); },
    way(id, tags, refs) { if (tags && match(tags)) { const r = refs(); hits.push({ type: 'way', id, tags, refs: r }); r.forEach((n) => needNodes.add(n)); } },
    relation(id, tags, members) { if (tags && match(tags)) { const m = members(); const h = { type: 'relation', id, tags, ways: m.filter((x) => x.type === 'way').map((x) => x.id), nodes: m.filter((x) => x.type === 'node').map((x) => x.id) }; hits.push(h); h.ways.forEach((w) => relWays.set(w, null)); h.nodes.forEach((n) => needNodes.add(n)); } },
  });
  if (relWays.size) scan(file, { way(id, _t, refs) { if (relWays.has(id)) { const r = refs(); relWays.set(id, r); r.forEach((n) => needNodes.add(n)); } } });
  const coords = new Map();
  if (needNodes.size) scan(file, { node(id, lat, lon) { if (needNodes.has(id)) coords.set(id, [lat, lon]); } });
  const center = (ids) => {
    let a = 90, b = -90, c = 180, d = -180, n = 0;
    for (const i of ids) { const p = coords.get(i); if (!p) continue; n++; a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); d = Math.max(d, p[1]); }
    return n ? { lat: (a + b) / 2, lon: (c + d) / 2 } : null;
  };
  const out = [];
  for (const h of hits) {
    if (h.type === 'node') { out.push(h); continue; }
    const ids = h.type === 'way' ? h.refs : [...h.nodes, ...h.ways.flatMap((w) => relWays.get(w) || [])];
    const c = center(ids);
    if (c) out.push({ type: h.type, id: h.id, tags: h.tags, center: c });
  }
  return out;
}

/** Vías que cumplen `match(tags)` con sus coordenadas en orden: [{id, tags, coords: [[lat, lon], …]}] */
export function waysWithCoords(file, match) {
  const ws = [], need = new Set();
  scan(file, { way(id, tags, refs) { if (tags && match(tags)) { const r = refs(); ws.push({ id, tags, refs: r }); r.forEach((n) => need.add(n)); } } });
  const coords = new Map();
  if (need.size) scan(file, { node(id, lat, lon) { if (need.has(id)) coords.set(id, [lat, lon]); } });
  return ws.map((w) => ({ id: w.id, tags: w.tags, coords: w.refs.map((n) => coords.get(n)).filter(Boolean) }));
}
