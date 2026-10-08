import sample from '../data/deals.json';

const API = 'https://api.thuttu.com/';
const THUMBS = 'https://api.thuttu.com/thumbs';

// API dates are IST without a zone, e.g. "2026-10-09 01:27:04".
const parseIst = (s) => new Date(s.replace(' ', 'T') + '+05:30');

function fromApi(d, now) {
  return {
    id: d.id,
    title: d.title,
    store: d.store,
    price: d.dprice,
    oldPrice: d.oprice,
    discount: d.off,
    image: `${THUMBS}/medium/${d.image}`,
    thumb: `${THUMBS}/small/${d.image}`,
    url: d.plink || d.rawlink,
    likes: d.nlikes ?? 0,
    views: d.nviews ?? 0,
    comments: d.ncomments ?? 0,
    minsAgo: Math.max(1, Math.round((now - parseIst(d.date)) / 60000)),
    pinned: Boolean(d.pinned_ts),
    hot: Boolean(d.hot_ts),
  };
}

// Fetched once at build time; the static page shows whatever was live then.
export async function getDeals({ sort = 'new', perPage = 24, page = 1 } = {}) {
  const qs = new URLSearchParams({ act: 'gdeals', st: sort, ppg: String(perPage), page: String(page), lt: '' });
  try {
    const res = await fetch(`${API}?${qs}`, {
      headers: { authorization: 'Bearer noidtoken', 'content-type': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.status || !Array.isArray(body.data)) throw new Error(body.msg || 'bad response');
    const now = Date.now();
    return body.data.map((d) => fromApi(d, now));
  } catch (err) {
    console.warn(`[deals] API fetch failed (${err.message}); using sample data`);
    return sample;
  }
}
