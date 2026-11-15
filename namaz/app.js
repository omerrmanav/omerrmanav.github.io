// Namaz Takip: ana uygulama (durum, ekranlar, olaylar).
import * as store from './storage.js';
import { getDay, peekDay, prefetchNextMonth } from './api.js';
import { PRAYERS, PRAYER_IDS, PRAYER_NAME, HIJRI_MONTHS, PROVINCES } from './constants.js';
import { dateKey, addDays, atTime, formatLong, formatShort, formatMonth, pad } from './dates.js';
import { count, currentStreak, bestStreak, last7, windowStats, qazaTotal } from './stats.js';
import { icon } from './icons.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => dateKey(new Date());
const THEME_COLORS = { light: '#0f766e', dark: '#0b1f1e' };
const TAB_TITLES = { cal: 'Geçmiş', stats: 'İstatistik' };

// ---------- Durum ----------
const S = {
  tab: 'today',
  viewDate: today(),
  lastToday: today(),
  cal: { y: new Date().getFullYear(), m: new Date().getMonth() + 1 },
  loc: store.loadLocation(),
  settings: store.loadSettings(),
  log: store.loadLog(),
  dayData: null, // { status: 'loading'|'ok'|'error', day }
  tomorrow: null, // yarının verisi (Yatsı sonrası geri sayım için)
  now: new Date(),
  tlKey: null,
  sheet: null, // { type: 'menu'|'day'|'settings', ... }
  suppressClick: false,
};

// ---------- Tema ----------
function applyTheme() {
  const t = S.settings.theme;
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.dataset.theme = t; else delete root.dataset.theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.content = t === 'auto' ? m.dataset.auto : THEME_COLORS[t];
  });
}

// ---------- Vakit mantığı ----------
/** Şu anki (cur) ve sıradaki (next) vakit. cur: vaktin penceresi içindeyse id, değilse null. */
function timeline(day) {
  const starts = PRAYER_IDS.map((id) => ({ id, at: atTime(day.date, day.t[id]) }));
  let cur = null;
  for (const s of starts) if (s.at <= S.now) cur = s.id;
  if (cur === 'fajr' && atTime(day.date, day.t.sunrise) <= S.now) cur = null; // güneş doğdu, Sabah bitti
  let next = starts.find((s) => s.at > S.now) || null;
  if (!next && S.tomorrow) next = { id: 'fajr', at: atTime(S.tomorrow.date, S.tomorrow.t.fajr), tomorrow: true };
  return { cur, next };
}

/** Bugün için vakti girmemişse işaretlenemez; geçmiş günler serbest, gelecek günler kapalı. */
function canMark(k, id, day) {
  const t = today();
  if (k > t) return false;
  if (k < t) return true;
  return day ? atTime(k, day.t[id]) <= S.now : true;
}

function setMark(k, id, value) {
  const e = S.log[k] || (S.log[k] = {});
  if (value) e[id] = value; else delete e[id];
  if (!Object.keys(e).length) delete S.log[k];
  store.write('log', S.log);
}

function fmtCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

const hijriText = (day) => (day ? `${day.h[0]} ${HIJRI_MONTHS[day.h[1] - 1] || ''} ${day.h[2]}` : '');

// ---------- Veri yükleme ----------
async function loadView() {
  if (!S.loc) return;
  const k = S.viewDate;
  const cached = peekDay(S.loc, k);
  S.dayData = cached ? { status: 'ok', day: cached } : { status: 'loading' };
  render();
  if (!cached) {
    try {
      const day = await getDay(S.loc, k);
      if (k !== S.viewDate) return;
      S.dayData = day ? { status: 'ok', day } : { status: 'error' };
    } catch {
      if (k !== S.viewDate) return;
      S.dayData = { status: 'error' };
    }
    render();
  }
  loadTomorrow();
  prefetchNextMonth(S.loc);
}

async function loadTomorrow() {
  try { S.tomorrow = await getDay(S.loc, addDays(today(), 1)); } catch { S.tomorrow = null; }
  S.tlKey = null;
  if (S.tab === 'today') renderView();
}

