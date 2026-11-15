// Türkçe biçimlendirme ve sayı ayrıştırma.
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function group(intStr) {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function fmtNum(n, digits = 0) {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  const neg = n < 0;
  const [i, f] = Math.abs(n).toFixed(digits).split('.');
  const out = group(i) + (f ? ',' + f : '');
  return (neg && Number(out.replace(/[.,]/g, '')) !== 0 ? '-' : '') + out;
}

export const fmtMoney = (n) => (typeof n === 'number' && isFinite(n) ? fmtNum(n, 2) + ' ₺' : '—');

export function fmtDate(iso) {
  if (typeof iso !== 'string' || iso.length < 10) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1] || '?'} ${y}`;
}

export function fmtMonth(ym) {
  if (typeof ym !== 'string' || ym.length < 7) return '—';
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1] || '?'} ${y}`;
}

/** Kullanıcı girdisi: "1.234,5", "12,5", "12.5" hepsi kabul. Geçersizse null. */
export function parseNum(str) {
  if (typeof str === 'number') return isFinite(str) ? str : null;
  let s = String(str ?? '').trim().replace(/\s/g, '');
  if (!s) return null;
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc > -1 && ld > -1) {
    // Hangisi sonda ise ondalık ayracıdır.
    s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lc > -1) {
    s = s.replace(',', '.');
  }
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(s)) return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}

/** Girdi alanına yazılacak değer: ondalık ayracı virgül. */
export function numToInput(n, maxDigits = 2) {
  if (typeof n !== 'number' || !isFinite(n)) return '';
  return String(Math.round(n * 10 ** maxDigits) / 10 ** maxDigits).replace('.', ',');
}

export const round2 = (n) => Math.round(n * 100) / 100;

export const FUEL_LABEL = { benzin: 'Benzin', dizel: 'Dizel', lpg: 'LPG', hibrit: 'Hibrit', elektrik: 'Elektrik' };
export const TYPE_LABEL = {
  muayene: 'Muayene', trafik: 'Trafik sigortası', kasko: 'Kasko',
  egzoz: 'Egzoz emisyon', bakim: 'Bakım', diger: 'Diğer',
};
