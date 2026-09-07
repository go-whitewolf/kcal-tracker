// Всички енергийни изчисления. Числата са оценки, не измервания.

import { S, day } from './state.js';

/** Mifflin–St Jeor */
export function bmr() {
  const p = S.profile;
  const base = 10 * p.w + 6.25 * p.h - 5 * p.age;
  return p.sex === 'm' ? base + 5 : base - 161;
}

/** Разход за деня преди тренировките */
export const baseline = () => bmr() * S.profile.mult;

export const MET = { gym:5.5, run:9.8, walk:3.5, tennis:7.3, bike:8, swim:7, hiit:8.5, other:4 };

export const WNAME = {
  gym:'Фитнес', run:'Бягане', walk:'Ходене', tennis:'Тенис',
  bike:'Колело', swim:'Плуване', hiit:'Интервали', other:'Друго'
};

/** Нето разход: изважда се базалният, който тече и без тренировка.
 *  При бягане километрите са по-точни от минутите (~0,95 kcal/кг/км). */
export function autoKcal(type, min, km) {
  const w = S.profile.w;
  if (type === 'run' && km > 0) return Math.round(0.95 * w * km);
  if (!min) return 0;
  return Math.round((MET[type] - 1) * 3.5 * w / 200 * min);
}

export function totals(key) {
  const d = day(key);
  const inn  = d.meals.reduce((s, m) => s + (+m.kcal || 0), 0);
  const prot = d.meals.reduce((s, m) => s + (+m.prot || 0), 0);
  const wo   = d.workouts.reduce((s, x) => s + (+x.kcal || 0), 0);
  const out  = baseline() + wo;
  return { inn, prot, wo, out, goal: Math.round(out - S.profile.deficit), bal: Math.round(inn - out) };
}

/** 7700 kcal ≈ 1 кг телесна мазнина */
export const KCAL_PER_KG = 7700;

export const RATES = [
  { v:0,   t:'Поддържане', s:'без промяна в теглото' },
  { v:300, t:'Бавно',      s:'около 0,3 кг седмично' },
  { v:450, t:'Умерено',    s:'около 0,4 кг седмично' },
  { v:700, t:'Бързо',      s:'около 0,6 кг седмично — трудно за задържане' }
];
