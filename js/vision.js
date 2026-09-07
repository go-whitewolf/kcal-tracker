// Снимка → оценка на калориите чрез Claude.
// Ключът е на потребителя и стои само на устройството (виж правило 2 в CLAUDE.md).

import { S } from './state.js';

const API_URL  = 'https://api.anthropic.com/v1/messages';
const MAX_EDGE = 1280;   // по-голямо не подобрява оценката, но оскъпява заявката
const QUALITY  = 0.82;

const SYSTEM = `Ти си нутриционист, който оценява калориите на ястие по снимка.

Разпознай отделните компоненти и за всеки дай реалистична оценка на грамажа,
калориите и протеина. Съобразявай се със следното:

- Обичайна чиния за основно е 26–28 см в диаметър; използвай приборите и чашите
  като мащаб.
- Отчитай начина на приготвяне. Мазнината от готвене е най-честият източник на
  подценяване: ресто зеленчуци, задушено месо и ястия от ресторант почти винаги
  съдържат повече олио, отколкото личи.
- Ако месото е с кожа, брой я. Ако не се вижда дали е с кожа, приеми че е.
- При сосове и дресинги оценявай отделно.
- По-добре леко над, отколкото под реалното. Подценената оценка е по-вредна за
  проследяването от леко завишената.

Отговори САМО с JSON обект, без обяснения и без ограда с обратни апострофи:

{
  "dish": "кратко име на ястието на български",
  "items": [
    {"name": "компонент на български", "grams": 150, "kcal": 250, "protein": 25}
  ],
  "total_kcal": 800,
  "total_protein": 55,
  "confidence": "висока" | "средна" | "ниска",
  "note": "едно изречение за това какво остава несигурно, на български"
}`;

/** Свива снимката и я връща като base64 без префикса. */
export function prepareImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Снимката не може да бъде прочетена.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Файлът не е разпознат като снимка.'));
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width  = Math.round(img.width  * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const url = c.toDataURL('image/jpeg', QUALITY);
        resolve({ base64: url.split(',')[1], preview: url });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function headers() {
  const api = S.profile.api;
  if (api.mode === 'proxy') return { 'content-type': 'application/json' };
  return {
    'content-type': 'application/json',
    'x-api-key': api.key,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true'
  };
}

const endpoint = () => S.profile.api.mode === 'proxy' ? S.profile.api.proxyUrl : API_URL;

export const DEFAULT_MODEL = 'claude-sonnet-5';
const model = () => S.profile.api.model || DEFAULT_MODEL;

/** Настройката за мислене се различава по модел — грешната стойност дава 400
 *  или разваля отговора. Виж CLAUDE.md, раздел „Работа с Claude API“. */
function reasoning(m) {
  // Fable 5.1 мисли винаги. Всяка изрична настройка на thinking връща 400.
  if (m.startsWith('claude-fable')) return { output_config: { effort: 'medium' } };
  // Opus 5: с изключено мислене изпуска <thinking> тагове в отговора и чупи JSON-а.
  if (m.startsWith('claude-opus-5')) {
    return { thinking: { type: 'adaptive' }, output_config: { effort: 'medium' } };
  }
  // Haiku 4.5 не мисли по подразбиране и връща грешка при output_config.
  if (m.startsWith('claude-haiku')) return {};
  return { thinking: { type: 'disabled' } };
}

/** Мислещите модели харчат от същия таван като отговора. 1500 стигаха, докато
 *  мисленето беше изключено навсякъде; при Opus и Fable отрязваха JSON-а наполовина. */
const MAX_TOKENS = 8000;

/** Отговорът може да съдържа няколко блока — никога content[0].text. */
function textOf(data) {
  return (data.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim();
}

function parseJson(txt) {
  const clean = txt.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = clean.indexOf('{');
  const end   = clean.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Отговорът не съдържа очаквания формат.');
  return JSON.parse(clean.slice(start, end + 1));
}

function friendlyError(status, body) {
  if (status === 401 || status === 403) return 'Ключът е отхвърлен. Провери го в „Профил“.';
  if (status === 429) return 'Твърде много заявки за кратко. Изчакай минута и опитай пак.';
  if (status === 400 && /credit|balance/i.test(body)) return 'Няма кредит в API акаунта.';
  if (status >= 500) return 'Услугата не отговаря в момента. Опитай след малко.';
  return 'Заявката не мина (код ' + status + ').';
}

/** Изпраща снимката и връща обекта с оценката. */
export async function analyze(base64, userHint) {
  const api = S.profile.api;
  if (api.mode === 'direct' && !api.key) throw new Error('Липсва API ключ. Въведи го в „Профил“.');
  if (api.mode === 'proxy'  && !api.proxyUrl) throw new Error('Липсва адрес на проксито.');

  const ask = userHint
    ? 'Оцени калориите на това ястие. Допълнителна информация от мен: ' + userHint
    : 'Оцени калориите на това ястие.';

  const m = model();
  const body = {
    model: m,
    max_tokens: MAX_TOKENS,
    ...reasoning(m),
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
        { type: 'text', text: ask }
      ]
    }]
  };
  // Внимание: не задавай temperature / top_p / top_k — Sonnet 5 връща 400.

  let res;
  try {
    res = await fetch(endpoint(), { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  } catch (e) {
    throw new Error('Няма връзка с услугата. Провери интернета.');
  }

  const raw = await res.text();
  if (!res.ok) throw new Error(friendlyError(res.status, raw));

  let data;
  try { data = JSON.parse(raw); }
  catch (e) { throw new Error('Отговорът не е разпознат. Ако ползваш прокси, провери адреса.'); }

  // Мислещите модели могат да откажат заявка или да опрат в тавана — и в двата
  // случая идва код 200 с непълно съдържание, не грешка.
  if (data.stop_reason === 'refusal') {
    throw new Error('Моделът отказа да оцени тази снимка. Пробвай с друга снимка или с друг модел.');
  }
  if (data.stop_reason === 'max_tokens') {
    throw new Error('Отговорът се получи твърде дълъг и беше отрязан. Опитай пак или смени модела.');
  }

  return normalise(parseJson(textOf(data)));
}

/** Изглаждане: моделът понякога изпуска поле или бърка сбора. */
function normalise(r) {
  const items = (r.items || []).map(i => ({
    name: String(i.name || 'компонент'),
    grams: +i.grams || 0,
    kcal: Math.max(0, Math.round(+i.kcal || 0)),
    protein: Math.max(0, Math.round(+i.protein || 0))
  })).filter(i => i.kcal > 0);

  const sum = items.reduce((s, i) => s + i.kcal, 0);
  return {
    dish: String(r.dish || 'Хранене'),
    items,
    total_kcal: Math.round(+r.total_kcal) || sum,
    total_protein: Math.round(+r.total_protein) || items.reduce((s, i) => s + i.protein, 0),
    confidence: ['висока','средна','ниска'].includes(r.confidence) ? r.confidence : 'средна',
    note: String(r.note || '')
  };
}

/** Кратка заявка, с която „Провери връзката“ потвърждава, че ключът работи. */
export async function ping() {
  const m = model();
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      model: m,
      max_tokens: 256,
      ...reasoning(m),
      messages: [{ role: 'user', content: 'Отговори само с думата: готово' }]
    })
  });
  if (!res.ok) throw new Error(friendlyError(res.status, await res.text()));
  return true;
}
