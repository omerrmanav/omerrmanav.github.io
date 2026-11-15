// Raporlar ekranı: dönem seçici, özet, grafikler (elle yazılmış SVG).
import {
  totals, monthlyTotals, priceSeries, serviceByCategory, localISO,
} from './calc.js';

const PERIODS = [
  { id: '1', label: 'Bu ay', months: 1 },
  { id: '3', label: '3 ay', months: 3 },
  { id: '6', label: '6 ay', months: 6 },
  { id: '12', label: '12 ay', months: 12 },
  { id: 'all', label: 'Tümü', months: null },
];
const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

let period = '12'; // yeniden çizimlerde korunur

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const monthShort = (key) => MONTHS_SHORT[Number(key.slice(5, 7)) - 1] || key;

function periodStart(months, now) {
  const d = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  return localISO(d);
}

function monthsSpan(firstISO, now) {
  const [y, m] = firstISO.split('-').map(Number);
  return (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m) + 1;
}

export function renderReports(root, data, vehicleId, helpers) {
  const { fmtMoney, fmtNum, fmtDate, fmtMonth } = helpers;
  const vehicle = vehicleId && ((data && data.vehicles) || []).find((v) => v.id === vehicleId);
  if (!vehicleId || !vehicle) {
    root.innerHTML = '<div class="empty"><p>Önce bir araç ekleyin</p></div>';
    return;
  }
  const hasData = [...(data.fuel || []), ...(data.service || [])].some((e) => e && e.vehicleId === vehicleId);
  if (!hasData) {
    root.innerHTML = '<div class="empty"><p>Henüz yakıt veya servis kaydı yok.</p><p class="muted">Kayıt ekledikçe raporlar burada görünür.</p></div>';
    return;
  }

  const now = new Date();
  const p = PERIODS.find((x) => x.id === period) || PERIODS[3];
  const fuelAll = (data.fuel || []).filter((e) => e && e.vehicleId === vehicleId);
  const firstDate = [...fuelAll, ...(data.service || []).filter((e) => e && e.vehicleId === vehicleId)]
    .map((e) => e.date).sort()[0];
  const from = p.months ? periodStart(p.months, now) : null;
  const to = null;

  const tot = totals(data, vehicleId, from, to);
  const fuelPeriod = fuelAll.filter((e) => !from || e.date >= from);
  const liters = fuelPeriod.reduce((s, e) => s + (e.liters || 0), 0);
  const fuelSpend = fuelPeriod.reduce((s, e) => s + (e.total || 0), 0);
  const avgPrice = liters > 0 ? fuelSpend / liters : null;
  const dash = '—';
  const orDash = (v, fn) => (v === null || v === undefined || !isFinite(v) ? dash : fn(v));
  const serviceCount = (data.service || []).filter((e) => e && e.vehicleId === vehicleId && (!from || e.date >= from)).length;

  // aylık grafik ay sayısı
  let nMonths;
  if (p.months) nMonths = Math.max(p.months, 3);
  else nMonths = Math.min(24, Math.max(6, monthsSpan(firstDate, now)));
  const monthly = monthlyTotals(data, vehicleId, nMonths, now);

  const prices = priceSeries(data, vehicleId).filter((x) => !from || x.date >= from);
  const cats = serviceByCategory(data, vehicleId, from, to);

  const html = [];
  html.push(`<div class="rp" data-rp>`);
  html.push(`<div class="rp-seg" role="group" aria-label="Dönem">${PERIODS.map((x) =>
    `<button type="button" data-period="${x.id}" aria-pressed="${x.id === p.id}">${x.label}</button>`).join('')}</div>`);

  // Hero
  const fPct = tot.total > 0 ? (tot.fuel / tot.total) * 100 : 0;
  html.push(`<section class="card rp-hero" aria-label="Toplam harcama">
    <div class="rp-hero-label muted">Toplam harcama · ${p.label}</div>
    <div class="rp-hero-value">${fmtMoney(tot.total)}</div>
    <div class="rp-split" role="img" aria-label="Yakıt ${fmtMoney(tot.fuel)}, servis ${fmtMoney(tot.service)}">
      <span class="rp-split-fuel" style="width:${tot.total > 0 ? fPct : 0}%"></span><span class="rp-split-service" style="width:${tot.total > 0 ? 100 - fPct : 0}%"></span>
    </div>
    <div class="rp-legend">
      <div><span class="rp-dot rp-dot-fuel"></span><span class="muted">Yakıt</span><strong>${fmtMoney(tot.fuel)}</strong></div>
      <div><span class="rp-dot rp-dot-service"></span><span class="muted">Servis</span><strong>${fmtMoney(tot.service)}</strong></div>
    </div></section>`);

  // Aylık harcama
  html.push(`<section class="card" aria-label="Aylık harcama">
    <div class="card-title">Aylık harcama</div>
    <div class="rp-readout" data-readout aria-live="polite">Ayrıntı için bir çubuğa dokunun</div>
    ${barChart(monthly, helpers)}
  </section>`);

  // İstatistikler
  const stat = (v, l) => `<div class="stat"><div class="stat-value">${v}</div><div class="stat-label">${l}</div></div>`;
  html.push(`<section class="card" aria-label="İstatistikler"><div class="stat-grid">
    ${stat(orDash(avgPrice, (v) => fmtMoney(v)), 'Ort. yakıt ₺/L')}
    ${stat(fmtNum(liters, 1) + ' L', 'Toplam litre')}
    ${stat(fmtNum(fuelPeriod.length, 0), 'Yakıt alımı')}
    ${stat(fmtNum(serviceCount, 0), 'Servis ziyareti')}
  </div></section>`);

  // Fiyat
  html.push(`<section class="card" aria-label="Yakıt fiyatı grafiği"><div class="card-title">Yakıt fiyatı (₺/L)</div>`);
  if (prices.length >= 2) {
    html.push(lineChart(prices.map((x) => ({ date: x.date, v: x.pricePerLiter })), { color: 'var(--fuel)', label: 'Yakıt fiyatı ₺/L', fmtV: (v) => fmtMoney(v), fmtTick: (v) => fmtNum(v, 1), unit: '₺/L' }, helpers));
  } else {
    html.push(`<p class="muted rp-hint">Fiyat grafiği için en az iki yakıt kaydı gerekir</p>`);
  }
  html.push(`</section>`);

  // Servis dağılımı
  html.push(`<section class="card" aria-label="Servis dağılımı"><div class="card-title">Servis dağılımı</div>`);
  if (cats.length) {
    let rows = cats.slice(0, 6);
    if (cats.length > 6) {
      const rest = cats.slice(6);
      rows = rows.concat({ title: 'Diğer', total: rest.reduce((s, r) => s + r.total, 0), count: rest.reduce((s, r) => s + r.count, 0) });
    }
    const max = Math.max(...rows.map((r) => r.total), 1);
    html.push(`<ul class="rp-cats">${rows.map((r) => `<li>
      <div class="rp-cat-head"><span class="rp-cat-name">${esc(r.title)}</span><span class="rp-cat-amt">${fmtMoney(r.total)}</span></div>
      <div class="rp-cat-track"><span style="width:${Math.max(2, (r.total / max) * 100)}%"></span></div>
      <div class="rp-cat-count muted">${r.count} kayıt</div></li>`).join('')}</ul>`);
  } else {
    html.push(`<p class="muted rp-hint">Bu dönemde servis kaydı yok</p>`);
  }
  html.push(`</section></div>`);

  root.innerHTML = html.join('');

  // Olaylar: root içinde, her çizimde yeni içerik olduğundan sızıntı yok.
  const rp = root.querySelector('[data-rp]');
  rp.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-period]');
    if (b) {
      period = b.dataset.period;
      renderReports(root, data, vehicleId, helpers);
      return;
    }
    const bar = ev.target.closest('[data-bar]');
    if (bar) showBar(bar);
    const pt = ev.target.closest('[data-pt]');
    if (pt) showPoint(pt);
  });
  rp.addEventListener('mouseover', (ev) => {
    const bar = ev.target.closest && ev.target.closest('[data-bar]');
    if (bar) showBar(bar);
  });

  function showBar(el) {
    const i = Number(el.dataset.bar);
    const m = monthly[i];
    if (!m) return;
    rp.querySelectorAll('.rp-bar.is-sel').forEach((n) => n.classList.remove('is-sel'));
    el.classList.add('is-sel');
    const ro = rp.querySelector('[data-readout]');
    ro.innerHTML = `<strong>${esc(fmtMonth(m.month))}</strong> · Yakıt ${fmtMoney(m.fuel)} · Servis ${fmtMoney(m.service)} · <strong>${fmtMoney(m.fuel + m.service)}</strong>`;
  }
  function showPoint(el) {
    const box = el.closest('.rp-line');
    const ro = box && box.querySelector('.rp-pt-readout');
    if (ro) ro.textContent = el.dataset.pt;
  }
}

