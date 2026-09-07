// Единствената точка за достъп до диска.
// Работи и там, където съществува window.storage, и в обикновен браузър.

const KEY = 'kcal_tracker_v1';

export async function load() {
  try {
    if (window.storage) {
      const r = await window.storage.get(KEY, false);
      if (r && r.value) return JSON.parse(r.value);
    }
  } catch (e) { /* ключът още не съществува — нормално при първо пускане */ }
  try {
    const s = localStorage.getItem(KEY);
    return s ? JSON.parse(s) : null;
  } catch (e) { return null; }
}

export async function persist(obj) {
  const s = JSON.stringify(obj);
  try { if (window.storage) await window.storage.set(KEY, s, false); } catch (e) {}
  try { localStorage.setItem(KEY, s); } catch (e) {}
}