// ---------- Çizim: üst başlık ve sekmeler ----------
function renderHeader() {
  let title = TAB_TITLES[S.tab] || formatShort(S.viewDate);
  let sub = '';
  const nav = S.tab === 'today';
  if (nav) {
    const h = S.dayData && S.dayData.status === 'ok' ? hijriText(S.dayData.day) : '';
    sub = S.viewDate === today() ? `Bugün${h ? ' · ' + h : ''}` : h;
  } else if (S.tab === 'cal') {
    sub = 'Aylık takip özeti';
  } else {
    sub = 'Düzenliliğin ve serilerin';
  }
  $('#hdr').innerHTML = `
    <button class="icon-btn" data-act="day-prev" aria-label="Önceki gün" ${nav ? '' : 'hidden'}>${icon.left}</button>
    <div class="hdr-main"><h1>${esc(title)}</h1><p>${esc(sub)}</p></div>
    <button class="icon-btn" data-act="day-next" aria-label="Sonraki gün" ${nav ? '' : 'hidden'} ${S.viewDate >= today() ? 'disabled' : ''}>${icon.right}</button>
    <button class="icon-btn" data-act="settings" aria-label="Ayarlar">${icon.gear}</button>`;
}

function renderTabs() {
  const tabs = [['today', 'Bugün', icon.today], ['cal', 'Geçmiş', icon.calendar], ['stats', 'İstatistik', icon.chart]];
  $('#tabs').innerHTML = tabs.map(([id, label, ic]) =>
    `<button class="tab" data-act="tab" data-tab="${id}" ${S.tab === id ? 'aria-current="page"' : ''}>${ic}<span>${label}</span></button>`).join('');
}

function render() {
  renderHeader();
  renderView();
}

function renderView() {
  const view = $('#view');
  if (S.tab === 'today') view.innerHTML = todayHtml();
  else if (S.tab === 'cal') view.innerHTML = calendarHtml();
  else view.innerHTML = statsHtml();
}

// ---------- Ekran: Bugün ----------
function ringHtml(n) {
  const C = 2 * Math.PI * 34;
  return `<div class="ring"><svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
    <circle class="track" cx="42" cy="42" r="34" fill="none" stroke-width="8"/>
    <circle class="bar" cx="42" cy="42" r="34" fill="none" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - n / 5)).toFixed(1)}"/></svg>
    <div class="txt"><span>${n}<small>/5</small></span></div></div>`;
}

function rowHtml(p, k, day, cur) {
  const v = S.log[k] && S.log[k][p.id];
  const ok = canMark(k, p.id, day);
  let sub = v === 'done' ? 'Kılındı' : v === 'qaza' ? 'Kaza' : !ok ? 'Vakti henüz girmedi' : cur === p.id ? 'Şu an vakti içinde' : 'İşaretlenmedi';
  const chk = v === 'done' ? icon.check : v === 'qaza' ? icon.qaza : '';
  return `<div class="row ${v ? 'is-' + v : ''} ${cur === p.id ? 'is-active' : ''} ${ok ? '' : 'is-disabled'}">
    <button class="row-main" data-act="toggle" data-p="${p.id}" ${ok ? '' : 'disabled'} aria-label="${p.name}: ${sub}">
      <span class="chk">${chk}</span>
      <span class="rt"><b>${p.name}</b><span>${sub}</span></span>
      <span class="rtime num">${day.t[p.id]}</span>
    </button>
    <button class="more" data-act="more" data-p="${p.id}" ${ok ? '' : 'disabled'} aria-label="${p.name} seçenekleri">${icon.more}</button>
  </div>`;
}

