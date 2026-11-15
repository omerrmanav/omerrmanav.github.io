// Ayarlar sayfası: tema, yedek, örnek veri, silme.
import { state, bus, commit, replaceData } from './state.js';
import { openSheet, closeSheet, confirmDialog, toast } from './ui.js';
import * as store from './storage.js';
import { todayISO } from './dates.js';
import { icon } from './icons.js';

const THEME_COLORS = { light: '#007AFF', dark: '#082a55' };

export function applyTheme() {
  const t = state.settings.theme;
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.dataset.theme = t; else delete root.dataset.theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    const media = m.getAttribute('media') || '';
    const scheme = t === 'auto' ? (media.includes('dark') ? 'dark' : 'light') : t;
    m.setAttribute('content', THEME_COLORS[scheme]);
    // Elle seçilen temada her iki meta aynı değeri alır, otomatikte medya sorgusu belirler.
  });
}

async function exportFile() {
  const json = JSON.stringify(store.exportBackup(state.data, state.settings), null, 2);
  const name = `arac-takip-yedek-${todayISO()}.json`;
  try {
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Araç Takip yedeği' });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('Yedek indirildi');
}

async function importFile(file) {
  let obj;
  try { obj = JSON.parse(await file.text()); } catch { toast('Dosya okunamadı.'); return; }
  const r = store.validateBackup(obj);
  if (!r.ok) { toast(r.error); return; }
  const d = r.data;
  const ok = await confirmDialog({
    title: 'Yedek yüklensin mi?',
    message: `${d.vehicles.length} araç, ${d.fuel.length} yakıt, ${d.service.length} servis kaydı ve ${d.reminders.length} tarih yüklenecek. Mevcut tüm veriler silinip bunlarla değiştirilecek.`,
    ok: 'Yedeği yükle', danger: true,
  });
  if (!ok) return;
  state.settings = { ...state.settings, ...r.settings };
  store.saveSettings(state.settings);
  applyTheme();
  replaceData(d);
  closeSheet();
  toast('Yedek yüklendi');
}

export function openSettings() {
  const empty = state.data.vehicles.length === 0 && !state.data.fuel.length && !state.data.service.length && !state.data.reminders.length;
  const th = (v, l) => `<button data-theme="${v}" aria-pressed="${state.settings.theme === v}">${l}</button>`;
  openSheet({
    title: 'Ayarlar', ok: null,
    html: `
      <div class="card flat"><div class="card-title">Görünüm</div>
        <div class="seg" id="seg">${th('auto', 'Otomatik')}${th('light', 'Açık')}${th('dark', 'Koyu')}</div></div>
      <div class="card flat"><div class="card-title">Veri</div>
        <div class="set-list">
          <button class="set-row" data-a="export">${icon.download}<span>Yedeği indir</span></button>
          <button class="set-row" data-a="import">${icon.upload}<span>Yedeği yükle</span></button>
          ${empty ? `<button class="set-row" data-a="demo">${icon.chart}<span>Örnek veri yükle</span></button>` : ''}
          <button class="set-row danger-text" data-a="wipe">${icon.trash}<span>Tüm verileri sil</span></button>
        </div>
        <input type="file" id="imp" accept="application/json,.json" hidden></div>
      <p class="note muted">Veriler yalnızca bu cihazda, tarayıcı deposunda saklanır; hiçbir yere gönderilmez. Ana ekrana eklenen uygulamanın deposu Safari'den ayrıdır: Safari'de girdiğin veriler ana ekran uygulamasında görünmez. Taşımak için yedeği indirip diğer tarafta yükle. Düzenli yedek almanı öneririz.</p>`,
    onMount(api) {
      api.q('#imp').addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (f) importFile(f);
      });
      api.el.addEventListener('click', async (e) => {
        const t = e.target.closest('[data-theme]');
        if (t) {
          state.settings.theme = t.dataset.theme;
          store.saveSettings(state.settings);
          applyTheme();
          api.qa('#seg button').forEach((b) => b.setAttribute('aria-pressed', String(b === t)));
          return;
        }
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (a === 'export') exportFile();
        else if (a === 'import') api.q('#imp').click();
        else if (a === 'demo') {
          replaceData(store.makeDemo());
          closeSheet();
          toast('Örnek veri yüklendi');
        } else if (a === 'wipe') {
          const ok = await confirmDialog({
            title: 'Tüm veriler silinsin mi?', message: 'Tüm araçlar, yakıt, servis kayıtları ve tarihler silinecek. Bu işlem geri alınamaz.',
            ok: 'Hepsini sil', danger: true,
          });
          if (!ok) return;
          state.data = store.emptyData();
          store.removeData();
          commit();
          closeSheet();
          toast('Tüm veriler silindi');
        }
      });
    },
  });
}
