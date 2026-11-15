// Günlük pompa fiyatı: GitHub Actions'ın her gün güncellediği fuel-price.json dosyasından alınır (il başına günde en çok bir kez); son değer localStorage'da tutulur.
import { todayISO } from './dates.js';

export const FUELPRICE_KEY = 'arac:v1:fuelprice';
/** Canlı fiyat açık: İstanbul, günlük statik dosya (fuel-price.json). */
export const PRICE_ENABLED = true;

const ENDPOINT = './fuel-price.json';
const TIMEOUT_MS = 10000;
const RETRY_MS = 5 * 60 * 1000;

/** Araç yakıt türüne göre gösterilecek ürün. Elektrik için null (satır gizlenir). */
export const PRODUCT = {
  dizel: { key: 'motorin', label: 'Motorin' },
  benzin: { key: 'benzin', label: 'Benzin (95)' },
  lpg: { key: 'lpg', label: 'LPG (Otogaz)' },
  hibrit: { key: 'benzin', label: 'Benzin' },
};

const status = new Map(); // il -> { loading, failed, lastTry }

function readAll() {
  try {
    const o = JSON.parse(localStorage.getItem(FUELPRICE_KEY) || '{}');
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch { return {}; }
}
function writeAll(o) {
  try { localStorage.setItem(FUELPRICE_KEY, JSON.stringify(o)); } catch { /* yoksay */ }
}

const priceOrNull = (x) => (typeof x === 'number' && isFinite(x) && x > 0 ? x : null);

/** Önbellekteki son kayıt: { il, ilName, date, source, prices, fetchedOn } veya null. */
export function getCached(il) {
  const e = readAll()[String(il)];
  if (!e || typeof e !== 'object' || typeof e.date !== 'string' || !e.prices || typeof e.prices !== 'object') return null;
  return e;
}

export const getStatus = (il) => status.get(il) || { loading: false, failed: false };

/**
 * Bugün için önbellek yoksa getirir. Başarısızlıkta eski değer korunur, failed işaretlenir.
 * Günde bir kez: bugün başarıyla alındıysa ağa çıkmaz. Başarısızlıktan sonra 5 dk bekler. onDone: durum değiştiğinde çağrılır (yeniden çizim için).
 */
export async function refresh(il, onDone, { ignoreBackoff = false } = {}) {
  if (!PRICE_ENABLED) return;
  const st = status.get(il) || { loading: false, failed: false, lastTry: 0 };
  status.set(il, st);
  if (st.loading) return;
  const cached = getCached(il);
  if (st.okOn === todayISO() || (cached && cached.fetchedOn === todayISO())) return;
  if (!ignoreBackoff && st.failed && Date.now() - st.lastTry < RETRY_MS) return;
  st.loading = true; st.lastTry = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ENDPOINT}?il=${encodeURIComponent(il)}`, { signal: ctl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error('http ' + res.status);
    const j = await res.json();
    if (!j || typeof j.date !== 'string' || !j.prices) throw new Error('bad shape');
    const all = readAll();
    all[String(il)] = {
      il, ilName: String(j.ilName || ''), date: j.date, source: String(j.source || ''), fetchedOn: todayISO(),
      prices: { motorin: priceOrNull(j.prices.motorin), benzin: priceOrNull(j.prices.benzin), lpg: priceOrNull(j.prices.lpg) },
    };
    writeAll(all);
    st.failed = false;
    st.okOn = todayISO();
  } catch {
    st.failed = true;
  } finally {
    clearTimeout(timer);
    st.loading = false;
    if (onDone) onDone();
  }
}
