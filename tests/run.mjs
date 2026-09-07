// Тестове без зависимости. Пускат се с JavaScriptCore, който върви с macOS:
//
//   /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m tests/run.mjs
//
// Покриват трите неща, които вече веднъж се счупиха тихо: първоначалния екран,
// нулирането и записването на API ключа.

const nodes = {};
const mk = id => ({
  id, value: '', textContent: '', className: '', innerHTML: '', hidden: false, disabled: false,
  handlers: {},
  addEventListener(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); },
  appendChild() {}, querySelector: () => mk('x')
});
globalThis.document = {
  getElementById: id => nodes[id] || (nodes[id] = mk(id)),
  createElement: () => mk('new'),
  querySelectorAll: () => [],
  activeElement: null
};
globalThis.window = {};
globalThis.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = v; },
  removeItem(k) { delete this.store[k]; }
};

const { S, hydrate, resetData, day } = await import('../js/state.js');
const { needed } = await import('../js/views/welcome.js');
const { bmr } = await import('../js/energy.js');
const settings = await import('../js/views/settings.js');

let bad = 0;
const t = (n, ok) => { print((ok ? 'ok   ' : 'FAIL ') + n); if (!ok) bad++; };
const fire = (id, ev) => (nodes[id].handlers[ev] || []).forEach(f => f());
const stored = () => JSON.parse(localStorage.store['kcal_tracker_v1'] || '{}');
const KEY = 'sk-ant-api03-ТЕСТОВ-КЛЮЧ';

print('— първоначален екран —');
t('нов потребител минава през екрана', needed() === true);
t('няма чужди мерки по подразбиране', !(S.profile.w === 85 && S.profile.h === 170));

hydrate({ profile: { w: 92, h: 181, age: 41, sex: 'm', mult: 1.4, deficit: 300 }, days: {} });
t('архив отпреди екрана се брои за готов', needed() === false);
t('мерките от архива се пазят', S.profile.w === 92);
t('BMR за мъж 92/181/41 = 1851', Math.round(bmr()) === 1851);

print('\n— нулиране —');
hydrate({
  profile: { w: 85, h: 170, age: 35, sex: 'm', mult: 1.3, deficit: 450, ready: true,
             api: { mode: 'direct', key: KEY, proxyUrl: '', model: 'claude-opus-5' } },
  days: { '2026-09-06': { meals: [{ name: 'пиле', kcal: 600 }], workouts: [], weight: 85 } }
});
resetData();
t('дневникът се изчиства', Object.keys(S.days).length === 0);
t('първоначалният екран се връща', needed() === true);
t('КЛЮЧЪТ оцелява', S.profile.api.key === KEY);
t('моделът оцелява', S.profile.api.model === 'claude-opus-5');
t('нов ден е валиден след нулиране', day('2026-09-07').meals.length === 0);

print('\n— записване на API ключа —');
hydrate({
  profile: { w: 85, h: 170, age: 35, sex: 'm', mult: 1.3, deficit: 450, ready: true,
             api: { mode: 'direct', key: KEY, proxyUrl: '', model: 'claude-sonnet-5' } },
  days: {}
});
settings.wire();
settings.render();
t('ключът се показва в полето', nodes.aKey.value === KEY);
t('надписът потвърждава записан ключ', nodes.keyState.textContent.indexOf('✓') === 0);

// Android Chrome изчиства полета от тип password при пререндериране.
// Преди това една такава празна стойност изтриваше записания ключ.
nodes.aKey.value = '';
nodes.aModel.value = 'claude-opus-5';
fire('aModel', 'change');
t('ключът оцелява при смяна на модела', stored().profile.api.key === KEY);
t('новият модел се записва', stored().profile.api.model === 'claude-opus-5');

nodes.aKey.value = '';
nodes.pW.value = '84';
fire('pW', 'change');
t('ключът оцелява при смяна на теглото', stored().profile.api.key === KEY);

nodes.aKey.value = 'sk-ant-НОВИЯТ';
fire('aKey', 'input');
t('нов ключ се записва още при въвеждане', stored().profile.api.key === 'sk-ant-НОВИЯТ');

nodes.aKey.value = '';
fire('aKey', 'input');
t('изрично изчистване от полето се уважава', stored().profile.api.key === '');

print(bad ? ('\n' + bad + ' ПАДНАЛИ ТЕСТА') : '\nвсички ' + 18 + ' теста минават');
