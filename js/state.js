// Единственият източник на истина. Всяка промяна минава през save().

import { persist } from './storage.js';
import { today } from './util.js';

const DEFAULTS = {
  profile: {
    w: 80, h: 175, age: 30, sex: 'm',
    mult: 1.3,        // разход извън тренировките
    deficit: 450,     // целеви дневен дефицит
    ready: false,     // false = още не е минал през първоначалния екран
    api: { mode: 'direct', key: '', proxyUrl: '', model: 'claude-sonnet-5' }
  },
  days: {}
};

/** Дълбоко копие. DEFAULTS е чист JSON, така че това е достатъчно — и работи
 *  на по-стари телефони, където structuredClone още го няма. */
const clone = o => JSON.parse(JSON.stringify(o));

export const S = clone(DEFAULTS);
export let cur = today();

export function setCur(d) { cur = d; }

/** Връща деня, като го създава при първо докосване. Попълва липсващи полета
 *  от стари записи, вместо да гърми — виж правило 5 в CLAUDE.md. */
export function day(key = cur) {
  const d = S.days[key] || (S.days[key] = {});
  if (!Array.isArray(d.meals))    d.meals = [];
  if (!Array.isArray(d.workouts)) d.workouts = [];
  if (d.weight === undefined)     d.weight = null;
  return d;
}

export function save() { persist(S); }

export function hydrate(saved) {
  if (!saved) return;
  if (saved.profile) {
    Object.assign(S.profile, saved.profile);
    S.profile.api = Object.assign({}, DEFAULTS.profile.api, saved.profile.api || {});
    // Архив отпреди първоначалния екран: профилът вече е попълнен, не питай пак.
    if (saved.profile.ready === undefined) S.profile.ready = true;
  }
  if (saved.days && typeof saved.days === 'object') S.days = saved.days;
}

/** Нулира профила и дневника, но оставя настройките за връзка непокътнати.
 *  Ключът е нещо, което потребителят е въвел веднъж и не бива да го въвежда пак
 *  само защото иска да започне дневника отначало. */
export function resetData() {
  const api = clone(S.profile.api);
  Object.assign(S, clone(DEFAULTS));
  S.profile.api = api;
  save();
}

export function replaceAll(obj) {
  if (!obj || !obj.profile || !obj.days) throw new Error('невалиден архив');
  Object.assign(S, clone(DEFAULTS));
  hydrate(obj);
  save();
}
