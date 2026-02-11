import { safeJSONParse } from "./utils.js";

const KEY = "life_os_state_v1";

// src/store.js  (only the defaultState part)
const defaultState = {
  meta: { version: 1 },
  settings: { theme: "dark", accent: "#7c3aed" },

  dashboard: { quickNote: "" }, // ✅ add this

  tasks: [],
  habits: [],
  topics: [],
  lessons: [],
  timeLogs: [],

  templates: {
    taskSets: [],
    habitSets: []
  }

};


export function resetAllData() {
  localStorage.removeItem(KEY);           // ✅ удаляем правильный ключ
  state = structuredClone(defaultState);  // ✅ чистое состояние
  save();                                 // ✅ сохраняем пустое
  listeners.forEach((fn) => fn(state));   // ✅ уведомляем UI
}

let state = load();
const listeners = new Set();

function load() {
  const raw = localStorage.getItem(KEY);
  const parsed = safeJSONParse(raw, null);
  if (!parsed || typeof parsed !== "object") return structuredClone(defaultState);
  return { ...structuredClone(defaultState), ...parsed };
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function getState() {
  return state;
}

export function setState(updater) {
  const draft = structuredClone(state);
  const res = typeof updater === "function" ? updater(draft) : updater;
  state = res ?? draft; // ✅ если вернули undefined — берём draft
  save();
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetState() {
  state = structuredClone(defaultState);
  save();
  listeners.forEach((fn) => fn(state));
}

export function exportState() {
  return JSON.stringify(state, null, 2);
}

export function importState(jsonString) {
  const parsed = safeJSONParse(jsonString, null);
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid JSON backup.");
  if (!parsed.meta?.version) throw new Error("Backup missing meta.version.");
  state = { ...structuredClone(defaultState), ...parsed };
  save();
  listeners.forEach((fn) => fn(state));
}
