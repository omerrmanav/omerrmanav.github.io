// Araç Takip: kabuk, sekmeler ve görünümler.
import { state, bus, activeVehicle, vehicleFuel, vehicleService, vehicleReminders } from './state.js';
import { toast, sheetOpen } from './ui.js';
import { esc, fmtMoney, fmtNum, fmtDate, fmtMonth, FUEL_LABEL } from './format.js';
import { todayISO, monthStart, monthEnd, daysBetween } from './dates.js';
import { icon, typeIcon } from './icons.js';
import { openFuelForm, openServiceForm, openReminderForm, openVehicleForm, openAddMenu, openVehicleSwitcher } from './forms.js';
import { openSettings, applyTheme } from './settings.js';
import { PRICE_ENABLED, PRODUCT, getCached, getStatus, refresh } from './fuelprice.js';
import { cityName } from './provinces.js';
// Yakıt fiyatı yalnızca İstanbul için (işlev il=34 destekler); ayardaki il değeri yok sayılır.
const FIXED_CITY = 34;

const $ = (id) => document.getElementById(id);

/* ---- calc.js: dinamik içe aktarma, yoksa yedek işlevler ---- */
const C = {
  lastKm(d, vid) {
    let m = null;
    const take = (n) => { if (typeof n === 'number' && (m == null || n > m)) m = n; };
    d.fuel.concat(d.service).forEach((r) => r.vehicleId === vid && take(r.km));
    take(d.vehicles.find((v) => v.id === vid)?.startKm);
    return m;
  },
  totals(d, vid, from, to) {
    const ok = (r) => r.vehicleId === vid && (!from || r.date >= from) && (!to || r.date <= to);
    const fuel = d.fuel.filter(ok).reduce((a, r) => a + r.total, 0);
    const service = d.service.filter(ok).reduce((a, r) => a + r.total, 0);
    return { fuel, service, total: fuel + service };
  },
  reminderStatus(r, today) {
    const daysLeft = daysBetween(today, r.dueDate);
    return { daysLeft, level: daysLeft < 0 ? 'overdue' : daysLeft <= 30 ? 'soon' : 'ok' };
  },
};
const calcReady = import('./calc.js').then((m) => { for (const k of Object.keys(C)) if (typeof m[k] === 'function') C[k] = m[k]; }).catch(() => {});
const calc = (name, ...args) => { try { return C[name](...args); } catch { return null; } };
const remStatus = (r, today) => {
  try {
    const s = C.reminderStatus(r, today);
    if (s && typeof s.daysLeft === 'number') return s;
  } catch { /* yedeğe düş */ }
  const daysLeft = daysBetween(today, r.dueDate);
  return { daysLeft, level: daysLeft < 0 ? 'overdue' : daysLeft <= 30 ? 'soon' : 'ok' };
};

let reportsMod = null;
const reportsReady = import('./reports.js').then((m) => { reportsMod = m; }).catch(() => {});

const TABS = [
  ['panel', 'Panel', icon.panel], ['fuel', 'Yakıt', icon.drop], ['service', 'Servis', icon.wrench],
  ['reports', 'Raporlar', icon.chart],
];

/* ---- ortak parçalar ---- */
const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.km || 0) - (a.km || 0));

function groupMonths(list) {
  const map = new Map();
  for (const r of list.slice().sort(byDateDesc)) {
    const k = r.date.slice(0, 7);
    if (!map.has(k)) map.set(k, { key: k, items: [], sum: 0 });
    const g = map.get(k);
    g.items.push(r);
    g.sum += r.total;
  }
  return [...map.values()];
}

const fuelRow = (r) => `
  <button class="item" data-edit-fuel="${r.id}">
    <span class="ico fuel">${icon.drop}</span>
    <span class="grow"><b>${fmtDate(r.date)}</b>
      <small class="wrap"><span class="nb">${fmtNum(r.liters, 2)} L</span> · <span class="nb">${fmtMoney(r.pricePerLiter)}/L</span>${r.km != null ? ` · <span class="nb">${fmtNum(r.km)} km</span>` : ''}</small></span>
    <span class="amt">${fmtMoney(r.total)}</span>
  </button>`;

const serviceRow = (r) => `
  <button class="item" data-edit-service="${r.id}">
    <span class="ico service">${icon.wrench}</span>
    <span class="grow"><b>${esc(r.title)}</b>
      <small class="wrap"><span class="nb">${fmtDate(r.date)}</span>${r.km != null ? ` · <span class="nb">${fmtNum(r.km)} km</span>` : ''}${r.shop ? ` · ${esc(r.shop)}` : ''}</small></span>
    <span class="amt">${fmtMoney(r.total)}</span>
  </button>`;

function badge(st) {
  const d = st.daysLeft;
  const text = st.level === 'overdue' ? (d === -1 ? 'Gecikti · 1 gün' : `Gecikti · ${-d} gün`) : d === 0 ? 'Bugün' : `${d} gün kaldı`;
  return `<span class="badge ${st.level}">${text}</span>`;
}

