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
const { weekStart, sweetsInWeek, sweetLimit } = await import('../js/sweets.js');
const { analyze } = await import('../js/vision.js');

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

print('\n— сладко —');
hydrate({ profile: { ready: true, sweetLimit: 2 }, days: {
  '2026-09-21': { meals: [], workouts: [], weight: null, sweet: true },   // пн
  '2026-09-24': { meals: [], workouts: [], weight: null, sweet: true },   // чт
  '2026-09-20': { meals: [], workouts: [], weight: null, sweet: true },   // нд — миналата седмица
  '2026-09-25': { meals: [], workouts: [], weight: null }                  // стар запис без sweet
}});
t('седмицата започва в понеделник', weekStart('2026-09-27') === '2026-09-21');
t('понеделникът е начало на себе си', weekStart('2026-09-21') === '2026-09-21');
t('брои само текущата седмица', sweetsInWeek('2026-09-27') === 2);
t('неделята отпреди е в друга седмица', sweetsInWeek('2026-09-20') === 1);
t('стар ден без поле sweet не гърми', day('2026-09-25').sweet === false);
t('лимитът идва от профила', sweetLimit() === 2);
hydrate({ profile: { ready: true }, days: {} });
S.profile.sweetLimit = undefined;
t('без лимит в профила — по подразбиране 2', sweetLimit() === 2);

print('\n— оценка по текст —');
let sent = null;
globalThis.fetch = async (url, opts) => {
  sent = JSON.parse(opts.body);
  return { ok: true, status: 200, text: async () => JSON.stringify({
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: '{"dish":"Ориз с пиле","items":[' +
      '{"name":"ориз","grams":200,"kcal":260,"protein":5},' +
      '{"name":"пиле","grams":100,"kcal":165,"protein":31}],' +
      '"total_kcal":425,"total_protein":36,"confidence":"висока","note":""}' }]
  }) };
};
S.profile.api = { mode: 'direct', key: KEY, proxyUrl: '', model: 'claude-sonnet-5' };
const r = await analyze(null, '200 г ориз, 100 г пиле');
t('текстът се праща без снимка', typeof sent.messages[0].content === 'string');
t('описанието влиза в заявката', sent.messages[0].content.indexOf('200 г ориз') !== -1);
t('резултатът се разчита', r.items.length === 2 && r.total_kcal === 425);
await analyze('QUJD', '');
t('снимката още се праща като image блок', sent.messages[0].content[0].type === 'image');

print(bad ? ('\n' + bad + ' ПАДНАЛИ ТЕСТА') : '\nвсички тестове минават');
