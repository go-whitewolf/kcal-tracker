// Сладкото: отбелязва се по ден, лимитът е на седмица (понеделник–неделя).
// Не забранява нищо — само брои. Решението остава за човека.

import { S, day } from './state.js';
import { fromIso, shift } from './util.js';

export const DEFAULT_SWEET_LIMIT = 2;

/** Понеделникът на седмицата, в която е денят. */
export function weekStart(key) {
  const dow = (fromIso(key).getDay() + 6) % 7;   // пн = 0 … нд = 6
  return shift(key, -dow);
}

/** Колко дни със сладко има в седмицата на дадения ден. */
export function sweetsInWeek(key) {
  const mon = weekStart(key);
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const k = shift(mon, i);
    if (S.days[k] && day(k).sweet) n++;
  }
  return n;
}

export const sweetLimit = () =>
  Number.isFinite(+S.profile.sweetLimit) ? +S.profile.sweetLimit : DEFAULT_SWEET_LIMIT;
