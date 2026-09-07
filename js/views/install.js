// Добавяне на началния екран. Три различни свята, всеки със свой път:
//
//  · Android и настолен Chrome — браузърът дава beforeinstallprompt и има истински бутон
//  · Safari на iPhone — няма такова събитие, показваме стъпките с думи
//  · Chrome / Firefox / Edge на iPhone — Apple не им дава да инсталират изобщо,
//    затова единственият честен съвет е „отвори го в Safari“
//
// Кутията изчезва, щом приложението вече върви инсталирано.

import { $, show } from '../util.js';

let deferred = null;

const standalone = () =>
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

const isIOS    = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const iosOther = () => isIOS() && /CriOS|FxiOS|EdgiOS|OPT\//.test(navigator.userAgent);

export function render() {
  if (standalone()) { show('installBox', false); return; }

  const title = $('installTitle'), text = $('installText');

  if (deferred) {
    title.textContent = 'Добави на началния екран';
    text.textContent = 'Отваря се на цял екран, с икона, и работи без интернет.';
  } else if (iosOther()) {
    title.textContent = 'Отвори адреса в Safari';
    text.textContent = 'На iPhone единствено Safari може да добавя приложения на началния ' +
      'екран — Chrome няма право. Отвори същия адрес в Safari и стъпките ще се появят тук.';
  } else if (isIOS()) {
    title.textContent = 'Добави на началния екран';
    text.textContent = 'Бутонът за споделяне долу в средата → „Към началния екран“ → „Добави“.';
  } else {
    title.textContent = 'Добави на началния екран';
    text.textContent = 'От менюто на браузъра (⋮ горе вдясно) избери „Инсталирай приложението“ ' +
      'или „Добави към началния екран“.';
  }

  show('installBtn', !!deferred);
  show('installBox');
}

export function wire() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();      // спира собствения банер на браузъра, за да не се дублира
    deferred = e;
    render();
  });
  window.addEventListener('appinstalled', () => { deferred = null; render(); });

  const btn = $('installBtn');
  if (btn) btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    render();
  });
}