function todayHtml() {
  const d = S.dayData;
  if (!d || d.status === 'loading') return '<div class="skeleton"></div><div class="skeleton" style="height:90px"></div><div class="skeleton" style="height:300px"></div>';
  if (d.status === 'error') {
    return `<div class="card center-card"><h2>Vakitler yüklenemedi</h2>
      <p class="muted">İnternet bağlantınızı kontrol edip tekrar deneyin. Bu ayın vakitleri bir kez indirildikten sonra çevrimdışı da çalışır.</p>
      <button class="pill-btn" data-act="retry">Tekrar dene</button></div>`;
  }
  const k = S.viewDate;
  const day = d.day;
  const isToday = k === today();
  const { cur, next } = isToday ? timeline(day) : { cur: null, next: null };
  S.tlKey = `${cur}|${next ? next.id + (next.tomorrow ? 't' : '') : '-'}`;

  let top;
  if (isToday) {
    const nextName = next ? PRAYER_NAME[next.id] : '—';
    const cap = next ? `${next.tomorrow ? 'Yarın ' : ''}${PRAYERS.find((p) => p.id === next.id).caption} · ${next.tomorrow ? S.tomorrow.t.fajr : day.t[next.id]}` : 'Yarının vakitleri yüklenemedi';
    const nowTxt = cur ? `Şu an: ${PRAYER_NAME[cur]} vakti` : atTime(k, day.t.sunrise) <= S.now && atTime(k, day.t.dhuhr) > S.now ? 'Güneş doğdu, Sabah vakti çıktı' : '';
    top = `<section class="card next fade-in"><div class="lbl">Sıradaki vakit</div><div class="name">${nextName}</div>
      <div class="cd num" id="cd">${next ? fmtCountdown(next.at - S.now) : '--:--:--'}</div><div class="at">${cap}</div>
      ${nowTxt ? `<span class="now">${nowTxt}</span>` : ''}</section>`;
  } else {
    top = `<section class="card next"><div class="lbl">Geçmiş gün</div><div class="name">${esc(formatLong(k))}</div>
      <button class="pill-btn" data-act="day-today">Bugüne dön</button></section>`;
  }

  const n = count(S.log, k);
  const t = today();
  const progress = `<section class="card progress">${ringHtml(n)}<div class="kv">
    <div><b>${currentStreak(S.log, t)}</b><span>Seri (gün)</span></div>
    <div><b>${bestStreak(S.log, t)}</b><span>En iyi seri</span></div></div></section>`;

  const rows = PRAYERS.map((p) => (p.id === 'dhuhr'
    ? `<div class="row info"><span class="chk-sp">${icon.sun}</span><span class="rt"><b>Güneş</b><span>Sabah namazı güneşin doğuşuna kadardır</span></span><span class="rtime num">${day.t.sunrise}</span></div>`
    : '') + rowHtml(p, k, day, cur)).join('');
  return `${top}${progress}<section class="card rows">${rows}</section>`;
}

// ---------- Ekran: Geçmiş ----------
function calendarHtml() {
  const { y, m } = S.cal;
  const t = today();
  const first = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Pazartesi başlangıçlı
  const dim = new Date(y, m, 0).getDate();
  const atMax = y === new Date().getFullYear() && m === new Date().getMonth() + 1;
  let cells = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((w) => `<div class="cal-wd">${w}</div>`).join('');
  cells += '<div class="cell empty"></div>'.repeat(first);
  let total = 0;
  let full = 0;
  for (let d = 1; d <= dim; d++) {
    const k = `${y}-${pad(m)}-${pad(d)}`;
    const n = count(S.log, k);
    total += n;
    if (n === 5) full++;
    cells += `<button class="cell l${n} ${k === t ? 'today' : ''}" data-act="cal-day" data-date="${k}" ${k > t ? 'disabled' : ''} aria-label="${esc(formatLong(k))}: ${n} vakit">${d}</button>`;
  }
  const legend = [0, 1, 2, 3, 4, 5].map((n) => `<i class="cell l${n}" style="min-height:0"></i>`).join('');
  return `<section class="card">
    <div class="cal-head"><button class="icon-btn" data-act="cal-prev" aria-label="Önceki ay">${icon.left}</button>
      <h2>${esc(formatMonth(y, m))}</h2>
      <button class="icon-btn" data-act="cal-next" aria-label="Sonraki ay" ${atMax ? 'disabled' : ''}>${icon.right}</button></div>
    <div class="cal-grid">${cells}</div>
    <div class="legend"><span>0</span>${legend}<span>5 vakit</span></div></section>
    <section class="card"><div class="card-title">Bu ay</div>
      <div class="kv" style="display:grid"><div><b>${total}</b><span>İşaretlenen vakit</span></div><div><b>${full}</b><span>Tam gün (5/5)</span></div></div></section>`;
}

