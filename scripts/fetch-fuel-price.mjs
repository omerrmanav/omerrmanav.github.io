// İstanbul (Avrupa yakası) günlük pompa fiyatı: Opet'in herkese açık fiyat uç noktasından ilçe medyanı.
// Günde bir kez GitHub Actions ile çalışır. Başarısızlıkta dosyayı DEĞİŞTİRMEZ ve hata koduyla çıkar (yanlış sayı yazmaz).
import { writeFileSync } from 'node:fs';

const OUT = process.argv[2] || 'arac/fuel-price.json';
const URL_ = 'https://api.opet.com.tr/api/fuelprices/prices?IncludeAllProducts=true&ProvinceCode=934'; // İstanbul Avrupa
const MIN = 20, MAX = 200, MIN_DISTRICTS = 10;

const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const valid = (x) => typeof x === 'number' && isFinite(x) && x >= MIN && x <= MAX;
const round2 = (x) => Math.round(x * 100) / 100;

const ctl = new AbortController();
const t = setTimeout(() => ctl.abort(), 15000);
let rows;
try {
  const r = await fetch(URL_, { signal: ctl.signal, headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (compatible; AracTakip/1.0)' } });
  if (!r.ok) throw new Error('opet http ' + r.status);
  rows = await r.json();
} finally { clearTimeout(t); }

if (!Array.isArray(rows) || rows.length < MIN_DISTRICTS) throw new Error('opet: beklenenden az ilçe (' + (rows && rows.length) + ')');
const pick = (codes) => {
  const v = [];
  for (const d of rows) for (const p of d.prices || []) if (codes.includes(p.productShortName) && valid(p.amount)) v.push(p.amount);
  return v.length >= MIN_DISTRICTS ? round2(median(v)) : null;
};
const motorin = pick(['MT_ECO']) ?? pick(['MT_ULT']);
const benzin = pick(['KURS']);
if (motorin == null || benzin == null) throw new Error('opet: motorin/benzin bulunamadı');

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
const out = { il: 34, ilName: 'İstanbul', date: today, source: 'Opet · İstanbul Avrupa (ilçe medyanı)', prices: { motorin, benzin, lpg: null } };
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log('yazıldı:', OUT, JSON.stringify(out.prices), today);
