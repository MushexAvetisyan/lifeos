export const uid = () =>
  (crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(16).slice(2)}`);

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function safeJSONParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}