function reminderRow(r, today) {
  const st = remStatus(r, today);
  return `
    <button class="item" data-edit-rem="${r.id}">
      <span class="ico acc ${st.level}">${typeIcon[r.type] || icon.calendar}</span>
      <span class="grow"><b>${esc(r.title)}</b>
        <small>${fmtDate(r.dueDate)}${r.repeatMonths ? ` · ${r.repeatMonths} ayda bir` : ''}</small></span>
      ${badge(st)}
    </button>`;
}

const empty = (text, btn) => `<div class="empty"><p>${text}</p>${btn || ''}</div>`;

/* ---- günlük yakıt fiyatı ---- */
function fuelPriceRow(v) {
  const prod = PRODUCT[v.fuelType];
  if (!PRICE_ENABLED || !prod) return ''; // elektrik
  const il = FIXED_CITY;
  const c = getCached(il);
  const st = getStatus(il);
  const price = c ? c.prices[prod.key] : null;
  const where = esc((c && c.ilName) || cityName(il));
  const hint = st.failed ? ' <span class="fp-warn">· güncellenemedi</span>' : '';
  let sub = '';
  if (c && price != null) sub = `${fmtDate(c.date)} itibarıyla${hint}`;
  else if (c) sub = `Bu ürün için fiyat bulunamadı${hint}`;
  else if (st.failed) sub = '<span class="fp-warn">güncellenemedi</span>';
  return `<div class="fp-row"><div class="fp-main"><span class="fp-name">${prod.label} · ${where}</span>
    <span class="fp-val">${price != null ? `${fmtNum(price, 2)} ₺/L` : '—'}</span></div>
    ${sub ? `<div class="fp-sub">${sub}</div>` : ''}</div>`;
}

/* ---- görünümler ---- */
function viewPanel(v) {
  if (!v) {
    return `<div class="card empty-hero">
      <div class="hero-ico">${icon.car.replace('width="24" height="24"', 'width="44" height="44"')}</div>
      <h2>Henüz araç yok</h2>
      <p class="muted">Aracını ekleyerek yakıt, servis ve muayene/sigorta tarihlerini takip etmeye başla.</p>
      <button class="btn" data-act="add-vehicle">Araç ekle</button></div>`;
  }
  const d = state.data, today = todayISO();
  const km = calc('lastKm', d, v.id);
  const month = calc('totals', d, v.id, monthStart(today), monthEnd(today)) || { fuel: 0, service: 0, total: 0 };
  const rems = vehicleReminders(v.id).slice().sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
  const recent = [
    ...vehicleFuel(v.id).map((r) => ({ ...r, _t: 'fuel' })),
    ...vehicleService(v.id).map((r) => ({ ...r, _t: 'service' })),
  ].sort(byDateDesc).slice(0, 3);
  const sub = [v.brand, v.model, v.year].filter(Boolean).join(' ');
  return `
    <button class="card veh-card" data-act="edit-vehicle">
      <span class="veh-dot" style="background:${v.color || 'var(--accent)'}">${icon.car}</span>
      <span class="grow"><b>${esc(v.name)}</b>
        <small>${esc(sub || 'Marka / model eklenmedi')}</small>
        <small><i class="tag">${FUEL_LABEL[v.fuelType]}</i></small></span>
      <span class="veh-km"><b class="num">${km != null ? fmtNum(km) : '—'}</b><small>km</small></span>
    </button>
    <div class="card"><div class="card-title">Bu ay harcama</div>
      <div class="stat-grid">
        <div class="stat"><div class="stat-value fuelc">${fmtMoney(month.fuel)}</div><div class="stat-label">Yakıt</div></div>
        <div class="stat"><div class="stat-value servicec">${fmtMoney(month.service)}</div><div class="stat-label">Servis</div></div>
      </div>
      ${fuelPriceRow(v)}</div>
    <div class="card"><div class="card-title">Yaklaşan tarihler</div>
      ${rems.length ? `<div class="list">${rems.map((r) => reminderRow(r, today)).join('')}</div>`
        : '<p class="muted">Henüz tarih eklenmedi (muayene, sigorta, kasko…).</p>'}
      ${rems.length ? '' : '<button class="btn ghost small" style="margin-top:12px" data-act="add-rem">Tarih ekle</button>'}</div>
    <div class="card"><div class="card-title">Son işlemler</div>
      ${recent.length ? `<div class="list">${recent.map((r) => (r._t === 'fuel' ? fuelRow(r) : serviceRow(r))).join('')}</div>`
        : '<p class="muted">Henüz kayıt yok. Sağ alttaki + ile ekleyebilirsin.</p>'}</div>`;
}

