// Първо пускане: празен профил, който потребителят попълва веднъж.
// После всичко се променя от „Профил“ — този екран не се показва пак.

import { S, save } from '../state.js';
import { RATES } from '../energy.js';
import { $, on, show } from '../util.js';

const LIMITS = {
  wW: { min: 35,  max: 300, label: 'Теглото' },
  wH: { min: 120, max: 230, label: 'Ръстът' },
  wA: { min: 14,  max: 100, label: 'Възрастта' }
};

let pick = 450;

function renderRates() {
  const box = $('wDefs');
  box.innerHTML = '';
  RATES.forEach(r => {
    const el = document.createElement('div');
    el.className = 'dopt' + (pick === r.v ? ' on' : '');
    el.innerHTML = '<div class="dot"></div><div class="t">' + r.t +
      '<span>' + r.s + '</span></div><div class="kc">' + (r.v ? '−' + r.v : '0') + '</div>';
    el.onclick = () => { pick = r.v; renderRates(); };
    box.appendChild(el);
  });
}

/** Съобщение за първото невалидно поле, или '' ако всичко е наред. */
function invalid() {
  for (const id in LIMITS) {
    const { min, max, label } = LIMITS[id];
    const v = +$(id).value;
    if (!v) return label + ' липсва.';
    if (v < min || v > max) return label + ' трябва да е между ' + min + ' и ' + max + '.';
  }
  return '';
}

function finish(done) {
  const msg = invalid();
  if (msg) { $('wErr').textContent = msg; show('wErr'); return; }

  Object.assign(S.profile, {
    w: +$('wW').value, h: +$('wH').value, age: +$('wA').value,
    sex: $('wS').value, mult: +$('wM').value, deficit: pick, ready: true
  });
  save();
  $('welcome').classList.remove('on');
  done();
}

export const needed = () => !S.profile.ready;

export function start(done) {
  renderRates();
  show('wErr', false);
  $('welcome').classList.add('on');
  on('wGo', 'click', () => finish(done));
}