// ---------- Ekran: İstatistik ----------
function statsHtml() {
  const t = today();
  const days = last7(S.log, t);
  const W = 308;
  const bars = days.map((d, i) => {
    const h = Math.round((d.n / 5) * 70);
    const x = 8 + i * 44;
    return `<rect class="b ${d.n === 5 ? 'full' : ''}" x="${x}" y="${84 - h}" width="28" height="${Math.max(h, 3)}" rx="7"/>
      <text class="v" x="${x + 14}" y="${78 - h}">${d.n}</text><text x="${x + 14}" y="108">${esc(d.label)}</text>`;
  }).join('');
  const w = windowStats(S.log, t, 30);
  let perHtml = '<p class="muted">Henüz yeterli veri yok. Birkaç gün işaretledikten sonra burada görünecek.</p>';
  let missed = '';
  if (w) {
    const order = PRAYERS.slice();
    const min = Math.min(...order.map((p) => w.per[p.id]));
    perHtml = order.map((p) => {
      const pc = Math.round(w.per[p.id] * 100);
      return `<div class="hbar ${w.per[p.id] === min && min < 1 ? 'low' : ''}"><span>${p.name}</span><div class="tr"><div class="fl" style="width:${pc}%"></div></div><em>%${pc}</em></div>`;
    }).join('');
    if (min < 1) {
      const worst = order.find((p) => w.per[p.id] === min);
      missed = `<p class="note">En sık aksayan vakit: <b>${worst.name}</b></p>`;
    }
  }
  return `<div class="tiles">
      <section class="card tile"><b>${currentStreak(S.log, t)}</b><span>Mevcut seri (gün)</span></section>
      <section class="card tile"><b>${bestStreak(S.log, t)}</b><span>En iyi seri (gün)</span></section></div>
    <section class="card"><div class="card-title">Son 7 gün</div>
      <svg class="bars7" viewBox="0 0 ${W} 116" role="img" aria-label="Son 7 günde kılınan vakit sayıları">${bars}</svg></section>
    <section class="card"><div class="card-title">Son 30 gün</div>
      <div class="big-pct">${w ? '%' + Math.round(w.pct * 100) : '—'}</div>
      <p class="note">Bugünden önceki ${w ? w.days : 30} gün için tamamlanma oranı (kılındı + kaza).</p></section>
    <section class="card"><div class="card-title">Vakitlere göre</div>${perHtml}${missed}</section>
    <section class="card tile"><b>${qazaTotal(S.log)}</b><span>Toplam kaza işareti</span></section>`;
}

// ---------- Alt sayfalar ----------
function openSheet(state, html) {
  S.sheet = state;
  $('#sheet-body').innerHTML = `<div class="grab"></div>${html}`;
  $('#sheet').hidden = false;
}

function closeSheet() {
  S.sheet = null;
  $('#sheet').hidden = true;
  $('#sheet-body').innerHTML = '';
}

function openPrayerMenu(id) {
  const k = S.viewDate;
  const btn = (v, label, cls) => `<button class="menu-btn ${cls}" data-act="set" data-date="${k}" data-p="${id}" data-v="${v}">${label}</button>`;
  openSheet({ type: 'menu' }, `<h2>${PRAYER_NAME[id]}</h2>${btn('done', 'Kılındı', 'accent')}${btn('qaza', 'Kaza', 'warn')}${btn('', 'Temizle', '')}
    <button class="menu-btn" data-act="close">Vazgeç</button>`);
}

function daySheetHtml(k) {
  const day = peekDay(S.loc, k);
  const rows = PRAYERS.map((p) => {
    const v = (S.log[k] && S.log[k][p.id]) || '';
    const dis = canMark(k, p.id, day) ? '' : 'disabled';
    const b = (val, label, cls) => `<button class="${cls}" data-act="set" data-date="${k}" data-p="${p.id}" data-v="${val}" aria-pressed="${v === val}" ${dis}>${label}</button>`;
    return `<div class="day-row"><b>${p.name}</b><div class="seg">${b('', 'Yok', '')}${b('done', 'Kıldım', 'd')}${b('qaza', 'Kaza', 'q')}</div></div>`;
  }).join('');
  return `<h2>${esc(formatLong(k))}</h2><div class="card">${rows}</div>
    ${k === today() ? '<p class="note">Vakti henüz girmemiş namazlar işaretlenemez.</p>' : ''}
    <button class="menu-btn" data-act="close">Kapat</button>`;
}

