// Aladhan (Diyanet, method=13) vakit verisi: aylık çek, localStorage'a önbellekle.
import * as store from './storage.js';
import { pad } from './dates.js';

const BASE = 'https://api.aladhan.com/v1';
const TIME_RE = /^\d{2}:\d{2}$/;
const mem = new Map(); // anahtar -> gün dizisi
const pending = new Map(); // anahtar -> süren istek

const locKey = (loc) =>
  loc.type === 'geo' ? `geo:${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}` : `city:${loc.city.toLocaleLowerCase('tr')}`;
const cacheKey = (loc, y, m) => `times:${locKey(loc)}:${y}-${pad(m)}`;

function monthUrl(loc, y, m) {
  const q = 'method=13';
  if (loc.type === 'geo') {
    return `${BASE}/calendar/${y}/${m}?latitude=${loc.lat}&longitude=${loc.lon}&${q}`;
  }
  return `${BASE}/calendarByCity/${y}/${m}?city=${encodeURIComponent(loc.city)}&country=Turkey&${q}`;
}

/** "05:12 (+03)" -> "05:12" */
const cleanTime = (s) => String(s).replace(/\s*\(.*\)\s*$/, '').trim();

/** API gününü küçük, sabit bir biçime çevirir; geçersizse null. */
function normalize(item) {
  try {
    const [dd, mm, yyyy] = item.date.gregorian.date.split('-');
    const t = {
      fajr: cleanTime(item.timings.Fajr),
      sunrise: cleanTime(item.timings.Sunrise),
      dhuhr: cleanTime(item.timings.Dhuhr),
      asr: cleanTime(item.timings.Asr),
      maghrib: cleanTime(item.timings.Maghrib),
      isha: cleanTime(item.timings.Isha),
    };
    if (!Object.values(t).every((v) => TIME_RE.test(v))) return null;
    const h = item.date.hijri;
    return { date: `${yyyy}-${mm}-${dd}`, t, h: [Number(h.day), Number(h.month.number), Number(h.year)] };
  } catch {
    return null;
  }
}

async function fetchMonth(loc, y, m) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(monthUrl(loc, y, m), { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const days = (Array.isArray(json && json.data) ? json.data : []).map(normalize).filter(Boolean);
    if (!days.length) throw new Error('Geçersiz yanıt');
    return days;
  } finally {
    clearTimeout(timer);
  }
}

/** Başka konumlara ait ve iki aydan eski önbellekleri temizler (depolama şişmesin). */
function prune(loc) {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const minYm = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}`;
  const mine = `times:${locKey(loc)}:`;
  for (const k of store.keys('times:')) {
    if (!k.startsWith(mine) || k.slice(-7) < minYm) store.remove(k);
  }
}

/** Ayın tüm günlerini döndürür: bellek -> localStorage -> ağ. */
export async function getMonth(loc, y, m) {
  const key = cacheKey(loc, y, m);
  if (mem.has(key)) return mem.get(key);
  const cached = store.read(key, null);
  if (Array.isArray(cached) && cached.length) {
    mem.set(key, cached);
    return cached;
  }
  if (!pending.has(key)) {
    pending.set(key, fetchMonth(loc, y, m)
      .then((days) => {
        mem.set(key, days);
        store.write(key, days);
        prune(loc);
        return days;
      })
      .finally(() => pending.delete(key)));
  }
  return pending.get(key);
}

export async function getDay(loc, k) {
  const [y, m] = k.split('-').map(Number);
  const days = await getMonth(loc, y, m);
  return days.find((d) => d.date === k) || null;
}

/** Yalnızca bellekteki veriyi eşzamanlı döndürür (yoksa undefined). */
export function peekDay(loc, k) {
  const [y, m] = k.split('-').map(Number);
  const days = mem.get(cacheKey(loc, y, m));
  return days && days.find((d) => d.date === k);
}

/** Ayın son günlerinde gelecek ayı önceden indirir (sessizce). */
export function prefetchNextMonth(loc) {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (now.getDate() < last - 5) return;
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  getMonth(loc, next.getFullYear(), next.getMonth() + 1).catch(() => {});
}

