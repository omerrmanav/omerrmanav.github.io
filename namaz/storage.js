// localStorage sarmalayıcısı: tüm erişimler try/catch içinde, anahtarlar `namaz:v1:` altında.
import { KEY_RE } from './dates.js';
import { PRAYER_IDS } from './constants.js';

const NS = 'namaz:v1:';

export function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(NS + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function write(key, value) {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try { localStorage.removeItem(NS + key); } catch { /* yoksay */ }
}

/** Ad alanındaki (öneksiz) anahtarlar. */
export function keys(prefix = '') {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(NS + prefix)) out.push(k.slice(NS.length));
    }
  } catch { /* yoksay */ }
  return out;
}

export function clearAll() {
  keys().forEach(remove);
}

/** Bozuk/yabancı verileri ayıklayıp temiz bir kayıt günlüğü döndürür. */
export function sanitizeLog(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [date, entry] of Object.entries(raw)) {
    if (!KEY_RE.test(date) || !entry || typeof entry !== 'object') continue;
    const clean = {};
    for (const id of PRAYER_IDS) {
      if (entry[id] === 'done' || entry[id] === 'qaza') clean[id] = entry[id];
    }
    if (Object.keys(clean).length) out[date] = clean;
  }
  return out;
}

export function validLocation(loc) {
  if (!loc || typeof loc !== 'object') return false;
  if (loc.type === 'geo') {
    return Number.isFinite(loc.lat) && Number.isFinite(loc.lon) && Math.abs(loc.lat) <= 90 && Math.abs(loc.lon) <= 180;
  }
  return loc.type === 'city' && typeof loc.city === 'string' && loc.city.length > 0 && loc.city.length < 60;
}

export const loadLog = () => sanitizeLog(read('log', {}));
export const loadLocation = () => {
  const loc = read('location', null);
  return validLocation(loc) ? loc : null;
};
export function loadSettings() {
  const s = read('settings', {});
  return { theme: ['auto', 'light', 'dark'].includes(s && s.theme) ? s.theme : 'auto' };
}

/** Yedek dosyası içeriği (önbelleğe alınmış `times:*` vakit verisi hariç). */
export function exportAll() {
  return {
    app: 'namaz',
    version: 1,
    exportedAt: new Date().toISOString(),
    log: loadLog(),
    settings: loadSettings(),
    location: loadLocation(),
  };
}

/** Yedek nesnesini doğrular. { ok:true, data } veya { ok:false, error } döndürür. */
export function validateBackup(obj) {
  if (!obj || typeof obj !== 'object' || obj.app !== 'namaz' || obj.version !== 1) {
    return { ok: false, error: 'Bu dosya geçerli bir Namaz yedeği değil.' };
  }
  if (!obj.log || typeof obj.log !== 'object' || Array.isArray(obj.log)) {
    return { ok: false, error: 'Yedek dosyasında kayıt bulunamadı.' };
  }
  const log = sanitizeLog(obj.log);
  const theme = obj.settings && ['auto', 'light', 'dark'].includes(obj.settings.theme) ? obj.settings.theme : 'auto';
  const location = validLocation(obj.location) ? obj.location : null;
  return { ok: true, data: { log, settings: { theme }, location } };
}

/** Doğrulanmış yedeği mevcut verilerin yerine yazar . */
export function importAll(data) {
  write('log', data.log);
  write('settings', data.settings);
  if (data.location) write('location', data.location);
}
