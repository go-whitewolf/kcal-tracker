// Изглед „Прогрес“: статистики, крива на теглото, сверка на разхода, история.

import { S, day } from '../state.js';
import { totals, KCAL_PER_KG } from '../energy.js';
import { $, fmt, shift, daysBetween, shortDate } from '../util.js';

export function render() {
  const keys    = Object.keys(S.days).sort();
  const weights = keys.filter(k => day(k).weight).map(k => ({ k, w: day(k).weight }));
  const logged  = keys.filter(k => day(k).meals.length).slice(-7);

  $('sWeight').textContent = weights.length
    ? weights[weights.length - 1].w.toFixed(1) + ' кг' : '—';

  renderChange(weights);
  renderAverages(logged);
  drawChart(weights);
  calibrate(keys, weights);
  renderHistory(keys);
}

function renderChange(weights) {
  const el = $('sChange');
  if (weights.length < 2) { el.textContent = '—'; el.style.color = ''; return; }
  const last  = weights[weights.length - 1];
  const prior = weights.filter(x => x.k <= shift(last.k, -8)).pop() || weights[0];
  const dw = last.w - prior.w;
  el.textContent = (dw > 0 ? '+' : '') + dw.toFixed(1) + ' кг';
  el.style.color = dw < 0 ? 'var(--burn)' : dw > 0 ? 'var(--over)' : '';
}

function renderAverages(logged) {
  if (!logged.length) {
    $('sIntake').textContent = '—';
    $('sDeficit').textContent = '—';
    return;
  }
  const avgIn  = logged.reduce((s, k) => s + totals(k).inn, 0) / logged.length;
  const avgBal = logged.reduce((s, k) => s + totals(k).bal, 0) / logged.length;
  $('sIntake').textContent = fmt(avgIn);
  const de = $('sDeficit');
  de.textContent = (avgBal > 0 ? '+' : '−') + fmt(Math.abs(avgBal));
  de.style.color = avgBal < 0 ? 'var(--burn)' : 'var(--over)';
}

function drawChart(pts) {
  const svg = $('chart'), hint = $('chartHint');
  if (pts.length < 2) {
    svg.innerHTML = '';
    hint.textContent = 'Запиши поне две измервания, за да видиш кривата';
    return;
  }
  const show = pts.slice(-30);
  const W = 340, H = 130, pad = 14;
  const ws = show.map(p => p.w);
  let mn = Math.min(...ws), mx = Math.max(...ws);
  if (mx - mn < 1) { const c = (mx + mn) / 2; mn = c - 0.5; mx = c + 0.5; }

  const x = i => pad + i * (W - pad * 2) / (show.length - 1);
  const y = v => H - pad - ((v - mn) / (mx - mn)) * (H - pad * 2);

  const line = show.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.w).toFixed(1)).join(' ');
  const area = line + ' L' + x(show.length - 1).toFixed(1) + ' ' + (H - pad) + ' L' + pad + ' ' + (H - pad) + ' Z';
  const dots = show.map((p, i) =>
    '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(p.w).toFixed(1) + '" r="2.5" fill="#4FC3B0"/>').join('');

  svg.innerHTML =
    '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="#4FC3B0" stop-opacity=".22"/>' +
    '<stop offset="100%" stop-color="#4FC3B0" stop-opacity="0"/></linearGradient></defs>' +
    '<path d="' + area + '" fill="url(#g)"/>' +
    '<path d="' + line + '" fill="none" stroke="#4FC3B0" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
    dots +
    '<text x="' + pad + '" y="10" fill="#8B9CAD" font-size="9">' + mx.toFixed(1) + ' кг</text>' +
    '<text x="' + pad + '" y="' + (H - 3) + '" fill="#8B9CAD" font-size="9">' + mn.toFixed(1) + ' кг</text>';

  hint.textContent = shortDate(show[0].k) + ' → ' + shortDate(show[show.length - 1].k) +
    ' · ' + show.length + ' измервания';
}

/** Сравнява изчисления разход с реалния, изведен от промяната на теглото. */
function calibrate(keys, weights) {
  const box = $('calib');
  if (weights.length < 2) {
    box.innerHTML = 'Въведи поне две измервания на теглото и седмица хранения, за да сверя изчисления разход с реалния.';
    return;
  }
  const first = weights[0], last = weights[weights.length - 1];
  const span  = keys.filter(k => k >= first.k && k <= last.k && day(k).meals.length);
  const days  = daysBetween(first.k, last.k);

  if (days < 7 || span.length < Math.max(5, days * 0.6)) {
    box.innerHTML = 'За сверка ми трябват поне 7 дни с попълнени хранения между двете измервания. Досега: <b>' + span.length + '</b> дни.';
    return;
  }

  const dw       = last.w - first.w;
  const eaten    = span.reduce((s, k) => s + totals(k).inn, 0) / span.length;
  const realTDEE = eaten - (dw * KCAL_PER_KG) / days;
  const calcTDEE = span.reduce((s, k) => s + totals(k).out, 0) / span.length;
  const diff     = Math.round(realTDEE - calcTDEE);

  box.innerHTML =
    'За <b>' + days + ' дни</b> теглото се е променило с <b>' + (dw > 0 ? '+' : '') + dw.toFixed(1) +
    ' кг</b> при среден прием <b>' + fmt(eaten) + '</b> kcal.<br><br>' +
    'Реалният ти дневен разход излиза <b>' + fmt(realTDEE) + ' kcal</b> — с <b>' +
    fmt(Math.abs(diff)) + ' kcal ' + (diff < 0 ? 'по-нисък' : 'по-висок') +
    '</b> от изчисления (' + fmt(calcTDEE) + ').' +
    (Math.abs(diff) > 150
      ? '<br><br>Ако разликата се задържи и следващата седмица, коригирай целта с толкова.'
      : '<br><br>Изчислението съвпада с реалността — продължавай така.');
}

function renderHistory(keys) {
  const body = $('histBody');
  const rows = keys
    .filter(k => day(k).meals.length || day(k).workouts.length || day(k).weight)
    .sort().reverse().slice(0, 14);

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty">Още няма записи</td></tr>';
    return;
  }
  body.innerHTML = rows.map(k => {
    const t = totals(k), w = day(k).weight;
    const col = t.bal < 0 ? 'var(--burn)' : 'var(--over)';
    return '<tr><td>' + shortDate(k) + '</td>' +
      '<td class="r">' + fmt(t.inn) + '</td>' +
      '<td class="r">' + fmt(t.out) + '</td>' +
      '<td class="r" style="color:' + col + '">' + (t.bal > 0 ? '+' : '−') + fmt(Math.abs(t.bal)) + '</td>' +
      '<td class="r">' + (w ? w.toFixed(1) : '—') + '</td></tr>';
  }).join('');
}
