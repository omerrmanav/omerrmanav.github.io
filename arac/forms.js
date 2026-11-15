// Veri girişi formları: yakıt, servis, tarih, araç.
import { state, commit, activeVehicle } from './state.js';
import { openSheet, closeSheet, confirmDialog, toast } from './ui.js';
import { esc, parseNum, numToInput, round2, fmtNum, FUEL_LABEL, TYPE_LABEL } from './format.js';
import { todayISO, isValidISO } from './dates.js';
import { newId, FUEL_TYPES, REM_TYPES } from './storage.js';
import { icon } from './icons.js';

const money2 = (n) => (typeof n === 'number' && isFinite(n) ? n.toFixed(2).replace('.', ',') : '');
const val = (api, sel) => (api.q(sel)?.value ?? '').trim();
const orNull = (s) => (s ? s : null);

/** Aynı araçtaki, verilen tarihe kadarki en yüksek km (kendisi hariç). */
function prevKm(vid, date, selfId) {
  let max = null;
  for (const r of [...state.data.fuel, ...state.data.service]) {
    if (r.vehicleId !== vid || r.id === selfId || r.km == null || r.date > date) continue;
    if (max == null || r.km > max) max = r.km;
  }
  return max;
}

async function kmOk(vid, date, km, selfId) {
  if (km == null) return true;
  const p = prevKm(vid, date, selfId);
  if (p == null || km >= p) return true;
  return confirmDialog({
    title: 'Km düşük görünüyor',
    message: `Bu tarihten önceki kayıtta ${fmtNum(p)} km var, girdiğin değer ${fmtNum(km)} km. Yine de kaydedilsin mi?`,
    ok: 'Yine de kaydet', cancel: 'Düzelt',
  });
}