function openDaySheet(k) {
  openSheet({ type: 'day', date: k }, daySheetHtml(k));
}

function settingsHtml() {
  const loc = S.loc;
  const locLabel = loc ? (loc.type === 'geo' ? `Konumum (${loc.lat.toFixed(2)}, ${loc.lon.toFixed(2)})` : loc.city) : 'Seçilmedi';
  const th = (v, label) => `<button data-act="theme" data-v="${v}" aria-pressed="${S.settings.theme === v}">${label}</button>`;
  return `<h2>Ayarlar</h2>
    <div class="card"><div class="card-title">Konum</div>
      <div class="set-row"><div class="l">${icon.pin}<span>${esc(locLabel)}</span></div><button class="link-btn" data-act="change-loc">Değiştir</button></div></div>
    <div class="card"><div class="card-title">Tema</div><div class="seg">${th('auto', 'Otomatik')}${th('light', 'Açık')}${th('dark', 'Koyu')}</div></div>
    <div class="card"><div class="card-title">Veriler</div>
      <div class="set-row"><button class="link-btn" data-act="export">${icon.download} Yedeği indir</button></div>
      <div class="set-row"><button class="link-btn" data-act="import">${icon.upload} Yedeği yükle</button></div>
      <div class="set-row"><button class="link-btn danger" data-act="wipe">${icon.trash} Tüm verileri sil</button></div>
      <input type="file" id="imp" accept=".json,application/json" hidden>
      <p class="note">Verileriniz yalnızca bu cihazda ve bu tarayıcıda saklanır. Başka bir cihaza taşımak için yedek alın.</p></div>
    <button class="menu-btn" data-act="close">Kapat</button>`;
}

// ---------- Konum / karşılama ----------
function showOnboarding(canCancel) {
  const onb = $('#onb');
  onb.innerHTML = `<div class="onb-in">
    <img class="mark" src="icons/icon-192.png" alt="" width="84" height="84">
    <h1>Namaz Takip</h1>
    <p class="muted">Vakitleri gösterebilmek için bulunduğunuz yeri seçin. Verileriniz yalnızca bu cihazda kalır.</p>
    <button class="pill-btn" data-act="loc-geo" id="geo-btn">${icon.pin} Konumumu kullan</button>
    <div class="or">veya şehir seçin</div>
    <input class="field" id="city-in" list="cities" placeholder="Şehir adı yazın (ör. Ankara)" autocomplete="off" autocapitalize="words" enterkeyhint="done">
    <datalist id="cities">${PROVINCES.map((c) => `<option value="${c}">`).join('')}</datalist>
    <button class="pill-btn ghost" data-act="loc-city">Şehri kullan</button>
    <div class="err" id="onb-err" role="alert"></div>
    ${canCancel ? '<button class="link-btn" data-act="loc-cancel" style="justify-self:center">Vazgeç</button>' : ''}</div>`;
  onb.hidden = false;
}

function setOnbError(msg) { const e = $('#onb-err'); if (e) e.textContent = msg; }

function applyLocation(loc) {
  S.loc = loc;
  store.write('location', loc);
  $('#onb').hidden = true;
  closeSheet();
  S.tomorrow = null;
  S.viewDate = today();
  S.tab = 'today';
  renderTabs();
  loadView();
}

function useGeolocation() {
  const btn = $('#geo-btn');
  if (!navigator.geolocation) { setOnbError('Bu cihaz konum özelliğini desteklemiyor. Lütfen şehir seçin.'); return; }
  btn.disabled = true;
  btn.textContent = 'Konum alınıyor…';
  setOnbError('');
  navigator.geolocation.getCurrentPosition(
    (pos) => applyLocation({ type: 'geo', lat: +pos.coords.latitude.toFixed(4), lon: +pos.coords.longitude.toFixed(4) }),
    (err) => {
      btn.disabled = false;
      btn.innerHTML = `${icon.pin} Konumumu kullan`;
      setOnbError(err.code === 1 ? 'Konum izni verilmedi. Lütfen aşağıdan şehrinizi seçin.' : 'Konum alınamadı. Lütfen aşağıdan şehrinizi seçin.');
      $('#city-in').focus();
    },
    { timeout: 10000, maximumAge: 600000 },
  );
}

