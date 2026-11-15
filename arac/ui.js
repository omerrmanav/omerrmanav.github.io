// Alt sayfa (sheet), onay penceresi ve bildirim (toast) yardımcıları.
import { esc } from './format.js';

const $ = (id) => document.getElementById(id);
let current = null;

function layoutToViewport() {
  const wrap = $('sheet');
  const vv = window.visualViewport;
  if (!wrap || wrap.hidden || !vv) return;
  wrap.style.top = vv.offsetTop + 'px';
  wrap.style.height = vv.height + 'px';
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', layoutToViewport);
  window.visualViewport.addEventListener('scroll', layoutToViewport);
}

/**
 * opts: { title, html, ok:'Kaydet'|null, cancel:'İptal', onMount(api), onSubmit(api)->false|void, onClose() }
 * api: { el (kaydırılan gövde), q(sel), close() }
 */
export function openSheet(opts) {
  closeSheet();
  const wrap = $('sheet');
  const box = $('sheet-body');
  const hasFoot = opts.ok !== null && opts.ok !== undefined;
  box.innerHTML = `
    <div class="grabber"></div>
    <div class="sheet-head"><h2>${esc(opts.title)}</h2></div>
    <div class="sheet-scroll" id="sheet-scroll">${opts.html || ''}</div>
    ${hasFoot ? `<div class="sheet-foot"><button class="btn ghost" data-sheet="cancel">${esc(opts.cancel || 'İptal')}</button><button class="btn" data-sheet="ok">${esc(opts.ok)}</button></div>` : ''}`;
  wrap.hidden = false;
  document.body.classList.add('lock');
  const el = $('sheet-scroll');
  const api = { el, q: (s) => el.querySelector(s), qa: (s) => [...el.querySelectorAll(s)], close: closeSheet };
  current = { opts, api };
  layoutToViewport();
  if (opts.onMount) opts.onMount(api);
  return api;
}

export function closeSheet() {
  const wrap = $('sheet');
  if (!current) return;
  const c = current;
  current = null;
  wrap.hidden = true;
  wrap.style.top = ''; wrap.style.height = '';
  $('sheet-body').innerHTML = '';
  document.body.classList.remove('lock');
  if (c.opts.onClose) c.opts.onClose();
}

export const sheetOpen = () => !!current;

document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-sheet], .backdrop');
  if (!t || !current) return;
  if (t.classList.contains('backdrop') || t.dataset.sheet === 'cancel') { closeSheet(); return; }
  if (t.dataset.sheet === 'ok') {
    const c = current;
    t.disabled = true;
    let r;
    try { r = await c.opts.onSubmit(c.api); } finally { t.disabled = false; }
    if (r !== false && current === c) closeSheet();
  }
});

/** Onay penceresi. Promise<boolean>. */
export function confirmDialog({ title, message, ok = 'Tamam', cancel = 'Vazgeç', danger = false }) {
  return new Promise((resolve) => {
    const d = $('dialog');
    d.innerHTML = `
      <div class="backdrop dlg-bd"></div>
      <div class="dlg" role="alertdialog" aria-modal="true">
        <h3>${esc(title)}</h3>
        ${message ? `<p>${esc(message)}</p>` : ''}
        <div class="dlg-btns">
          <button class="btn ghost" data-r="0">${esc(cancel)}</button>
          <button class="btn ${danger ? 'danger' : ''}" data-r="1">${esc(ok)}</button>
        </div>
      </div>`;
    d.hidden = false;
    const done = (v) => { d.hidden = true; d.innerHTML = ''; d.onclick = null; resolve(v); };
    d.onclick = (e) => {
      const b = e.target.closest('[data-r]');
      if (b) done(b.dataset.r === '1');
      else if (e.target.classList.contains('dlg-bd')) done(false);
    };
  });
}

let toastTimer;
export function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); t.hidden = true; }, 2600);
}