function err(api, msg, sel) {
  const e = api.q('.form-err');
  if (e) { e.textContent = msg; e.hidden = false; }
  const f = sel && api.q(sel);
  if (f) { f.classList.add('bad'); f.focus(); f.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  return false;
}
function clearErr(api) {
  const e = api.q('.form-err');
  if (e) e.hidden = true;
  api.qa('.bad').forEach((x) => x.classList.remove('bad'));
}

const deleteBtn = (label) => `<button type="button" class="btn danger-ghost block" data-del>${icon.trash} ${label}</button>`;

/* ---------------- Yakıt ---------------- */
export function openFuelForm(id = null) {
  const v = activeVehicle();
  if (!v) return openVehicleForm();
  const rec = id ? state.data.fuel.find((r) => r.id === id) : null;
  const f = rec || { date: todayISO(), km: null, liters: null, pricePerLiter: null, total: null, fullTank: true, station: '', note: '' };
  const html = `
    <div class="form-err" hidden></div>
    <div class="field"><label for="f-date">Tarih</label><input class="input" type="date" id="f-date" value="${f.date}"></div>
    <div class="field"><label for="f-km">Kilometre</label>
      <input class="input" id="f-km" inputmode="decimal" autocomplete="off" placeholder="örn. 58230" value="${numToInput(f.km, 0)}">
      <div class="hint" id="f-kmhint"></div></div>
    <div class="row2">
      <div class="field"><label for="f-liters">Litre</label><input class="input" id="f-liters" data-calc="liters" inputmode="decimal" autocomplete="off" placeholder="0" value="${numToInput(f.liters)}"></div>
      <div class="field"><label for="f-price">₺ / litre</label><input class="input" id="f-price" data-calc="price" inputmode="decimal" autocomplete="off" placeholder="0" value="${numToInput(f.pricePerLiter)}"></div>
    </div>
    <div class="field"><label for="f-total">Toplam tutar (₺)</label><input class="input" id="f-total" data-calc="total" inputmode="decimal" autocomplete="off" placeholder="0" value="${numToInput(f.total)}">
      <div class="hint">Üçünden ikisini gir, üçüncüsü otomatik hesaplanır. Hesaplanan alanı elle değiştirebilirsin.</div></div>
    <div class="field"><label for="f-station">İstasyon</label><input class="input" id="f-station" autocomplete="off" maxlength="60" placeholder="İsteğe bağlı" value="${esc(f.station || '')}"></div>
    <div class="field"><label for="f-note">Not</label><input class="input" id="f-note" autocomplete="off" maxlength="300" placeholder="İsteğe bağlı" value="${esc(f.note || '')}"></div>
    ${rec ? deleteBtn('Kaydı sil') : ''}`;

  openSheet({
    title: rec ? 'Yakıt kaydını düzenle' : 'Yakıt ekle', html, ok: 'Kaydet',
    onMount(api) {
      const order = rec ? ['total', 'liters'] : []; // en son düzenlenen başta
      const el = { liters: api.q('#f-liters'), price: api.q('#f-price'), total: api.q('#f-total') };
      const recalc = () => {
        if (order.length < 2) return;
        const target = ['liters', 'price', 'total'].find((n) => !order.slice(0, 2).includes(n));
        const L = parseNum(el.liters.value), P = parseNum(el.price.value), T = parseNum(el.total.value);
        let r = null;
        if (target === 'total' && L > 0 && P > 0) r = L * P;
        else if (target === 'liters' && T > 0 && P > 0) r = T / P;
        else if (target === 'price' && T > 0 && L > 0) r = T / L;
        Object.values(el).forEach((x) => x.classList.remove('auto'));
        if (r != null) { el[target].value = numToInput(round2(r)); el[target].classList.add('auto'); }
      };
      api.el.addEventListener('input', (e) => {
        const n = e.target.dataset?.calc;
        if (n) {
          e.target.classList.remove('auto');
          const i = order.indexOf(n);
          if (i > -1) order.splice(i, 1);
          order.unshift(n);
          recalc();
        }
        if (e.target.id === 'f-km' || e.target.id === 'f-date') kmHint();
        clearErr(api);
      });
      const kmHint = () => {
        const km = parseNum(val(api, '#f-km'));
        const date = val(api, '#f-date');
        const h = api.q('#f-kmhint');
        const p = isValidISO(date) ? prevKm(v.id, date, rec?.id) : null;
        if (km != null && p != null && km < p) { h.textContent = `Önceki kayıt ${fmtNum(p)} km, bu değer daha düşük.`; h.className = 'hint warn'; }
        else if (p != null) { h.textContent = `Önceki kayıt: ${fmtNum(p)} km`; h.className = 'hint'; }
        else h.textContent = '';
      };
      kmHint();
      api.q('[data-del]')?.addEventListener('click', async () => {
        if (!(await confirmDialog({ title: 'Yakıt kaydı silinsin mi?', message: 'Bu işlem geri alınamaz.', ok: 'Sil', danger: true }))) return;
        state.data.fuel = state.data.fuel.filter((r) => r.id !== rec.id);
        commit(); closeSheet(); toast('Kayıt silindi');
      });
    },
    async onSubmit(api) {
      const date = val(api, '#f-date');
      if (!isValidISO(date)) return err(api, 'Geçerli bir tarih seç.', '#f-date');
      const kmRaw = val(api, '#f-km');
      const km = kmRaw ? parseNum(kmRaw) : null;
      if (kmRaw && (km == null || km < 0)) return err(api, 'Kilometre geçerli bir sayı olmalı.', '#f-km');
      let L = parseNum(val(api, '#f-liters')), P = parseNum(val(api, '#f-price')), T = parseNum(val(api, '#f-total'));
      const given = [L, P, T].filter((x) => x != null).length;
      if ([L, P, T].some((x) => x != null && !(x > 0))) return err(api, 'Litre, fiyat ve tutar sıfırdan büyük olmalı.');
      if (given < 2) return err(api, 'Litre, ₺/litre ve toplamdan en az ikisini gir.', '#f-liters');
      if (L == null) L = round2(T / P);
      if (P == null) P = round2(T / L);
      if (T == null) T = round2(L * P);
      if (!(await kmOk(v.id, date, km, rec?.id))) return false;
      const out = {
        id: rec?.id || newId(), vehicleId: v.id, date, km, liters: L, pricePerLiter: P, total: T,
        // fullTank formda gösterilmez: yeni kayıt true, eski kayıt kendi değerini korur.
        fullTank: rec ? rec.fullTank : true, station: orNull(val(api, '#f-station')), note: orNull(val(api, '#f-note')),
      };
      if (rec) state.data.fuel[state.data.fuel.findIndex((r) => r.id === rec.id)] = out;
      else state.data.fuel.push(out);
      commit(); toast(rec ? 'Güncellendi' : 'Yakıt kaydedildi');
    },
  });
}

/* ---------------- Servis ---------------- */
const QUICK = ['Periyodik bakım', 'Yağ değişimi', 'Lastik', 'Fren', 'Akü', 'Muayene', 'Yıkama', 'Diğer'];

export function openServiceForm(id = null) {
  const v = activeVehicle();
  if (!v) return openVehicleForm();
  const rec = id ? state.data.service.find((r) => r.id === id) : null;
  const f = rec || { date: todayISO(), km: null, title: '', items: [], total: null, shop: '', note: '' };
  const items = f.items.map((i) => ({ name: i.name, cost: numToInput(i.cost) }));
  const html = `
    <div class="form-err" hidden></div>
    <div class="field"><label for="s-date">Tarih</label><input class="input" type="date" id="s-date" value="${f.date}"></div>
    <div class="field"><label for="s-km">Kilometre</label>
      <input class="input" id="s-km" inputmode="decimal" autocomplete="off" placeholder="örn. 58230" value="${numToInput(f.km, 0)}">
      <div class="hint" id="s-kmhint"></div></div>
    <div class="field"><label for="s-title">Yapılan işlem</label>
      <input class="input" id="s-title" autocomplete="off" maxlength="80" placeholder="örn. Periyodik bakım" value="${esc(f.title)}">
      <div class="chips">${QUICK.map((q) => `<button type="button" class="chip" data-chip="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>
    <div class="field"><label>Kalemler</label>
      <div id="s-items"></div>
      <button type="button" class="btn ghost small" id="s-add">${icon.plus.replace('width="26" height="26"', 'width="16" height="16"')} Kalem ekle</button></div>
    <div class="field"><label for="s-total">Toplam tutar (₺)</label>
      <input class="input" id="s-total" inputmode="decimal" autocomplete="off" placeholder="0" value="${rec && !f.items.length ? money2(f.total) : ''}">
      <div class="hint" id="s-totalhint"></div></div>
    <div class="field"><label for="s-shop">Servis / yer</label><input class="input" id="s-shop" autocomplete="off" maxlength="60" placeholder="İsteğe bağlı" value="${esc(f.shop || '')}"></div>
    <div class="field"><label for="s-note">Not</label><input class="input" id="s-note" autocomplete="off" maxlength="300" placeholder="İsteğe bağlı" value="${esc(f.note || '')}"></div>
    ${rec ? deleteBtn('Kaydı sil') : ''}`;

  openSheet({
    title: rec ? 'Servis kaydını düzenle' : 'Servis ekle', html, ok: 'Kaydet',
    onMount(api) {
      const box = api.q('#s-items');
      const total = api.q('#s-total');
      const sum = () => round2(items.reduce((a, b) => a + (parseNum(b.cost) > 0 ? parseNum(b.cost) : 0), 0));
      const syncTotal = () => {
        const s = sum();
        const h = api.q('#s-totalhint');
        if (s > 0) { total.value = money2(s); total.readOnly = true; total.classList.add('auto'); h.textContent = 'Kalemlerin toplamı'; }
        else { if (total.readOnly) total.value = ''; total.readOnly = false; total.classList.remove('auto'); h.textContent = items.length ? 'Kalem tutarı girilmedi; toplamı elle girebilirsin.' : 'Kalem eklemezsen toplamı elle gir.'; }
      };
      const drawItems = () => {
        box.innerHTML = items.map((it, i) => `
          <div class="item-row" data-i="${i}">
            <input class="input" data-k="name" placeholder="Kalem adı" maxlength="80" autocomplete="off" value="${esc(it.name)}">
            <input class="input cost" data-k="cost" inputmode="decimal" placeholder="₺" autocomplete="off" value="${esc(it.cost)}">
            <button type="button" class="icon-x" data-rm="${i}" aria-label="Kalemi kaldır">${icon.x}</button>
          </div>`).join('');
        syncTotal();
      };
      const kmHint = () => {
        const km = parseNum(val(api, '#s-km'));
        const date = val(api, '#s-date');
        const h = api.q('#s-kmhint');
        const p = isValidISO(date) ? prevKm(v.id, date, rec?.id) : null;
        if (km != null && p != null && km < p) { h.textContent = `Önceki kayıt ${fmtNum(p)} km, bu değer daha düşük.`; h.className = 'hint warn'; }
        else if (p != null) { h.textContent = `Önceki kayıt: ${fmtNum(p)} km`; h.className = 'hint'; }
        else h.textContent = '';
      };
      drawItems(); kmHint();
      api.el.addEventListener('input', (e) => {
        const row = e.target.closest('.item-row');
        if (row) { items[+row.dataset.i][e.target.dataset.k] = e.target.value; if (e.target.dataset.k === 'cost') syncTotal(); }
        if (e.target.id === 's-km' || e.target.id === 's-date') kmHint();
        clearErr(api);
      });
      api.el.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-chip]');
        if (chip) { api.q('#s-title').value = chip.dataset.chip; return; }
        if (e.target.closest('#s-add')) { items.push({ name: '', cost: '' }); drawItems(); box.querySelector('.item-row:last-child input')?.focus(); return; }
        const rm = e.target.closest('[data-rm]');
        if (rm) { items.splice(+rm.dataset.rm, 1); drawItems(); }
      });
      api.q('[data-del]')?.addEventListener('click', async () => {
        if (!(await confirmDialog({ title: 'Servis kaydı silinsin mi?', message: 'Bu işlem geri alınamaz.', ok: 'Sil', danger: true }))) return;
        state.data.service = state.data.service.filter((r) => r.id !== rec.id);
        commit(); closeSheet(); toast('Kayıt silindi');
      });
    },
    async onSubmit(api) {
      const date = val(api, '#s-date');
      if (!isValidISO(date)) return err(api, 'Geçerli bir tarih seç.', '#s-date');
      const title = val(api, '#s-title');
      if (!title) return err(api, 'Yapılan işlemi yaz veya bir seçenek seç.', '#s-title');
      const kmRaw = val(api, '#s-km');
      const km = kmRaw ? parseNum(kmRaw) : null;
      if (kmRaw && (km == null || km < 0)) return err(api, 'Kilometre geçerli bir sayı olmalı.', '#s-km');
      const clean = [];
      for (const it of items) {
        const name = it.name.trim();
        const cost = it.cost.trim() ? parseNum(it.cost) : null;
        if (it.cost.trim() && (cost == null || cost < 0)) return err(api, 'Kalem tutarları geçerli bir sayı olmalı.');
        if (!name && cost == null) continue;
        clean.push({ name: name || 'Kalem', cost: cost ?? 0 });
      }
      const s = round2(clean.reduce((a, b) => a + b.cost, 0));
      let total = s;
      if (!(s > 0)) {
        total = parseNum(val(api, '#s-total'));
        if (!(total > 0)) return err(api, 'Toplam tutarı gir.', '#s-total');
      }
      if (!(await kmOk(v.id, date, km, rec?.id))) return false;
      const out = {
        id: rec?.id || newId(), vehicleId: v.id, date, km, title, items: clean, total,
        shop: orNull(val(api, '#s-shop')), note: orNull(val(api, '#s-note')),
      };
      if (rec) state.data.service[state.data.service.findIndex((r) => r.id === rec.id)] = out;
      else state.data.service.push(out);
      commit(); toast(rec ? 'Güncellendi' : 'Servis kaydedildi');
    },
  });
}

/* ---------------- Tarihler ---------------- */
const REPEAT_DEFAULT = { muayene: 12, trafik: 12, kasko: 12, egzoz: 12, bakim: null, diger: null };
const REPEAT_OPTS = [[null, 'Tekrarlama yok'], [3, '3 ayda bir'], [6, '6 ayda bir'], [12, 'Her yıl (12 ay)'], [24, '2 yılda bir (24 ay)']];

export function openReminderForm(id = null) {
  const v = activeVehicle();
  if (!v) return openVehicleForm();
  const rec = id ? state.data.reminders.find((r) => r.id === id) : null;
  const f = rec || { type: 'muayene', title: TYPE_LABEL.muayene, dueDate: '', repeatMonths: REPEAT_DEFAULT.muayene, note: '' };
  const repOpts = [...REPEAT_OPTS];
  if (f.repeatMonths && !repOpts.some(([m]) => m === f.repeatMonths)) repOpts.push([f.repeatMonths, `${f.repeatMonths} ayda bir`]);
  const html = `
    <div class="form-err" hidden></div>
    <div class="field"><label for="r-type">Tür</label>
      <select class="input" id="r-type">${REM_TYPES.map((t) => `<option value="${t}" ${t === f.type ? 'selected' : ''}>${TYPE_LABEL[t]}</option>`).join('')}</select></div>
    <div class="field"><label for="r-title">Başlık</label><input class="input" id="r-title" autocomplete="off" maxlength="80" value="${esc(f.title)}"></div>
    <div class="field"><label for="r-due">Son tarih</label><input class="input" type="date" id="r-due" value="${f.dueDate}"></div>
    <div class="field"><label for="r-rep">Tekrar</label>
      <select class="input" id="r-rep">${repOpts.map(([m, l]) => `<option value="${m ?? ''}" ${m === f.repeatMonths ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <div class="hint">Tarih yenilenince son tarihi güncellemen yeterli.</div></div>
    <div class="field"><label for="r-note">Not</label><input class="input" id="r-note" autocomplete="off" maxlength="300" placeholder="İsteğe bağlı" value="${esc(f.note || '')}"></div>
    ${rec ? deleteBtn('Tarihi sil') : ''}`;

  openSheet({
    title: rec ? 'Tarihi düzenle' : 'Tarih ekle', html, ok: 'Kaydet',
    onMount(api) {
      const type = api.q('#r-type'), title = api.q('#r-title'), rep = api.q('#r-rep');
      let autoTitle = title.value === TYPE_LABEL[type.value] || !title.value;
      let repTouched = !!rec;
      title.addEventListener('input', () => { autoTitle = false; });
      rep.addEventListener('change', () => { repTouched = true; });
      type.addEventListener('change', () => {
        if (autoTitle) title.value = TYPE_LABEL[type.value];
        if (!repTouched) rep.value = REPEAT_DEFAULT[type.value] ?? '';
      });
      api.el.addEventListener('input', () => clearErr(api));
      api.q('[data-del]')?.addEventListener('click', async () => {
        if (!(await confirmDialog({ title: 'Tarih silinsin mi?', message: 'Bu işlem geri alınamaz.', ok: 'Sil', danger: true }))) return;
        state.data.reminders = state.data.reminders.filter((r) => r.id !== rec.id);
        commit(); closeSheet(); toast('Silindi');
      });
    },
    onSubmit(api) {
      const t = val(api, '#r-type');
      const title = val(api, '#r-title') || TYPE_LABEL[t];
      const dueDate = val(api, '#r-due');
      if (!isValidISO(dueDate)) return err(api, 'Geçerli bir son tarih seç.', '#r-due');
      const rm = val(api, '#r-rep');
      const out = {
        id: rec?.id || newId(), vehicleId: v.id, type: t, title, dueDate,
        repeatMonths: rm ? Number(rm) : null, note: orNull(val(api, '#r-note')),
      };
      if (rec) state.data.reminders[state.data.reminders.findIndex((r) => r.id === rec.id)] = out;
      else state.data.reminders.push(out);
      commit(); toast(rec ? 'Güncellendi' : 'Tarih kaydedildi');
    },
  });
}

/* ---------------- Araç ---------------- */
const COLORS = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#0A84FF', '#5856D6', '#8E8E93', '#1C1C1E', '#FFFFFF'];

export function openVehicleForm(id = null) {
  const rec = id ? state.data.vehicles.find((x) => x.id === id) : null;
  const f = rec || { name: '', brand: '', model: '', year: null, fuelType: 'benzin', color: null, startKm: null };
  const html = `
    <div class="form-err" hidden></div>
    <div class="field"><label for="v-name">Araç adı</label><input class="input" id="v-name" autocomplete="off" maxlength="60" placeholder="örn. BMW 320i" value="${esc(f.name)}"></div>
    <div class="row2">
      <div class="field"><label for="v-brand">Marka</label><input class="input" id="v-brand" autocomplete="off" maxlength="40" value="${esc(f.brand)}"></div>
      <div class="field"><label for="v-model">Model</label><input class="input" id="v-model" autocomplete="off" maxlength="40" value="${esc(f.model)}"></div>
    </div>
    <div class="row2">
      <div class="field"><label for="v-year">Yıl</label><input class="input" id="v-year" inputmode="numeric" autocomplete="off" maxlength="4" placeholder="2020" value="${f.year ?? ''}"></div>
      <div class="field"><label for="v-fuel">Yakıt türü</label>
        <select class="input" id="v-fuel">${FUEL_TYPES.map((t) => `<option value="${t}" ${t === f.fuelType ? 'selected' : ''}>${FUEL_LABEL[t]}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label for="v-km">Başlangıç km</label><input class="input" id="v-km" inputmode="decimal" autocomplete="off" placeholder="İsteğe bağlı" value="${numToInput(f.startKm, 0)}"></div>
    <div class="field"><label>Renk</label>
      <div class="swatches" id="v-colors">
        <button type="button" class="sw none ${f.color ? '' : 'sel'}" data-c="" aria-label="Renk yok">${icon.x}</button>
        ${COLORS.map((c) => `<button type="button" class="sw ${f.color && f.color.toLowerCase() === c.toLowerCase() ? 'sel' : ''}" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}
      </div></div>
    ${rec ? deleteBtn('Aracı sil') : ''}`;

  openSheet({
    title: rec ? 'Aracı düzenle' : 'Araç ekle', html, ok: 'Kaydet',
    onMount(api) {
      api.q('#v-colors').addEventListener('click', (e) => {
        const b = e.target.closest('.sw');
        if (!b) return;
        api.qa('.sw').forEach((x) => x.classList.toggle('sel', x === b));
      });
      api.el.addEventListener('input', () => clearErr(api));
      api.q('[data-del]')?.addEventListener('click', async () => {
        const nf = state.data.fuel.filter((r) => r.vehicleId === rec.id).length;
        const ns = state.data.service.filter((r) => r.vehicleId === rec.id).length;
        const nr = state.data.reminders.filter((r) => r.vehicleId === rec.id).length;
        const a = await confirmDialog({
          title: `“${rec.name}” silinsin mi?`,
          message: `Araçla birlikte ${nf} yakıt, ${ns} servis kaydı ve ${nr} tarih de silinecek.`, ok: 'Devam', danger: true,
        });
        if (!a) return;
        const b = await confirmDialog({
          title: 'Son onay', message: 'Bu işlem geri alınamaz. Tüm kayıtlar kalıcı olarak silinecek.', ok: 'Aracı ve kayıtlarını sil', danger: true,
        });
        if (!b) return;
        const d = state.data;
        d.vehicles = d.vehicles.filter((x) => x.id !== rec.id);
        d.fuel = d.fuel.filter((r) => r.vehicleId !== rec.id);
        d.service = d.service.filter((r) => r.vehicleId !== rec.id);
        d.reminders = d.reminders.filter((r) => r.vehicleId !== rec.id);
        if (d.activeVehicleId === rec.id) d.activeVehicleId = d.vehicles[0]?.id ?? null;
        commit(); closeSheet(); toast('Araç silindi');
      });
    },
    onSubmit(api) {
      const name = val(api, '#v-name');
      if (!name) return err(api, 'Araç adı gerekli.', '#v-name');
      const yRaw = val(api, '#v-year');
      const year = yRaw ? parseNum(yRaw) : null;
      if (yRaw && (year == null || year < 1900 || year > 2100)) return err(api, 'Yıl 1900–2100 arasında olmalı.', '#v-year');
      const kRaw = val(api, '#v-km');
      const startKm = kRaw ? parseNum(kRaw) : null;
      if (kRaw && (startKm == null || startKm < 0)) return err(api, 'Başlangıç km geçerli bir sayı olmalı.', '#v-km');
      const out = {
        id: rec?.id || newId(), name, brand: val(api, '#v-brand'), model: val(api, '#v-model'),
        year: year != null ? Math.round(year) : null, fuelType: val(api, '#v-fuel'),
        color: orNull(api.q('.sw.sel')?.dataset.c || ''), startKm,
        createdAt: rec?.createdAt || todayISO(),
      };
      if (rec) state.data.vehicles[state.data.vehicles.findIndex((x) => x.id === rec.id)] = out;
      else { state.data.vehicles.push(out); state.data.activeVehicleId = out.id; }
      commit(); toast(rec ? 'Güncellendi' : 'Araç eklendi');
    },
  });
}

/* ---------------- Menüler ---------------- */
export function openAddMenu() {
  if (!activeVehicle()) return openVehicleForm();
  openSheet({
    title: 'Ekle', ok: null,
    html: `<div class="menu">
      <button class="menu-item" data-go="fuel"><span class="mi fuel">${icon.drop}</span>Yakıt ekle</button>
      <button class="menu-item" data-go="service"><span class="mi service">${icon.wrench}</span>Servis ekle</button>
      <button class="menu-item" data-go="rem"><span class="mi acc">${icon.calendar}</span>Tarih ekle</button>
      <button class="menu-item cancel" data-go="">Vazgeç</button></div>`,
    onMount(api) {
      api.el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-go]');
        if (!b) return;
        const g = b.dataset.go;
        closeSheet();
        if (g === 'fuel') openFuelForm();
        else if (g === 'service') openServiceForm();
        else if (g === 'rem') openReminderForm();
      });
    },
  });
}

export function openVehicleSwitcher() {
  const d = state.data;
  openSheet({
    title: 'Araçlar', ok: null,
    html: `<div class="menu">
      ${d.vehicles.map((x) => `<button class="menu-item" data-v="${x.id}"><span class="dot" style="background:${x.color || 'var(--text-2)'}"></span><span class="grow">${esc(x.name)}</span>${x.id === d.activeVehicleId ? `<span class="acc-text">${icon.check}</span>` : ''}</button>`).join('')}
      <button class="menu-item acc-text" data-new>${icon.plus.replace('width="26" height="26"', 'width="20" height="20"')} Araç ekle</button></div>`,
    onMount(api) {
      api.el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-v]');
        if (b) { d.activeVehicleId = b.dataset.v; closeSheet(); commit(); return; }
        if (e.target.closest('[data-new]')) { closeSheet(); openVehicleForm(); }
      });
    },
  });
}