function useCity() {
  const raw = $('#city-in').value.trim().toLocaleLowerCase('tr');
  const city = PROVINCES.find((c) => c.toLocaleLowerCase('tr') === raw);
  if (!city) { setOnbError('Lütfen listeden bir il seçin.'); return; }
  applyLocation({ type: 'city', city });
}

// ---------- Yedek ----------
async function exportData() {
  const json = JSON.stringify(store.exportAll(), null, 2);
  const name = `namaz-yedek-${today()}.json`;
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

async function importData(file) {
  let result;
  try {
    result = store.validateBackup(JSON.parse(await file.text()));
  } catch {
    result = { ok: false, error: 'Dosya okunamadı veya JSON biçiminde değil.' };
  }
  if (!result.ok) { alert(result.error); return; }
  const n = Object.keys(result.data.log).length;
  if (!confirm(`Yedekte ${n} günlük kayıt var. Mevcut kayıtlarınızın yerine geçecek. Devam edilsin mi?`)) return;
  store.importAll(result.data);
  S.log = store.loadLog();
  S.settings = store.loadSettings();
  const loc = store.loadLocation();
  applyTheme();
  closeSheet();
  if (loc && (!S.loc || JSON.stringify(loc) !== JSON.stringify(S.loc))) applyLocation(loc); else render();
}

function wipeData() {
  if (!confirm('Tüm kayıtlarınız, ayarlarınız ve konumunuz bu cihazdan silinecek. Bu işlem geri alınamaz. Emin misiniz?')) return;
  store.clearAll();
  S.log = {};
  S.settings = store.loadSettings();
  S.loc = null;
  S.dayData = null;
  S.tomorrow = null;
  applyTheme();
  closeSheet();
  render();
  showOnboarding(false);
}

// ---------- Olaylar ----------
function afterMarkChange() {
  render();
  if (S.sheet && S.sheet.type === 'day') $('#sheet-body').innerHTML = `<div class="grab"></div>${daySheetHtml(S.sheet.date)}`;
}

function onClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const ds = el.dataset;
  switch (ds.act) {
    case 'tab':
      S.tab = ds.tab;
      renderTabs();
      if (S.tab === 'today') { S.viewDate = today(); loadView(); } else render(); // Bugün sekmesi her zaman bugüne döner
      scrollTo(0, 0);
      break;
    case 'settings': openSheet({ type: 'settings' }, settingsHtml()); break;
    case 'close': closeSheet(); break;
    case 'day-prev': S.viewDate = addDays(S.viewDate, -1); loadView(); break;
    case 'day-next': if (S.viewDate < today()) { S.viewDate = addDays(S.viewDate, 1); loadView(); } break;
    case 'day-today': S.viewDate = today(); loadView(); break;
    case 'retry': loadView(); break;
    case 'toggle': {
      if (S.suppressClick) { S.suppressClick = false; break; }
      const cur = S.log[S.viewDate] && S.log[S.viewDate][ds.p];
      setMark(S.viewDate, ds.p, cur ? null : 'done');
      afterMarkChange();
      break;
    }
    case 'more': openPrayerMenu(ds.p); break;
    case 'set':
      setMark(ds.date, ds.p, ds.v || null);
      if (S.sheet && S.sheet.type === 'menu') closeSheet();
      afterMarkChange();
      break;
    case 'cal-prev': S.cal = S.cal.m === 1 ? { y: S.cal.y - 1, m: 12 } : { y: S.cal.y, m: S.cal.m - 1 }; renderView(); break;
    case 'cal-next': S.cal = S.cal.m === 12 ? { y: S.cal.y + 1, m: 1 } : { y: S.cal.y, m: S.cal.m + 1 }; renderView(); break;
    case 'cal-day': openDaySheet(ds.date); break;
    case 'theme':
      S.settings.theme = ds.v;
      store.write('settings', S.settings);
      applyTheme();
      $('#sheet-body').innerHTML = `<div class="grab"></div>${settingsHtml()}`;
      break;
    case 'change-loc': showOnboarding(true); break;
    case 'loc-cancel': $('#onb').hidden = true; break;
    case 'loc-geo': useGeolocation(); break;
    case 'loc-city': useCity(); break;
    case 'export': exportData(); break;
    case 'import': $('#imp').click(); break;
    case 'wipe': wipeData(); break;
    default: break;
  }
}