function barChart(monthly, { fmtNum, fmtMoney, fmtMonth }) {
  const W = 340, H = 190, L = 38, R = 6, T = 8, B = 24;
  const iw = W - L - R, ih = H - T - B;
  const maxRaw = Math.max(...monthly.map((m) => m.fuel + m.service), 0);
  const top = niceMax(maxRaw);
  const slot = iw / monthly.length;
  const bw = Math.min(26, slot * 0.66);
  const y = (v) => T + ih - (v / top) * ih;
  const every = monthly.length > 12 ? 2 : 1;
  let g = '';
  for (let i = 0; i <= 3; i++) {
    const v = (top / 3) * i;
    g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="rp-grid"/>` +
      `<text x="${L - 5}" y="${y(v) + 4}" text-anchor="end" class="rp-axis">${compact(v, fmtNum)}</text>`;
  }
  monthly.forEach((m, i) => {
    const x = L + slot * i + (slot - bw) / 2;
    const hf = (m.fuel / top) * ih, hs = (m.service / top) * ih;
    const yS = T + ih - hf - hs;
    const label = `${fmtMonth(m.month)}: yakıt ${fmtMoney(m.fuel)}, servis ${fmtMoney(m.service)}`;
    g += `<g class="rp-bar" data-bar="${i}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>
      <rect x="${L + slot * i}" y="${T}" width="${slot}" height="${ih}" fill="transparent"/>
      ${m.service > 0 ? `<rect x="${x}" y="${yS}" width="${bw}" height="${hs}" rx="3" class="rp-b-service"/>` : ''}
      ${m.fuel > 0 ? `<rect x="${x}" y="${T + ih - hf}" width="${bw}" height="${hf}" rx="3" class="rp-b-fuel"/>` : ''}</g>`;
    if (i % every === (monthly.length - 1) % every) {
      g += `<text x="${L + slot * i + slot / 2}" y="${H - 7}" text-anchor="middle" class="rp-axis">${monthShort(m.month)}</text>`;
    }
  });
  return `<svg class="rp-svg" viewBox="0 0 ${W} ${H}" role="group" aria-label="Aylık yakıt ve servis harcaması, yığılmış sütun grafik"><title>Aylık harcama</title>${g}</svg>`;
}

function lineChart(pts, opt, { fmtDate, fmtMoney }) {
  const W = 340, H = 170, L = 38, R = 12, T = 10, B = 24;
  const iw = W - L - R, ih = H - T - B;
  const vs = pts.map((p) => p.v);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
  const ts = pts.map((p) => dayNum(p.date));
  const t0 = ts[0], t1 = ts[ts.length - 1];
  const x = (i) => L + (t1 === t0 ? iw / 2 : ((ts[i] - t0) / (t1 - t0)) * iw);
  const y = (v) => T + ih - ((v - lo) / (hi - lo)) * ih;
  let g = '';
  for (let i = 0; i <= 3; i++) {
    const v = lo + ((hi - lo) / 3) * i;
    g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="rp-grid"/><text x="${L - 5}" y="${y(v) + 4}" text-anchor="end" class="rp-axis">${opt.fmtTick(v)}</text>`;
  }
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join('');
  const area = `${path}L${x(pts.length - 1).toFixed(1)} ${T + ih}L${x(0).toFixed(1)} ${T + ih}Z`;
  g += `<path d="${area}" fill="${opt.color}" opacity="0.1"/><path d="${path}" fill="none" stroke="${opt.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  pts.forEach((p, i) => {
    const txt = `${fmtDate(p.date)}: ${opt.fmtV(p.v)}`;
    g += `<g data-pt="${esc(txt)}" class="rp-pt"><title>${esc(txt)}</title><circle cx="${x(i)}" cy="${y(p.v)}" r="14" fill="transparent"/><circle cx="${x(i)}" cy="${y(p.v)}" r="3.5" fill="var(--surface)" stroke="${opt.color}" stroke-width="2"/></g>`;
  });
  g += `<text x="${L}" y="${H - 7}" text-anchor="start" class="rp-axis">${esc(shortDate(pts[0].date))}</text>`;
  if (pts.length > 1) g += `<text x="${W - R}" y="${H - 7}" text-anchor="end" class="rp-axis">${esc(shortDate(pts[pts.length - 1].date))}</text>`;
  const last = pts[pts.length - 1];
  return `<div class="rp-line"><div class="rp-readout rp-pt-readout" aria-live="polite">Son: ${esc(fmtDate(last.date))}: ${esc(opt.fmtV(last.v))}</div>
    <svg class="rp-svg" viewBox="0 0 ${W} ${H}" role="group" aria-label="${esc(opt.label)}, çizgi grafik, ${pts.length} nokta"><title>${esc(opt.label)}</title>${g}</svg></div>`;
}

function dayNum(iso) { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; }
function shortDate(iso) { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`; }
function niceMax(v) {
  if (v <= 0) return 3;
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  for (const s of [1.5, 3, 6, 9, 15, 30]) if (v <= s * e) return s * e; // 3 aralığa bölünür
  return 30 * e;
}
function compact(v, fmtNum) {
  if (v >= 1000) return fmtNum(v / 1000, v % 1000 === 0 ? 0 : 1) + ' B';
  return fmtNum(v, 0);
}
