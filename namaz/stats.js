// Saf istatistik fonksiyonları (log: { "YYYY-MM-DD": { fajr: "done"|"qaza", ... } }).
import { PRAYER_IDS } from './constants.js';
import { addDays, weekdayShort } from './dates.js';

/** Bir günde işaretlenmiş (kılındı veya kaza) vakit sayısı. */
export function count(log, k) {
  const e = log[k];
  return e ? PRAYER_IDS.filter((p) => e[p]).length : 0;
}

/** Bugün veya dün biten, 5/5 günlerden oluşan ardışık seri. */
export function currentStreak(log, today) {
  let k = count(log, today) === 5 ? today : addDays(today, -1);
  let n = 0;
  while (count(log, k) === 5) { n++; k = addDays(k, -1); }
  return n;
}

export function bestStreak(log, today) {
  const keys = Object.keys(log).sort();
  if (!keys.length) return 0;
  let best = 0;
  let run = 0;
  for (let k = keys[0]; k <= today; k = addDays(k, 1)) {
    run = count(log, k) === 5 ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

/** Son 7 gün (bugün dahil), eskiden yeniye. */
export function last7(log, today) {
  return Array.from({ length: 7 }, (_, i) => {
    const key = addDays(today, i - 6);
    return { key, label: weekdayShort(key), n: count(log, key) };
  });
}

/**
 * Bugünden önceki son `days` gün (ilk kayıt gününden önceki günler sayılmaz).
 * Kayıt yoksa null; aksi halde { days, pct, per: { id: pct } } (0..1).
 */
export function windowStats(log, today, days = 30) {
  const first = Object.keys(log).sort()[0];
  const end = addDays(today, -1);
  let start = addDays(end, -(days - 1));
  if (first && first > start) start = first;
  if (!first || start > end) return null;
  const per = Object.fromEntries(PRAYER_IDS.map((p) => [p, 0]));
  let n = 0;
  let total = 0;
  for (let k = start; k <= end; k = addDays(k, 1)) {
    n++;
    for (const p of PRAYER_IDS) {
      if (log[k] && log[k][p]) { per[p]++; total++; }
    }
  }
  return { days: n, pct: total / (n * 5), per: Object.fromEntries(PRAYER_IDS.map((p) => [p, per[p] / n])) };
}

export function qazaTotal(log) {
  let n = 0;
  for (const e of Object.values(log)) for (const p of PRAYER_IDS) if (e[p] === 'qaza') n++;
  return n;
}