/** Uzun basma: Bugün satırında Kılındı / Kaza / Temizle menüsünü açar. */
function setupLongPress() {
  let lp = null;
  const cancel = () => { if (lp) { clearTimeout(lp.timer); lp = null; } };
  $('#view').addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.row-main');
    if (!b || b.disabled) return;
    lp = { x: e.clientX, y: e.clientY, timer: setTimeout(() => { lp = null; S.suppressClick = true; openPrayerMenu(b.dataset.p); }, 450) };
  });
  $('#view').addEventListener('pointermove', (e) => {
    if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) cancel();
  });
  $('#view').addEventListener('contextmenu', (e) => { if (e.target.closest('.row-main')) e.preventDefault(); });
  document.addEventListener('pointerup', () => {
    cancel();
    // Menü parmağın altında açıldıysa, bırakışın tıklamasını yut; sonra bayrağı temizle.
    if (S.suppressClick) setTimeout(() => { S.suppressClick = false; }, 350);
  });
  document.addEventListener('pointercancel', cancel);
}

/** Bugün ekranında yatay kaydırma: önceki / sonraki gün. */
function setupSwipe() {
  let start = null;
  const view = $('#view');
  view.addEventListener('touchstart', (e) => { start = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
  view.addEventListener('touchend', (e) => {
    if (!start || S.tab !== 'today') return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    start = null;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 45) return;
    if (dx > 0) { S.viewDate = addDays(S.viewDate, -1); loadView(); }
    else if (S.viewDate < today()) { S.viewDate = addDays(S.viewDate, 1); loadView(); }
  }, { passive: true });
}

// ---------- Saniyelik güncelleme ----------
function tick() {
  S.now = new Date();
  const t = dateKey(S.now);
  if (t !== S.lastToday) { // gece yarısı geçti
    const followed = S.viewDate === S.lastToday;
    S.lastToday = t;
    S.tomorrow = null;
    S.tlKey = null;
    if (followed) S.viewDate = t;
    if (S.loc) { S.cal = { y: S.now.getFullYear(), m: S.now.getMonth() + 1 }; loadView(); }
    return;
  }
  if (!S.loc || S.tab !== 'today' || S.viewDate !== t || !S.dayData || S.dayData.status !== 'ok') return;
  const { cur, next } = timeline(S.dayData.day);
  const key = `${cur}|${next ? next.id + (next.tomorrow ? 't' : '') : '-'}`;
  if (key !== S.tlKey) { renderView(); return; } // vakit değişti: pencere ve kilitler yenilenir
  const cd = $('#cd');
  if (cd && next) cd.textContent = fmtCountdown(next.at - S.now);
}

// ---------- Başlangıç ----------
function init() {
  applyTheme();
  renderTabs();
  document.addEventListener('click', onClick);
  document.addEventListener('change', (e) => {
    if (e.target.id === 'imp' && e.target.files[0]) { importData(e.target.files[0]); e.target.value = ''; }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && S.sheet) closeSheet();
    if (e.key === 'Enter' && e.target.id === 'city-in') useCity();
  });
  setupLongPress();
  setupSwipe();
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  window.addEventListener('pageshow', tick);

  if (S.loc) loadView(); else { render(); showOnboarding(false); }

  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    // Yeni sürüm devraldığında sayfayı bir kez yenile
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloaded) { reloaded = true; location.reload(); }
    });
    navigator.serviceWorker.register('./sw.js').then((reg) => reg.update()).catch(() => {});
  }
}

init();
