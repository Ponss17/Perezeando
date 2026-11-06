# Fauna + visitor + audits pass — 2026-11-05 (America/Costa_Rica)

## Counts
- Species (map places): **59** (was 26) — terrestrial + marine categories
- Local WebP `/media` on species: 57/59 (2 remain remote: `fau-lapa-roja`, `fau-ballena-piloto` — Commons 404/HTML during fetch; still have remote thumbs + attribution)
- Visitor-info sites: **15** (parks/volcanoes/playas with sourced access/activities/difficulty/notes — no invented prices/phones/hours)
- Canton/province activity items: **13** across 7 provinces
- Province fauna card items (aggregated): **41**
- Places total: **835** (was 802)
- `/public/media`: **360 files / 9,753,618 B** (was 189 / 4,373,516) — growth is new fauna WebP 120/320/800 only

## Source families
- Wikipedia / Wikispecies titles (taxonomy + descriptions)
- Wikimedia Commons (photos, licenses/artists stamped)
- Wikivoyage (visitor notes for parks)
- SINAC / UNESCO links where already in enrich or public pages
- Community festival pages via Wikipedia for fiestas (Palmares, Romería, etc.)

## Performance (S25U, CPU×4, Slow4G-ish)
| Metric | Baseline | After |
|---|---:|---:|
| Home tReady ms | 8787 | 6215 |
| Home FCP ms | 1872 | 1784 |
| Home requests | 74 | 74 |
| Home img bytes | 198311 | 198311 |
| Home net bytes (CL) | 236990 | 304264 |

Home image weight unchanged; request count unchanged. Atlas grew ~29 KB → small net-bytes rise. MapLibre already lazy-split (`lazy(() => import MapView)`); no further split this pass (would risk UX for negligible cold-home gain).

Fauna detail loads local `-800.webp`; province fauna cards use `-320`/`-120` via sizedThumb.

## Tooling
- `pnpm fetch-fauna` — build-time Commons/Wikipedia fetch → WebP 120/320/800
- `pnpm patch-fauna-content` — province fauna + activities merge
- `pnpm audit-quality` — cheap local (dup ids/coords/missing media/responsive tokens); wired into `prebuild`
- `pnpm audit-remote` — explicit throttled HEAD audit (not in build)

## Tests
- Production `pnpm build` OK
- 0 pageerrors in smoke
- Fauna detail tips + 3 related parks; province Fauna/Activities tabs; Corcovado visit block
- Screenshots: `screenshots/v37-*` and `/workspace/pz-out/screenshots/`

## Limitations
- 2 species still on remote thumbs (fetch 404)
- Representative coords are observation/range references, not guarantees
- Canton activities are a curated starter set (13), not exhaustive
- MapLibre further code-splitting deferred (already lazy)
- Fauna media disk grew ~5.4 MB (expected for 59×3 variants)
