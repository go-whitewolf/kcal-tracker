// Изглед „Днес“: баланс, хранения, тренировки, тегло, оценка по снимка.

import { S, cur, setCur, day, save } from '../state.js';
import { totals, autoKcal, WNAME, KCAL_PER_KG } from '../energy.js';
import { prepareImage, analyze } from '../vision.js';
import {
  $, on, fmt, esc, fromIso, shift, today, DOW, MON,
  openSheet, closeSheet, show, toast
} from '../util.js';

let onProfileChange = () => {};
export function setProfileHook(fn) { onProfileChange = fn; }

/* ---------------- рисуване ---------------- */

export function render() {
  const d = fromIso(cur), t = totals(cur), dd = day(cur);

  $('dLabel').textContent = d.getDate() + ' ' + MON[d.getMonth()];
  $('wLabel').textContent = DOW[d.getDay()];

  const left = t.goal - t.inn;
  const rn = $('remain');
  rn.textContent = (left < 0 ? '+' : '') + fmt(Math.abs(left));
  rn.classList.toggle('over', left < 0);
  $('remainSub').textContent = left < 0 ? 'над целта за деня' : 'остават до целта';

  const scale = Math.max(t.out, t.inn, 1);
  $('barIn').style.width  = (t.inn / scale * 100) + '%';
  $('barOut').style.width = (t.out / scale * 100) + '%';
  $('tgtMark').style.left = Math.min(100, t.goal / scale * 100) + '%';
  $('valIn').textContent  = fmt(t.inn);
  $('valOut').textContent = fmt(t.out);
  $('goalKcal').textContent = fmt(t.goal);
  $('goalRate').textContent = S.profile.deficit > 0
    ? '−' + (S.profile.deficit * 7 / KCAL_PER_KG).toFixed(2) + ' кг/седм'
    : 'поддържане';

  $('pSum').textContent = t.prot ? '· ' + Math.round(t.prot) + ' г протеин' : '';

  renderMeals(dd);
  renderChips();
  renderWorkouts(dd);

  $('wShow').innerHTML = dd.weight ? dd.weight.toFixed(1) + '<small>кг</small>' : '—<small>кг</small>';
  $('wIn').value = '';
}

function renderMeals(dd) {
  const list = $('mealList');
  list.innerHTML = dd.meals.length ? '' : '<div class="empty">Още нищо. Снимай храната или добави на ръка.</div>';
  dd.meals.forEach((m, i) => {
    const meta = [m.src === 'photo' ? 'по снимка' : null, m.prot ? m.prot + ' г протеин' : null]
      .filter(Boolean).join(' · ');
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = '<div class="nm">' + esc(m.name) +
      (meta ? '<span class="meta">' + meta + '</span>' : '') +
      '</div><div class="kc in">' + fmt(m.kcal) + '</div>' +
      '<button class="del" aria-label="Изтрий">&times;</button>';
    el.querySelector('.nm').onclick = () => editMeal(i);
    el.querySelector('.del').onclick = () => { dd.meals.splice(i, 1); save(); render(); };
    list.appendChild(el);
  });
}

function renderChips() {
  const seen = new Map();
  Object.keys(S.days).sort().reverse().forEach(k => {
    (S.days[k].meals || []).forEach(m => { if (!seen.has(m.name)) seen.set(m.name, m); });
  });
  const box = $('mealChips');
  box.innerHTML = '';
  [...seen.values()].slice(0, 8).forEach(m => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = m.name + ' · ' + m.kcal;
    b.onclick = () => {
      day().meals.push({ name: m.name, kcal: m.kcal, prot: m.prot || 0, src: 'manual' });
      save(); render();
    };
    box.appendChild(b);
  });
}

function renderWorkouts(dd) {
  const list = $('woList');
  list.innerHTML = dd.workouts.length ? '' : '<div class="empty">Няма тренировка за този ден.</div>';
  dd.workouts.forEach((x, i) => {
    const meta = [x.km ? x.km + ' км' : null, x.min ? x.min + ' мин' : null].filter(Boolean).join(' · ');
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = '<div class="nm">' + esc(x.name) +
      (meta ? '<span class="meta">' + meta + '</span>' : '') +
      '</div><div class="kc out">' + fmt(x.kcal) + '</div>' +
      '<button class="del" aria-label="Изтрий">&times;</button>';
    el.querySelector('.del').onclick = () => { dd.workouts.splice(i, 1); save(); render(); };
    list.appendChild(el);
  });
}

/* ---------------- хранене на ръка ---------------- */

let editIdx = null;

function openMealSheet(title) {
  $('mealTitle').textContent = title;
  openSheet('mealScrim');
  setTimeout(() => $('mName').focus(), 80);
}

function editMeal(i) {
  const m = day().meals[i];
  editIdx = i;
  $('mName').value = m.name; $('mKcal').value = m.kcal; $('mProt').value = m.prot || '';
  openMealSheet('Промени хранене');
}

/* ---------------- оценка по снимка ---------------- */

let shot = null;   // { base64, preview }

function photoStage(stage) {
  ['photoAsk', 'photoBusy', 'photoRes', 'photoErr'].forEach(id => show(id, id === stage));
}

async function onPhotoPicked(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    shot = await prepareImage(file);
    $('preview').src = shot.preview;
    $('hintTxt').value = '';
    photoStage('photoAsk');
    openSheet('photoScrim');
  } catch (err) {
    toast(err.message);
  }
}

