const BOT =
  /bot\b|crawl|spider|preview|facebookexternalhit|facebookcatalog|meta-externalagent|whatsapp|telegram|slack|discord|twitter|linkedin|pinterest|skype|embedly|vkshare|iframely|mastodon|bluesky|cardyb|quora|tumblr|googlebot|bingbot|applebot|duckduck|yandex/i;

const SECURITY = {
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
};

const SHARE_TTL = 600000;
let shareCards = null;
let shareAt = 0;

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function loadShare(env, origin) {
  if (shareCards && Date.now() - shareAt < SHARE_TTL) return shareCards;
  const res = await env.ASSETS.fetch(new URL('/data/share.json', origin));
  if (!res.ok) return shareCards;
  shareCards = await res.json();
  shareAt = Date.now();
  return shareCards;
}

async function placeCard(env, url) {
  const slug = (url.searchParams.get('lugar') || '').toLowerCase();
  if (!slug || slug.includes('/') || slug.includes('..')) return null;
  try {
    const share = await loadShare(env, url.origin);
    return (share && share[slug]) || null;
  } catch {
    shareCards = null;
    return null;
  }
}

function withCard(html, card, origin) {
  const title = card.t + ' · Perezeando';
  const desc = card.d || title;
  const put = (next) => () => next;
  html = html
    .replace(/<title>[^<]*<\/title>/, put('<title>' + esc(title) + '</title>'))
    .replace(/property="og:title" content="[^"]*"/, put('property="og:title" content="' + esc(title) + '"'))
    .replace(
      /property="og:description" content="[^"]*"/,
      put('property="og:description" content="' + esc(desc) + '"'),
    )
    .replace(/name="description"\s+content="[^"]*"/, put('name="description" content="' + esc(desc) + '"'));
  if (card.i) {
    const img = new URL(card.i, origin).href;
    const tag =
      '<meta property="og:image" content="' +
      esc(img) +
      '" />\n    <meta name="twitter:card" content="summary_large_image" />';
    html = html.replace('<meta name="twitter:card" content="summary" />', put(tag));
  }
  return html;
}

function secure(res, body = res.body) {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY)) headers.set(k, v);
  return new Response(body, { status: res.status, statusText: res.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isBot = url.searchParams.has('lugar') && BOT.test(request.headers.get('user-agent') || '');
    if (!isBot) return secure(await env.ASSETS.fetch(request));

    const res = await env.ASSETS.fetch(
      new Request(url, { method: request.method, headers: { accept: 'text/html' } }),
    );
    const card =
      res.ok && (res.headers.get('content-type') || '').includes('text/html')
        ? await placeCard(env, url)
        : null;
    if (!card) return secure(res);
    const out = secure(res, withCard(await res.text(), card, url.origin));
    out.headers.delete('content-length');
    out.headers.delete('etag');
    out.headers.set('Cache-Control', 'public, max-age=600');
    out.headers.set('Vary', 'User-Agent');
    return out;
  },
};
