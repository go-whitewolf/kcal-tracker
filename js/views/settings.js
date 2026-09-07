// Изглед „Профил“: телесни данни, темп на отслабване, API настройки, архив.

import { S, save, replaceAll, resetData } from '../state.js';
import { bmr, baseline, RATES } from '../energy.js';
import { ping, DEFAULT_MODEL } from '../vision.js';
import { $, on, fmt, iso, toast, openSheet, closeSheet } from '../util.js';

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
  // Полето, в което потребителят пише в момента, не се пипа — иначе курсорът скача.
  fill('aKey', p.api.key);
  fill('aProxy', p.api.proxyUrl);
  $('aModel').value = p.api.model;
  // Записан модел, който вече не е в списъка, оставя полето празно — върни го към основния.
  if (!$('aModel').value) { p.api.model = DEFAULT_MODEL; $('aModel').value = DEFAULT_MODEL; }
  toggleApiFields();
  keyState();
}

const fill = (id, v) => { if (document.activeElement !== $(id)) $(id).value = v; };

/** Полето за ключ е от тип password и Android Chrome го изчиства при
 *  пререндериране. Затова състоянието се показва с текст, а не се съди по
 *  това дали в полето се виждат точки. */
function keyState() {
  const a = S.profile.api, el = $('keyState');
  const proxy = a.mode === 'proxy';
  const ok = proxy ? !!a.proxyUrl : !!a.key;
  el.textContent = ok
    ? (proxy ? '✓ Адресът е записан на това устройство.'
             : '✓ Ключът е записан на това устройство. Остава и след нулиране.')
    : (proxy ? 'Още няма записан адрес.' : 'Още няма записан ключ.');
  el.className = 'hint' + (ok ? ' okline' : '');
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
  p.api.mode  = $('aMode').value;
  p.api.model = $('aModel').value;
  save(); render(); onChange();
}

/** Записва се от собственото си поле и от нищо друго.
 *  Преди ключът се препрочиташе от DOM-а при промяна на кое да е друго поле —
 *  една празна стойност в екрана изтриваше записания ключ. Виж DECISIONS.md.
 *  Слуша `input`, не `change`: записва се при всяко натискане, без да се чака
 *  полето да загуби фокус. */
function bindSecret(id, field) {
  on(id, 'input', () => {
    S.profile.api[field] = $(id).value.trim();
    save();
    keyState();
  });
}

export function wire() {
  ['pW','pH','pA','pS','pM','aModel'].forEach(id => on(id, 'change', readProfile));
  bindSecret('aKey', 'key');
  bindSecret('aProxy', 'proxyUrl');
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

  on('resetBtn', 'click', () => openSheet('resetScrim'));
  on('rsCancel', 'click', () => closeSheet('resetScrim'));
  on('rsGo', 'click', () => {
    $('rsGo').disabled = true;
    resetData();
    location.reload();
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
