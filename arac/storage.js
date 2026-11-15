// localStorage sarmalayıcısı: tüm erişimler try/catch içinde, yüklemede doğrulama/temizleme.
import { isValidISO, todayISO, addDays, addMonths } from './dates.js';
import { TYPE_LABEL } from './format.js';

export const DATA_KEY = 'arac:v1:data';
export const SETTINGS_KEY = 'arac:v1:settings';
export const FUEL_TYPES = ['benzin', 'dizel', 'lpg', 'hibrit', 'elektrik'];
export const REM_TYPES = ['muayene', 'trafik', 'kasko', 'egzoz', 'bakim', 'diger'];

export const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export const emptyData = () => ({ version: 1, activeVehicleId: null, vehicles: [], fuel: [], service: [], reminders: [] });

function rawGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function rawSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const num = (x) => {
  if (typeof x === 'string' && x.trim() !== '') x = Number(x);
  return typeof x === 'number' && isFinite(x) ? x : null;
};
const str = (x, max = 120) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, max) : null);

/** Bozuk/yabancı veriyi ayıklayıp sözleşmeye uygun temiz bir nesne döndürür. */
export function sanitizeData(raw) {
  const out = emptyData();
  if (!isObj(raw)) return out;
  const used = new Set();
  const uid = (id) => {
    let v = typeof id === 'string' && id && id.length < 40 ? id : newId();
    while (used.has(v)) v = newId();
    used.add(v);
    return v;
  };
  const list = (x) => (Array.isArray(x) ? x : []);

  for (const v of list(raw.vehicles)) {
    if (!isObj(v)) continue;
    const name = str(v.name, 60);
    if (!name) continue;
    const year = num(v.year);
    const startKm = num(v.startKm);
    out.vehicles.push({
      id: uid(v.id), name,
      brand: str(v.brand, 40) || '', model: str(v.model, 40) || '',
      year: year && year >= 1900 && year <= 2100 ? Math.round(year) : null,
      fuelType: FUEL_TYPES.includes(v.fuelType) ? v.fuelType : 'benzin',
      color: str(v.color, 20),
      startKm: startKm != null && startKm >= 0 ? startKm : null,
      createdAt: isValidISO(v.createdAt) ? v.createdAt : todayISO(),
    });
  }
  const vids = new Set(out.vehicles.map((v) => v.id));
  out.activeVehicleId = vids.has(raw.activeVehicleId) ? raw.activeVehicleId : (out.vehicles[0]?.id ?? null);

  for (const r of list(raw.fuel)) {
    if (!isObj(r) || !vids.has(r.vehicleId) || !isValidISO(r.date)) continue;
    const liters = num(r.liters);
    if (!(liters > 0)) continue;
    let price = num(r.pricePerLiter);
    let total = num(r.total);
    if (!(total > 0) && price > 0) total = Math.round(liters * price * 100) / 100;
    if (!(total > 0)) continue;
    if (!(price > 0)) price = Math.round((total / liters) * 100) / 100;
    const km = num(r.km);
    out.fuel.push({
      id: uid(r.id), vehicleId: r.vehicleId, date: r.date,
      km: km != null && km >= 0 ? km : null, liters, pricePerLiter: price, total,
      fullTank: r.fullTank !== false, station: str(r.station, 60), note: str(r.note, 300),
    });
  }

  for (const r of list(raw.service)) {
    if (!isObj(r) || !vids.has(r.vehicleId) || !isValidISO(r.date)) continue;
    const items = [];
    for (const it of list(r.items)) {
      if (!isObj(it)) continue;
      const cost = num(it.cost);
      if (cost == null || cost < 0) continue;
      items.push({ name: str(it.name, 80) || 'Kalem', cost });
    }
    const sum = Math.round(items.reduce((a, b) => a + b.cost, 0) * 100) / 100;
    let total = items.length && sum > 0 ? sum : num(r.total);
    if (total == null || total < 0) total = 0;
    const km = num(r.km);
    out.service.push({
      id: uid(r.id), vehicleId: r.vehicleId, date: r.date,
      km: km != null && km >= 0 ? km : null, title: str(r.title, 80) || 'Servis',
      items, total, shop: str(r.shop, 60), note: str(r.note, 300),
    });
  }

  for (const r of list(raw.reminders)) {
    if (!isObj(r) || !vids.has(r.vehicleId) || !isValidISO(r.dueDate)) continue;
    const type = REM_TYPES.includes(r.type) ? r.type : 'diger';
    const rm = num(r.repeatMonths);
    out.reminders.push({
      id: uid(r.id), vehicleId: r.vehicleId, type,
      title: str(r.title, 80) || TYPE_LABEL[type], dueDate: r.dueDate,
      repeatMonths: rm && rm >= 1 && rm <= 120 ? Math.round(rm) : null, note: str(r.note, 300),
    });
  }
  return out;
}

