import sample from '../data/deals.json';

const API = 'https://api.thuttu.com/';
const THUMBS = 'https://api.thuttu.com/thumbs';

// API dates are IST without a zone, e.g. "2026-10-09 01:27:04".
const parseIst = (s) => new Date(s.replace(' ', 'T') + '+05:30');

// Ask the retailer CDN for a small rendition instead of the full-size original.
// Flipkart: /image/800/1070/... -> /image/240/240/...; Amazon: ._SX679_... . -> ._SL240_.
// Unknown hosts are used as-is.
export function sizedImage(src, px) {
  if (!src) return '';
  if (/\.flixcart\.com\/image\/\d+\/\d+\//.test(src)) return src.replace(/\/image\/\d+\/\d+\//, `/image/${px}/${px}/`);
  if (/media-amazon\.com\/images\/I\//.test(src)) return src.replace(/\._[^/]*_\.(jpe?g|png|webp)$/i, `._SL${px}_.$1`);
  return src;
}

export function fromApi(d, now) {
  const medium = d.image ? `${THUMBS}/medium/${d.image}` : '';
  const small = d.image ? `${THUMBS}/small/${d.image}` : '';
  return {
    id: d.id,
    // The live site shows a prefix such as "Prime Coupon" in brackets before the title.
    title: d.prefix ? `[${d.prefix}] ${d.title}` : d.title,
    store: d.store,
    // Offer-style deals have no price (dprice 0); the card then leaves the price row empty.
    price: d.dprice || null,
    oldPrice: d.oprice || null,
    discount: d.off || null,
    // Prefer the retailer's original image; fall back to our own thumbnail if it is missing or fails to load.
    image: sizedImage(d.origimage, 240) || medium,
    imageFallback: d.origimage ? medium : '',
    thumb: sizedImage(d.origimage, 128) || small,
    thumbFallback: d.origimage ? small : '',
    url: d.plink || d.rawlink,
    likes: d.nlikes ?? 0,
    views: d.nviews ?? 0,
    comments: d.ncomments ?? 0,
    minsAgo: Math.max(1, Math.round((now - parseIst(d.date)) / 60000)),
    pinned: Boolean(d.pinned_ts),
    hot: Boolean(d.hot_ts),
  };
}

async function apiGet(params) {
  const res = await fetch(`${API}?${new URLSearchParams(params)}`, {
    headers: { authorization: 'Bearer noidtoken', 'content-type': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (!body.status || !Array.isArray(body.data)) throw new Error(body.msg || 'bad response');
  return body.data;
}

// Fetched once at build time; the static page shows whatever was live then.
// Pass `tag` (e.g. 'popular') for a tagged list, otherwise `sort` (e.g. 'new').
export async function getDeals({ sort = 'new', tag, perPage = 24, page = 1 } = {}) {
  try {
    const data = await apiGet({ act: 'gdeals', ...(tag ? { tag } : { st: sort }), ppg: String(perPage), page: String(page), lt: '' });
    const now = Date.now();
    return data.map((d) => fromApi(d, now));
  } catch (err) {
    console.warn(`[deals] API fetch failed (${err.message}); using sample data`);
    return sample;
  }
}

// Labels the live site shows above each activity entry. Only "newdeal" and
// "populardeal" have been seen in the feed so far; the rest are best guesses.
const LIVE_LABELS = {
  newdeal: 'new deal posted',
  populardeal: 'deal populared',
  hotdeal: 'deal turned hot',
  comment: 'new comment',
  like: 'deal liked',
  user: 'new user joined',
};
const LIVE_TYPES = Object.keys(LIVE_LABELS).join('|');

// Activity feed for /live. Each API page holds 10 entries; the next page is
// requested with lt=<created of the last entry>, the same way the live site does.
export async function getLive({ pages = 3 } = {}) {
  const entries = [];
  let lt = '';
  try {
    for (let i = 0; i < pages; i++) {
      const data = await apiGet({ st: LIVE_TYPES, act: 'glive', lt });
      if (!data.length) break;
      entries.push(...data);
      lt = data[data.length - 1].created;
    }
  } catch (err) {
    console.warn(`[deals] live feed fetch failed (${err.message})`);
  }
  const now = Date.now();
  const live = entries
    .filter((e) => e.info && e.info.title)
    .map((e) => ({
      id: e.id,
      label: LIVE_LABELS[e.type] ?? e.type,
      minsAgo: Math.max(1, Math.round((now - parseIst(e.created)) / 60000)),
      deal: fromApi(e.info, now),
    }));
  if (live.length) return live;
  // Feed unavailable: show the newest deals as "new deal posted" entries instead.
  return (await getDeals({ sort: 'new', perPage: 24 })).map((d) => ({ id: d.id, label: LIVE_LABELS.newdeal, minsAgo: d.minsAgo, deal: d }));
}

// Recently searched terms, shown as "Recently Browsed" on /live.
export async function getRecentSearches({ count = 40 } = {}) {
  try {
    const data = await apiGet({ act: 'getrsearch', ppg: String(count) });
    return [...new Set(data.map((r) => (r.text || '').trim().toLowerCase()).filter(Boolean))];
  } catch (err) {
    console.warn(`[deals] recent searches fetch failed (${err.message})`);
    return [];
  }
}
