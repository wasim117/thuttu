// Shared thuttu API access. Plain ESM with no JSON imports, so both the Astro
// build and scripts/update-links.mjs (plain Node) can use it.

// Set in GitHub (Settings → Secrets and variables → Actions) or a local .env file.
export const API = process.env.API_URL || import.meta.env?.API_URL || '';

export async function apiGet(params) {
  if (!API) throw new Error('API_URL is not set');
  const res = await fetch(`${API}?${new URLSearchParams(params)}`, {
    headers: { authorization: 'Bearer noidtoken', 'content-type': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (!body.status || !Array.isArray(body.data)) throw new Error(body.msg || 'bad response');
  return body.data;
}

// Activity types requested from the live feed.
export const LIVE_TYPES = ['newdeal', 'populardeal', 'hotdeal', 'comment', 'like', 'user'];

// Raw deal list: `tag` (e.g. 'popular') or `sort` (e.g. 'new').
export function fetchDeals({ sort = 'new', tag, perPage = 24, page = 1 } = {}) {
  return apiGet({ act: 'gdeals', ...(tag ? { tag } : { st: sort }), ppg: String(perPage), page: String(page), lt: '' });
}

// Raw live feed entries. Each API page holds 10; the next page is requested
// with lt=<created of the last entry>, the same way the live site does.
export async function fetchLive({ pages = 3 } = {}) {
  const entries = [];
  let lt = '';
  for (let i = 0; i < pages; i++) {
    const data = await apiGet({ st: LIVE_TYPES.join('|'), act: 'glive', lt });
    if (!data.length) break;
    entries.push(...data);
    lt = data[data.length - 1].created;
  }
  return entries;
}

// Every feed the site renders. scripts/update-links.mjs converts the links of
// all deals returned here, so keep it in step with the pages.
export const PAGE_FEEDS = {
  new: () => fetchDeals({ sort: 'new', perPage: 24 }),
  popular: () => fetchDeals({ tag: 'popular', perPage: 24 }),
  live: async () => (await fetchLive({ pages: 3 })).map((e) => e.info).filter(Boolean),
};
