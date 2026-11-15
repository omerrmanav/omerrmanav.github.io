// Yerel tarih yardımcıları. Tarih anahtarları HER ZAMAN yerel saatle üretilir (toISOString kullanılmaz).

export const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const pad = (n) => String(n).padStart(2, '0');

/** Date -> "YYYY-MM-DD" (yerel). */
export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD" -> yerel gece yarısı Date. */
export function parseKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(k, n) {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/** Verilen günün "HH:MM" saatini yerel Date olarak döndürür. */
export function atTime(k, hhmm) {
  const d = parseKey(k);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

const longFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
const monthFmt = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
const wdShortFmt = new Intl.DateTimeFormat('tr-TR', { weekday: 'short' });

const shortFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' });
export const formatShort = (k) => shortFmt.format(parseKey(k));
export const formatLong = (k) => longFmt.format(parseKey(k));
export const formatMonth = (y, m) => monthFmt.format(new Date(y, m - 1, 1));
export const weekdayShort = (k) => wdShortFmt.format(parseKey(k));
