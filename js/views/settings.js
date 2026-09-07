// Изглед „Профил“: телесни данни, темп на отслабване, API настройки, архив.

import { S, save, replaceAll } from '../state.js';
import { bmr, baseline, RATES } from '../energy.js';
import { ping } from '../vision.js';
import { $, on, fmt, iso, toast } from '../util.js';

let onChange = () => {};
export function setChangeHook(fn) { onChange = fn; }

export function render() {
  const p = S.profile;
  $('pW').value = p.w; $('pH').value = p.h; $('pA').value = p.age;
  $('pS').value = p.sex; $('pM').value = p.mult;

  $('bmrOut').textContent  = fmt(bmr());
  $('baseOut').textContent = fmt(baseline());
  $('protTarget').textContent = Math.round(p.w * 1.8) + '–' + Math.round(p.w * 2.2);

  const box = $('dOpts');
  box.innerHTML = '';
  RATES.forEach(r => {
    const el = document.createElement('div');
    el.className = 'dopt' + (p.deficit === r.v ? ' on' : '');
    el.innerHTML = '<div class="dot"></div><div class="t">' + r.t +
      '<span>' + r.s + '</span></div><div class="kc">' + (r.v ? '−' + r.v : '0') + '</div>';
    el.onclick = () => { S.profile.deficit = r.v; save(); render(); onChange(); };
    box.appendChild(el);
  });

  $('aMode').value  = p.api.mode;
  $('aKey').value   = p.api.key;
  $('aProxy').value = p.api.proxyUrl;
  $('aModel').value = p.api.model;
  toggleApiFields();
}

function toggleApiFields() {
  const proxy = $('aMode').value === 'proxy';
  $('keyField').hidden   = proxy;
  $('proxyField').hidden = !proxy;
}

function readProfile() {
  const p = S.profile;
  p.w    = +$('pW').value || p.w;
  p.h    = +$('pH').value || p.h;
  p.age  = +$('pA').value || p.age;
  p.sex  = $('pS').value;
  p.mult = +$('pM').value;
  p.api.mode     = $('aMode').value;
  p.api.key      = $('aKey').value.trim();
  p.api.proxyUrl = $('aProxy').value.trim();
  p.api.model    = $('aModel').value;
  save(); render(); onChange();
}

export function wire() {
  ['pW','pH','pA','pS','pM','aKey','aProxy','aModel'].forEach(id => on(id, 'change', readProfile));
  on('aMode', 'change', () => { toggleApiFields(); readProfile(); });

  on('testApi', 'click', async () => {
    const btn = $('testApi');
    btn.disabled = true; btn.textContent = 'Проверявам…';
    try { await ping(); toast('Връзката работи.'); }
    catch (e) { toast(e.message); }
    finally { btn.disabled = false; btn.textContent = 'Провери връзката'; }
  });

  on('expBtn', 'click', () => {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kcal-' + iso(new Date()) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  on('impBtn', 'click', () => $('impFile').click());
  on('impFile', 'change', e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { replaceAll(JSON.parse(r.result)); render(); onChange(); toast('Възстановено.'); }
      catch (err) { toast('Файлът не съдържа данни от този дневник.'); }
    };
    r.readAsText(f);
  });
}
