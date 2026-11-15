// Saf hesaplama fonksiyonları (DOM yok). Tarihler yerel 'YYYY-MM-DD'.

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
const val = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);

function cmpEntry(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const ka = num(a.km), kb = num(b.km);
  if (ka === null && kb === null) return 0;
  if (ka === null) return -1;
  if (kb === null) return 1;
  return ka - kb;
}

function mine(list, vehicleId) {
  return (Array.isArray(list) ? list : []).filter((e) => e && e.vehicleId === vehicleId && typeof e.date === 'string');
}

function sortedFuel(data, vehicleId) {
  return mine(data && data.fuel, vehicleId).sort(cmpEntry);
}

function vehicleOf(data, vehicleId) {
  return ((data && data.vehicles) || []).find((v) => v && v.id === vehicleId) || null;
}

function inRange(date, from, to) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function localISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Tam depo yöntemi aralıkları: [{ date, l100, km, liters }] eskiden yeniye. */
function intervals(data, vehicleId) {
  const out = [];
  let prev = null; // son km'li full kayıt
  let acc = 0;
  for (const e of sortedFuel(data, vehicleId)) {
    if (prev) acc += val(e.liters);
    if (!e.fullTank) continue;
    const km = num(e.km);
    if (prev && km !== null) {
      const diff = km - prev.km;
      if (diff > 0 && acc > 0) out.push({ date: e.date, l100: (acc / diff) * 100, km: diff, liters: acc });
    }
    prev = km !== null ? { km } : null;
    acc = 0;
  }
  return out;
}

export function consumptionSeries(data, vehicleId) {
  return intervals(data, vehicleId).map(({ date, l100 }) => ({ date, l100 }));
}

export function avgConsumption(data, vehicleId) {
  const iv = intervals(data, vehicleId);
  if (!iv.length) return null;
  let l = 0, k = 0;
  for (const i of iv) { l += i.liters; k += i.km; }
  return k > 0 ? (l / k) * 100 : null;
}

function allKms(data, vehicleId) {
  const ks = [];
  for (const e of mine(data && data.fuel, vehicleId)) if (num(e.km) !== null) ks.push(e.km);
  for (const e of mine(data && data.service, vehicleId)) if (num(e.km) !== null) ks.push(e.km);
  const v = vehicleOf(data, vehicleId);
  if (v && num(v.startKm) !== null) ks.push(v.startKm);
  return ks;
}

export function lastKm(data, vehicleId) {
  const ks = allKms(data, vehicleId);
  return ks.length ? Math.max(...ks) : null;
}

export function totals(data, vehicleId, fromISO = null, toISO = null) {
  let fuel = 0, service = 0;
  for (const e of mine(data && data.fuel, vehicleId)) if (inRange(e.date, fromISO, toISO)) fuel += val(e.total);
  for (const e of mine(data && data.service, vehicleId)) if (inRange(e.date, fromISO, toISO)) service += val(e.total);
  return { fuel, service, total: fuel + service };
}

export function costPerKm(data, vehicleId) {
  const ks = allKms(data, vehicleId);
  if (ks.length < 2) return null;
  const dist = Math.max(...ks) - Math.min(...ks);
  if (dist <= 0) return null;
  return totals(data, vehicleId).total / dist;
}

export function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Şu ay dahil son `months` ayın anahtarları, eskiden yeniye. `now` test için. */
export function lastMonthKeys(months, now = new Date()) {
  const keys = [];
  for (let i = months - 1; i >= 0; i--) keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  return keys;
}

export function monthlyTotals(data, vehicleId, months, now = new Date()) {
  const keys = lastMonthKeys(months, now);
  const map = new Map(keys.map((m) => [m, { month: m, fuel: 0, service: 0 }]));
  for (const e of mine(data && data.fuel, vehicleId)) { const r = map.get(e.date.slice(0, 7)); if (r) r.fuel += val(e.total); }
  for (const e of mine(data && data.service, vehicleId)) { const r = map.get(e.date.slice(0, 7)); if (r) r.service += val(e.total); }
  return keys.map((k) => map.get(k));
}

function parts(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return [y, m, d];
}

export function daysBetween(fromISO, toISO) {
  const [y1, m1, d1] = parts(fromISO), [y2, m2, d2] = parts(toISO);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export function reminderStatus(reminder, todayISO) {
  const daysLeft = daysBetween(todayISO, reminder.dueDate);
  const level = daysLeft < 0 ? 'overdue' : daysLeft <= 30 ? 'soon' : 'ok';
  return { daysLeft, level };
}

export function priceSeries(data, vehicleId) {
  return sortedFuel(data, vehicleId)
    .filter((e) => num(e.pricePerLiter) !== null && e.pricePerLiter > 0)
    .map((e) => ({ date: e.date, pricePerLiter: e.pricePerLiter }));
}

export function serviceByCategory(data, vehicleId, fromISO = null, toISO = null) {
  const map = new Map();
  for (const e of mine(data && data.service, vehicleId)) {
    if (!inRange(e.date, fromISO, toISO)) continue;
    const title = (e.title && String(e.title).trim()) || 'Diğer';
    const r = map.get(title) || { title, total: 0, count: 0 };
    r.total += val(e.total);
    r.count += 1;
    map.set(title, r);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function kmPerMonth(data, vehicleId) {
  const pts = [
    ...mine(data && data.fuel, vehicleId),
    ...mine(data && data.service, vehicleId),
  ].filter((e) => num(e.km) !== null).sort(cmpEntry);
  if (pts.length < 2) return null;
  const a = pts[0], b = pts[pts.length - 1];
  const days = daysBetween(a.date, b.date);
  const dist = b.km - a.km;
  if (days < 20 || dist <= 0) return null;
  return (dist / days) * 30.4375;
}
