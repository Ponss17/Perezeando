# Media optimize pass report (2026-11-05 America/Costa_Rica)

## Disk /media
- BEFORE: 65 files, 19,528,719 bytes (~18.63 MB)
- AFTER:  189 files (62 unique × 120/320/800 WebP), 4,373,516 bytes (~4.17 MB)
- Saved: 15,155,203 bytes (~77.6%)
- Breakdown after: 120=151,048 | 320=693,226 | 800=3,529,242

## S25U typical local /media transfer (content-length)
- Jade detail hero: 87,636 B (26b1edd04a-800.webp) — no full-res original
- Teatro detail hero: 112,666 B (f3cc41fbe8-800.webp)
- SJ Comida cards (sheet full, food tab): 8× -320.webp = 99,488 B total (sizesUsed: only 320)
  - casado 22,990 | chifrijo 14,390 | gallo pinto 14,166 | tamal 10,880 | fresco 10,560 | olla 11,660 | chicharrón 7,578 | gallo 7,264

## Pipeline / SW
- scripts/fetch-media-v36.mjs + optimize-media.mjs write WebP 120/320/800 via sharp (q 72/74/78); regen will not restore JPEG/PNG heavies
- sizedThumb/thumbUrl pick 120/320/800 by render width; list/cards use ≤320; hero ≤800 (HERO_W capped 800)
- prefetchPhoto capped at min(HERO_W,320) to avoid nearby full heroes
- SW caches pathRel media/ at runtime (not precache of all 189)

## Tests
- pnpm build OK
- Preview smoke: map canvas + search present, no pageerrors; e2e select jade + showProvince food tabs OK
- Screenshots: screenshots/v36b-*-opt.png, v36b-s25u-comida-full.png, v36b-desk-*.png

## Backup
- C:\Users\gordi\AppData\Local\Temp\cr-mapa-v2-media-backup-20261105.zip (19,680,148 B)

## Scope notes
- Same photos/food selection preserved; attribution kept in JSON
- No fauna expansion; no commit/push
- AVIF not added (project WebP-only pipeline); WebP is the modern format in use