export function loadData() {
  const raw = rawGet(DATA_KEY);
  if (raw == null) return emptyData();
  try {
    return sanitizeData(JSON.parse(raw));
  } catch {
    rawSet('arac:v1:corrupt', raw); // bozuk veriyi kaybetmemek için kenara al
    return emptyData();
  }
}

export const saveData = (data) => rawSet(DATA_KEY, JSON.stringify(data));

export function removeData() {
  try { localStorage.removeItem(DATA_KEY); } catch { /* yoksay */ }
}

export const DEFAULT_CITY = 34;
const validCity = (c) => (Number.isInteger(c) && c >= 1 && c <= 81 ? c : null);

/** Alan eksikse/bozuksa varsayılan; diğer alanlara dokunmaz. */
export function loadSettings() {
  try {
    const s = JSON.parse(rawGet(SETTINGS_KEY) || '{}');
    return {
      theme: isObj(s) && ['auto', 'light', 'dark'].includes(s.theme) ? s.theme : 'auto',
      city: (isObj(s) && validCity(s.city)) || DEFAULT_CITY,
    };
  } catch {
    return { theme: 'auto', city: DEFAULT_CITY };
  }
}
export const saveSettings = (s) => rawSet(SETTINGS_KEY, JSON.stringify(s));

/** Yedek: arac:v1:* anahtarlarının içeriği. */
export function exportBackup(data, settings) {
  return { app: 'arac', version: 1, exportedAt: new Date().toISOString(), data, settings };
}

/** { ok:true, data, settings } veya { ok:false, error } */
export function validateBackup(obj) {
  if (!isObj(obj) || obj.app !== 'arac' || obj.version !== 1 || !isObj(obj.data)) {
    return { ok: false, error: 'Bu dosya geçerli bir Araç Takip yedeği değil.' };
  }
  const data = sanitizeData(obj.data);
  const theme = isObj(obj.settings) && ['auto', 'light', 'dark'].includes(obj.settings.theme) ? obj.settings.theme : 'auto';
  const settings = { theme };
  const city = isObj(obj.settings) ? validCity(obj.settings.city) : null;
  if (city) settings.city = city; // eski yedekte yoksa mevcut il korunur
  return { ok: true, data, settings };
}

/** Örnek veri: tek araç, ~6 ay yakıt, 2 servis, 3 tarih. */
export function makeDemo() {
  let seed = 20260;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const today = todayISO();
  const vid = newId();
  const data = emptyData();
  data.vehicles.push({
    id: vid, name: 'Renault Clio', brand: 'Renault', model: 'Clio', year: 2019, fuelType: 'benzin',
    color: '#8E8E93', startKm: 62000, createdAt: addMonths(today, -6),
  });
  data.activeVehicleId = vid;
  let km = 62350;
  let date = addDays(today, -178);
  const stations = ['Opet', 'Shell', 'Petrol Ofisi', 'BP', 'Total'];
  let i = 0;
  while (date <= today) {
    const progress = (i * 11) / 178;
    const price = Math.round((47 + progress * 11 + (rnd() - 0.5) * 2) * 100) / 100;
    const liters = Math.round((31 + rnd() * 10) * 100) / 100;
    const total = Math.round(liters * price * 100) / 100;
    km += Math.round((liters / (6.3 + rnd() * 1.2)) * 100);
    data.fuel.push({
      id: newId(), vehicleId: vid, date, km, liters, pricePerLiter: price, total,
      fullTank: rnd() > 0.15, station: stations[Math.floor(rnd() * stations.length)], note: null,
    });
    date = addDays(date, 9 + Math.floor(rnd() * 6));
    i++;
  }
  const lastKm = km;
  const mk = (daysAgo, kmBack, title, items, shop) => ({
    id: newId(), vehicleId: vid, date: addDays(today, -daysAgo), km: lastKm - kmBack, title, items,
    total: items.reduce((a, b) => a + b.cost, 0), shop, note: null,
  });
  data.service.push(
    mk(95, 2600, 'Periyodik bakım', [
      { name: 'Motor yağı', cost: 1450 }, { name: 'Yağ filtresi', cost: 380 },
      { name: 'Hava filtresi', cost: 420 }, { name: 'İşçilik', cost: 900 },
    ], 'Yetkili servis'),
    mk(40, 1000, 'Lastik', [{ name: 'Lastik değişimi (4 adet)', cost: 7200 }, { name: 'Rot balans', cost: 600 }], 'Lastikçi Ahmet'),
  );
  const rem = (type, title, days, repeat) => ({
    id: newId(), vehicleId: vid, type, title, dueDate: addDays(today, days), repeatMonths: repeat, note: null,
  });
  data.reminders.push(
    rem('muayene', 'Muayene', 18, 24),
    rem('trafik', 'Trafik sigortası', 140, 12),
    rem('bakim', 'Periyodik bakım', -5, 12),
  );
  return data;
}
