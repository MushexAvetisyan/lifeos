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


export function isoDay(iso) {
  if (!iso) return null;
  return String(iso).slice(0, 10);
}

export function toDateFromISO(iso) {
  const d = new Date(String(iso));
  return isNaN(d.getTime()) ? null : d;
}

export function toISODate(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Compute next due date (YYYY-MM-DD) for a recurring task.
 * - baseISO: current due date (YYYY-MM-DD) or today
 * - repeat: {type, interval, days?}
 */
export function nextRecurringDue(baseISO, repeat) {
  if (!repeat || !repeat.type) return null;

  const interval = Math.max(1, Number(repeat.interval || 1));
  const base = toDateFromISO(baseISO || new Date().toISOString());
  if (!base) return null;

  if (repeat.type === "daily") {
    const d = new Date(base);
    d.setDate(d.getDate() + interval);
    return toISODate(d);
  }

  if (repeat.type === "monthly") {
    const d = new Date(base);
    const dayOfMonth = d.getDate();          // сохраняем “день месяца” как у base due
    d.setMonth(d.getMonth() + interval);

    // если в новом месяце нет такого дня (например 31), Date перепрыгнет.
    // нормализуем: ставим последний день месяца.
    const candidate = new Date(d.getFullYear(), d.getMonth(), dayOfMonth);
    if (candidate.getMonth() !== d.getMonth()) {
      // последний день месяца
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return toISODate(last);
    }
    return toISODate(candidate);
  }

  if (repeat.type === "weekly") {
    const days = Array.isArray(repeat.days) && repeat.days.length
        ? repeat.days.slice().sort((a, b) => a - b)
        : [base.getDay()]; // если дни не заданы — повторяем по дню due

    // ищем ближайший выбранный день, начиная со следующего дня
    // и учитываем interval недель как “минимальный сдвиг”
    const start = new Date(base);
    start.setDate(start.getDate() + 1);

    // минимальный “порог” по неделям (interval)
    // если interval > 1, то мы не позволяем выбрать дату раньше чем base + 7*(interval-1)
    const min = new Date(base);
    min.setDate(min.getDate() + 7 * (interval - 1));

    for (let step = 0; step < 366; step++) {
      const d = new Date(start);
      d.setDate(start.getDate() + step);

      if (d < min) continue;
      if (days.includes(d.getDay())) return toISODate(d);
    }
    return null;
  }

  return null;
}