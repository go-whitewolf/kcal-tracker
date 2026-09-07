// Дати, форматиране и малки DOM помощници.

export const DOW = ['неделя','понеделник','вторник','сряда','четвъртък','петък','събота'];
export const MON = ['яну','фев','мар','апр','май','юни','юли','авг','сеп','окт','ное','дек'];

const pad = n => String(n).padStart(2, '0');

export const iso     = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const today   = () => iso(new Date());
export const fromIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const shift   = (s, n) => { const d = fromIso(s); d.setDate(d.getDate() + n); return iso(d); };
export const daysBetween = (a, b) => Math.round((fromIso(b) - fromIso(a)) / 864e5);

export const shortDate = s => { const d = fromIso(s); return d.getDate() + ' ' + MON[d.getMonth()]; };

/** 2640 -> "2 640" */
export const fmt = n => Math.round(n).toLocaleString('bg-BG').replace(/\u00A0/g, ' ');

export const esc = s => String(s).replace(/[&<>"]/g, c =>
  ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

export const $  = id => document.getElementById(id);
export const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };

export const show = (id, yes = true) => { const el = $(id); if (el) el.hidden = !yes; };

export function openSheet(id) { $(id).classList.add('on'); }
export function closeSheet(id) { $(id).classList.remove('on'); }

let toastTimer;
export function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2600);
}
