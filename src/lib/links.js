// Chooses which URL a deal links to, based on LINK_MODE:
//   raw   - plain retailer URL (rawlink), falling back to plink
//   aff   - affiliate URL from the links cache, falling back to rawlink
//   plink - thuttu's tracked redirect (plink), falling back to rawlink
// The links cache is written by scripts/update-links.mjs before the build and
// kept between builds in the GitHub Actions cache (it is not committed).
import fs from 'node:fs';

export const LINKS_FILE = process.env.LINKS_FILE || '.cache/links.json';
const MODE = (process.env.LINK_MODE || import.meta.env?.LINK_MODE || 'raw').toLowerCase();

let links;
function loadLinks() {
  if (links) return links;
  try {
    links = JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8'));
  } catch {
    links = {};
    if (MODE === 'aff') console.warn(`[links] ${LINKS_FILE} not found; using rawlink for every deal`);
  }
  return links;
}

export function pickLink(d) {
  const raw = d.rawlink || d.plink;
  if (MODE === 'plink') return d.plink || d.rawlink;
  if (MODE === 'aff') return (d.rawlink && loadLinks()[d.rawlink]?.aff) || raw;
  return raw;
}
