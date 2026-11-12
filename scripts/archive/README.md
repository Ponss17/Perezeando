# scripts/archive

Scripts de una sola pasada que ya se aplicaron a los datos. Se guardan como referencia; no forman parte del build ni de `pnpm build`.

- `fetch-media-v36.mjs`: pasada de medios v36 (comida/contenido a `/media`).
- `fix-media-gaps.mjs`: rellenó huecos de WebP puntuales.
- `patch-content-fauna.mjs`: parche de fauna en `provinces-content.json` (`pnpm patch-fauna-content`).
- `_strip-comments.mjs`: pasada de 2026-11-11 que quitó comentarios de código con AST.

Se ejecutan desde la raíz del repo (`node scripts/archive/<script>.mjs`). Requieren `sharp`.
