// Единственият източник на истина. Всяка промяна минава през save().

import { persist } from './storage.js';
import { today } from './util.js';

const DEFAULTS = {
  profile: {
    w: 85, h: 170, age: 35, sex: 'm',
    mult: 1.3,        // разход извън тренировките
    deficit: 450,     // целеви дневен дефицит
    api: { mode: 'direct', key: '', proxyUrl: '', model: 'claude-sonnet-5' }
  },
  days: {}
};

export const S = structuredClone(DEFAULTS);
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
  }
  if (saved.days && typeof saved.days === 'object') S.days = saved.days;
}

export function replaceAll(obj) {
  if (!obj || !obj.profile || !obj.days) throw new Error('невалиден архив');
  Object.assign(S, structuredClone(DEFAULTS));
  hydrate(obj);
  save();
}
