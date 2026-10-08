export const rupees = (n) => `₹${n}`;

export function ago(mins) {
  if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''}`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hr${h > 1 ? 's' : ''}`;
  const d = Math.round(h / 24);
  return `${d} day${d > 1 ? 's' : ''}`;
}

// BASE_URL may or may not end with "/" depending on config; normalise it.
const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
export const url = (path = '') => (/^https?:\/\//.test(path) ? path : base + path.replace(/^\//, ''));
