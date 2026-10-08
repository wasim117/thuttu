#!/usr/bin/env node
// Converts deal rawlinks to affiliate links and stores them in the links cache
// (.cache/links.json by default) for the Astro build to use when LINK_MODE=aff.
//
// Runs in GitHub Actions before `npm run build`. The cache file is kept between
// runs with actions/cache, so each link is converted only once.
//
// Env:
//   API_URL      thuttu API base (same as the site build)
//   E_API_TOKEN  affiliate converter token (secret)
//   A_API_URL    affiliate converter endpoint (secret)
//   LINKS_FILE   cache path (optional)
//
// Never fails the build: problems are logged and the existing cache is kept.
import fs from 'node:fs';
import path from 'node:path';
import { PAGE_FEEDS } from '../src/lib/api.js';

const LINKS_FILE = process.env.LINKS_FILE || '.cache/links.json';
const TOKEN = process.env.E_API_TOKEN || '';
const CONVERTER = process.env.A_API_URL || '';
const DELAY_MS = Number(process.env.LINKS_DELAY_MS ?? 1000); // between converter calls
const MAX_PER_RUN = 120; // safety cap on converter calls per run
const MAX_FAILS = 3; // stop retrying a link after this many failures
const PRUNE_DAYS = 30; // drop links not seen on any page for this long

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeCache(cache) {
  fs.mkdirSync(path.dirname(LINKS_FILE), { recursive: true });
  fs.writeFileSync(LINKS_FILE, `${JSON.stringify(cache, null, 2)}\n`);
}

async function convert(url) {
  const res = await fetch(CONVERTER, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ deal: url, convert_option: 'convert_only' }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const payload = await res.json();
  if (payload?.success === 1 && typeof payload.data === 'string' && /^https?:\/\//.test(payload.data)) {
    return payload.data;
  }
  throw new Error(`unexpected response: ${JSON.stringify(payload).slice(0, 200)}`);
}

async function main() {
  const cache = readCache();
  const now = new Date().toISOString();

  // Collect every rawlink the site will render.
  const seen = new Map(); // rawlink -> store
  for (const [name, load] of Object.entries(PAGE_FEEDS)) {
    try {
      for (const d of await load()) if (d?.rawlink) seen.set(d.rawlink, d.store || null);
    } catch (err) {
      console.warn(`[links] ${name} feed failed: ${err.message}`);
    }
  }
  for (const [raw, store] of seen) {
    cache[raw] = { ...(cache[raw] || { store }), lastSeen: now };
  }

  const todo = [...seen.keys()].filter((raw) => !cache[raw].aff && (cache[raw].fails || 0) < MAX_FAILS);
  console.log(`[links] ${seen.size} links on pages, ${seen.size - todo.length} cached, ${todo.length} to convert`);

  if (todo.length && (!TOKEN || !CONVERTER)) {
    console.warn('[links] E_API_TOKEN or A_API_URL not set; skipping conversion');
  } else {
    let ok = 0;
    for (const raw of todo.slice(0, MAX_PER_RUN)) {
      try {
        cache[raw] = { ...cache[raw], aff: await convert(raw), converted: now };
        delete cache[raw].fails;
        delete cache[raw].error;
        ok++;
      } catch (err) {
        cache[raw] = { ...cache[raw], fails: (cache[raw].fails || 0) + 1, error: err.message };
        console.warn(`[links] convert failed (${cache[raw].fails}/${MAX_FAILS}) ${raw}: ${err.message}`);
      }
      await sleep(DELAY_MS);
    }
    if (todo.length) console.log(`[links] converted ${ok}/${Math.min(todo.length, MAX_PER_RUN)}`);
  }

  // Prune links that have not appeared on any page for a while.
  const cutoff = Date.now() - PRUNE_DAYS * 864e5;
  let pruned = 0;
  for (const [raw, entry] of Object.entries(cache)) {
    if (!entry.lastSeen || Date.parse(entry.lastSeen) < cutoff) {
      delete cache[raw];
      pruned++;
    }
  }
  if (pruned) console.log(`[links] pruned ${pruned} old links`);

  writeCache(cache);
  console.log(`[links] saved ${Object.keys(cache).length} links to ${LINKS_FILE}`);
}

main().catch((err) => {
  console.warn(`[links] ${err.message}`);
});
