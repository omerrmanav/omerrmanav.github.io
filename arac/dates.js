// Yerel tarih yardımcıları. Tarih anahtarları için asla toISOString kullanılmaz.
const p2 = (n) => String(n).padStart(2, '0');

export const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
export const toISO = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const todayISO = () => toISO(new Date());

export function isValidISO(s) {
  if (typeof s !== 'string' || !ISO_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Ay ekler; gün taşarsa ayın son gününe sıkıştırır (31 Oca + 1 ay = 28/29 Şub). */
export function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const first = new Date(y, m - 1 + n, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return toISO(new Date(first.getFullYear(), first.getMonth(), Math.min(d, last)));
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** b - a, gün olarak (DST'den etkilenmez). */
export function daysBetween(aISO, bISO) {
  const [ay, am, ad] = aISO.split('-').map(Number);
  const [by, bm, bd] = bISO.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export const monthKey = (iso) => iso.slice(0, 7);
export const monthStart = (iso) => iso.slice(0, 7) + '-01';
export function monthEnd(iso) {
  const [y, m] = iso.split('-').map(Number);
  return toISO(new Date(y, m, 0));
}