async function runAnalysis() {
  photoStage('photoBusy');
  try {
    const r = await analyze(shot.base64, $('hintTxt').value.trim());
    showResult(r);
  } catch (err) {
    $('errTxt').textContent = err.message;
    photoStage('photoErr');
  }
}

function showResult(r) {
  $('resDish').textContent = r.dish;
  $('resConf').textContent = 'сигурност: ' + r.confidence;
  $('resNote').textContent = r.note;

  const box = $('resItems');
  box.innerHTML = '';
  r.items.forEach(it => {
    const row = document.createElement('div');
    row.className = 'resitem';
    row.innerHTML = '<div class="rn">' + esc(it.name) +
      (it.grams ? '<span>≈ ' + it.grams + ' г · ' + it.protein + ' г протеин</span>' : '') +
      '</div>';
    const inp = document.createElement('input');
    inp.type = 'number'; inp.inputMode = 'numeric'; inp.value = it.kcal;
    inp.setAttribute('aria-label', 'Калории за ' + it.name);
    inp.oninput = () => { it.kcal = +inp.value || 0; $('resTotal').textContent = fmt(sumOf(r)); };
    row.appendChild(inp);
    box.appendChild(row);
  });

  $('resTotal').textContent = fmt(sumOf(r));
  $('resSave').onclick = () => {
    day().meals.push({
      name: r.dish,
      kcal: sumOf(r),
      prot: r.total_protein,
      src: 'photo'
    });
    save();
    closeSheet('photoScrim');
    render();
    toast('Добавено: ' + fmt(sumOf(r)) + ' kcal');
  };
  photoStage('photoRes');
}

const sumOf = r => r.items.reduce((s, i) => s + (+i.kcal || 0), 0);

/* ---------------- тренировки ---------------- */

function woAuto() {
  const t = $('oType').value;
  if (t === 'other') return;
  const v = autoKcal(t, +$('oMin').value || 0, +$('oKm').value || 0);
  if (v > 0) $('oKcal').value = v;
}

function woTypeChanged() {
  const t = $('oType').value;
  $('oKmF').style.display  = ['run', 'walk', 'bike'].includes(t) ? 'block' : 'none';
  $('oNameF').hidden = t !== 'other';
  $('oHint').textContent = t === 'run'
    ? 'При бягане километрите са по-точни от минутите — около 0,95 kcal на килограм тегло за километър.'
    : 'Пресмята се автоматично от теглото ти — можеш да го промениш ръчно.';
  woAuto();
}

/* ---------------- закачане ---------------- */

export function wire() {
  on('prevD', 'click', () => { setCur(shift(cur, -1)); render(); });
  on('nextD', 'click', () => { setCur(shift(cur,  1)); render(); });
  on('todayBtn', 'click', () => { setCur(today()); render(); });

  on('shootBtn', 'click', () => $('photoIn').click());
  on('photoIn', 'change', onPhotoPicked);
  on('phGo', 'click', runAnalysis);
  on('phCancel', 'click', () => closeSheet('photoScrim'));
  on('resCancel', 'click', () => closeSheet('photoScrim'));
  on('errClose', 'click', () => closeSheet('photoScrim'));
  on('errRetry', 'click', runAnalysis);

  on('addMeal', 'click', () => {
    editIdx = null;
    $('mName').value = ''; $('mKcal').value = ''; $('mProt').value = '';
    openMealSheet('Ново хранене');
  });
  on('mCancel', 'click', () => { closeSheet('mealScrim'); editIdx = null; });
  on('mSave', 'click', () => {
    const meal = {
      name: $('mName').value.trim() || 'Хранене',
      kcal: +$('mKcal').value || 0,
      prot: +$('mProt').value || 0,
      src: 'manual'
    };
    if (editIdx !== null) day().meals[editIdx] = meal; else day().meals.push(meal);
    save(); closeSheet('mealScrim'); editIdx = null; render();
  });

  on('addWo', 'click', () => {
    $('oType').value = 'gym'; $('oMin').value = ''; $('oKm').value = '';
    $('oKcal').value = ''; $('oName').value = '';
    woTypeChanged();
    openSheet('woScrim');
  });
  on('oType', 'change', woTypeChanged);
  on('oMin', 'input', woAuto);
  on('oKm', 'input', woAuto);
  on('oCancel', 'click', () => closeSheet('woScrim'));
  on('oSave', 'click', () => {
    const t = $('oType').value;
    day().workouts.push({
      name: t === 'other' ? ($('oName').value.trim() || 'Друго') : WNAME[t],
      type: t, min: +$('oMin').value || 0, km: +$('oKm').value || 0, kcal: +$('oKcal').value || 0
    });
    save(); closeSheet('woScrim'); render();
  });

  on('wSave', 'click', () => {
    const v = +$('wIn').value;
    if (!v) { toast('Въведи тегло.'); return; }
    day().weight = v;
    if (cur === today()) S.profile.w = v;
    save(); render(); onProfileChange();
    toast('Записано: ' + v.toFixed(1) + ' кг');
  });

  document.querySelectorAll('.scrim').forEach(s => {
    s.addEventListener('click', e => { if (e.target === s) s.classList.remove('on'); });
  });
}
