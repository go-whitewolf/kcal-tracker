// Инициализация и рутиране между изгледите.

import { hydrate } from './state.js';
import { load } from './storage.js';
import * as dayView from './views/day.js';
import * as progressView from './views/progress.js';
import * as settingsView from './views/settings.js';
import * as welcome from './views/welcome.js';

function route(name) {
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.v === name));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + name));
  if (name === 'prog') progressView.render();
  if (name === 'set')  settingsView.render();
  window.scrollTo(0, 0);
}

(async function start() {
  hydrate(await load());

  dayView.wire();
  settingsView.wire();
  dayView.setProfileHook(() => settingsView.render());
  settingsView.setChangeHook(() => dayView.render());

  document.querySelectorAll('nav button').forEach(b => {
    b.addEventListener('click', () => route(b.dataset.v));
  });

  const paint = () => { dayView.render(); settingsView.render(); };
  if (welcome.needed()) welcome.start(paint); else paint();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