function listView(v, title, list, rowFn, emptyText, addAct, heroLabel, heroCls) {
  if (!v) return noVehicle();
  const groups = groupMonths(list);
  const body = groups.length
    ? groups.map((g) => `<section class="group"><div class="group-head"><span>${fmtMonth(g.key)}</span><span class="num">${fmtMoney(g.sum)}</span></div>
        <div class="card list">${g.items.map(rowFn).join('')}</div></section>`).join('')
    : empty(emptyText, `<button class="btn" data-act="${addAct}">Ekle</button>`);
  const sum = list.reduce((a, r) => a + r.total, 0);
  const hero = list.length ? `<div class="card total-hero"><div class="card-title">${heroLabel}</div>
    <div class="hero-value ${heroCls}">${fmtMoney(sum)}</div><div class="hero-sub">${list.length} kayıt</div></div>` : '';
  return `<h2 class="view-title">${title}</h2>${hero}${body}`;
}

const noVehicle = () => `<div class="card empty-hero"><h2>Önce bir araç ekle</h2>
  <button class="btn" data-act="add-vehicle">Araç ekle</button></div>`;

function viewReports(v) {
  if (!v) return noVehicle();
  return `<h2 class="view-title">Raporlar</h2><div id="reports-root" class="reports-root"></div>`;
}

async function mountReports() {
  const root = $('reports-root');
  const v = activeVehicle();
  if (!root || !v) return;
  await reportsReady;
  await calcReady;
  if (state.tab !== 'reports' || $('reports-root') !== root) return;
  try {
    if (!reportsMod || typeof reportsMod.renderReports !== 'function') throw new Error('reports.js yok');
    await reportsMod.renderReports(root, state.data, v.id, { fmtMoney, fmtNum, fmtDate, fmtMonth });
  } catch (e) {
    console.error(e);
    root.innerHTML = '<div class="empty"><p>Raporlar yüklenemedi.</p></div>';
  }
}

/* ---- çizim ---- */
function renderHeader() {
  const v = activeVehicle();
  $('hdr').innerHTML = `
    <button class="hdr-title" data-act="${v ? 'vehicles' : 'add-vehicle'}" aria-label="Araç seç">
      <span class="hdr-name">${v ? esc(v.name) : 'Araç Takip'}</span>${v ? icon.chevDown : ''}</button>
    <button class="icon-btn" data-act="settings" aria-label="Ayarlar">${icon.gear}</button>`;
}

function renderTabs() {
  $('tabs').innerHTML = TABS.map(([id, label, ic]) =>
    `<button class="tab" data-tab="${id}" aria-current="${state.tab === id}">${ic}<span>${label}</span></button>`).join('');
}

function render() {
  const v = activeVehicle();
  renderHeader();
  renderTabs();
  let html;
  switch (state.tab) {
    case 'fuel':
      html = listView(v, 'Yakıt', v ? vehicleFuel(v.id) : [], fuelRow, 'Henüz yakıt kaydı yok.', 'add-fuel', 'Toplam yakıt harcaması', 'fuelc'); break;
    case 'service':
      html = listView(v, 'Servis', v ? vehicleService(v.id) : [], serviceRow, 'Henüz servis kaydı yok.', 'add-service', 'Toplam servis harcaması', 'servicec'); break;
    case 'reports': html = viewReports(v); break;
    default: html = viewPanel(v);
  }
  $('view').innerHTML = html;
  $('fab').hidden = !v;
  if (state.tab === 'reports') mountReports();
  if (state.tab === 'panel' && v) refresh(FIXED_CITY, render);
}

function setTab(t) {
  if (state.tab === t) { window.scrollTo(0, 0); return; }
  state.tab = t;
  render();
  window.scrollTo(0, 0);
}

/* ---- olaylar ---- */
document.addEventListener('click', (e) => {
  if (sheetOpen()) return;
  const el = e.target.closest('[data-tab],[data-act],[data-edit-fuel],[data-edit-service],[data-edit-rem]');
  if (!el) return;
  const ds = el.dataset;
  if (ds.tab) return setTab(ds.tab);
  if (ds.editFuel) return openFuelForm(ds.editFuel);
  if (ds.editService) return openServiceForm(ds.editService);
  if (ds.editRem) return openReminderForm(ds.editRem);
  switch (ds.act) {
    case 'settings': return openSettings();
    case 'vehicles': return openVehicleSwitcher();
    case 'add-vehicle': return openVehicleForm();
    case 'edit-vehicle': return openVehicleForm(state.data.activeVehicleId);
    case 'add': return openAddMenu();
    case 'add-fuel': return openFuelForm();
    case 'add-service': return openServiceForm();
    case 'add-rem': return openReminderForm();
    default:
  }
});

bus.onChange = render;
bus.onSaveError = () => toast('Kaydedilemedi: tarayıcı deposu dolu ya da kapalı.');

applyTheme();
render();
// Sayfa açık kalırsa gün değiştiğinde durum rozetleri güncel kalsın.
let lastDay = todayISO();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && todayISO() !== lastDay) { lastDay = todayISO(); render(); }
});
calcReady.then(() => render());

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
