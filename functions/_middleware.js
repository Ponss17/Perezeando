const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SHARE_TTL = 600000;
let shareCards = null;
let shareAt = 0;

async function loadShare(context, origin) {
  if (shareCards && Date.now() - shareAt < SHARE_TTL) return shareCards;
  const share = await context.env.ASSETS.fetch(new URL('/data/share.json', origin));
  if (!share.ok) return shareCards;
  shareCards = await share.json();
  shareAt = Date.now();
  return shareCards;
}

async function withPlaceCard(context, response) {
  const url = new URL(context.request.url);
  const slug = (url.searchParams.get('lugar') || '').toLowerCase();
  const type = response.headers.get('content-type') || '';
  if (!slug || slug.includes('/') || slug.includes('..') || !type.includes('text/html') || !context.env.ASSETS) return response;
  let card = null;
  try {
    const share = await loadShare(context, url.origin);
    if (share) card = share[slug] || null;
  } catch {
    card = null;
    shareCards = null;
  }
  if (!card) return response;
  const title = card.t + ' · Perezeando';
  const desc = card.d || title;
  let html = await response.text();
  const put = (next) => () => next;
  html = html
    .replace(/<title>[^<]*<\/title>/, put('<title>' + esc(title) + '</title>'))
    .replace(/property="og:title" content="[^"]*"/, put('property="og:title" content="' + esc(title) + '"'))
    .replace(/property="og:description" content="[^"]*"/, put('property="og:description" content="' + esc(desc) + '"'))
    .replace(/name="description"\s+content="[^"]*"/, put('name="description" content="' + esc(desc) + '"'));
  if (card.i) {
    const tag =
      '<meta property="og:image" content="' +
      esc(card.i) +
      '" />\n    <meta name="twitter:card" content="summary_large_image" />';
    html = html.replace('<meta name="twitter:card" content="summary" />', put(tag));
  }
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export async function onRequest(context) {
  const response = await withPlaceCard(context, await context.next());
  const headers = new Headers(response.headers);
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  if (new URL(context.request.url).pathname.startsWith('/assets/')) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
