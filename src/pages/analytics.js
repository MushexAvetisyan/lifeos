// src/pages/analytics.js
import { getState } from "../store.js";
import { todayISO } from "../utils.js";

export function pageTitle() {
  return "Analytics";
}

export function render() {
  const root = document.createElement("div");
  root.className = "grid";
  root.style.gap = "12px";

  const header = document.createElement("div");
  header.className = "card";
  header.innerHTML = `
    <div class="card-body">
      <div class="row space-between wrap" style="align-items:flex-start">
        <div style="display:grid;gap:6px">
          <div style="font-weight:900;font-size:16px">Analytics</div>
          <div style="color:var(--muted);font-size:12px">Tasks • Habits • Learning minutes (local only)</div>
        </div>
        <div class="row wrap">
          <button class="btn btn-ghost" id="range7" type="button">Last 7 days</button>
          <button class="btn btn-ghost" id="range30" type="button">Last 30 days</button>
        </div>
      </div>
    </div>
  `;
  root.appendChild(header);

  const summary = document.createElement("div");
  summary.className = "grid cols-2";
  summary.style.gap = "12px";
  root.appendChild(summary);

  const charts = document.createElement("div");
  charts.className = "grid";
  charts.style.gap = "12px";
  root.appendChild(charts);

  const ui = { range: 7 };
  // restore range
  try {
    const saved = JSON.parse(localStorage.getItem("life_os_analytics_ui") || "null");
    if (saved && typeof saved === "object" && (saved.range === 7 || saved.range === 30)) ui.range = saved.range;
  } catch {}

  const b7 = header.querySelector("#range7");
  const b30 = header.querySelector("#range30");

  b7.addEventListener("click", () => {
    ui.range = 7;
    saveUI();
    repaint();
  });
  b30.addEventListener("click", () => {
    ui.range = 30;
    saveUI();
    repaint();
  });

  repaint();
  return root;

  function saveUI() {
    localStorage.setItem("life_os_analytics_ui", JSON.stringify(ui));
  }

  function repaint() {
    const s = getState();
    const end = todayISO();
    const days = makeDateRange(ui.range, end); // oldest -> newest

    // --------- Build series ----------
    const tasksCreated = countByDay(s.tasks || [], days, (t) => toDay(t.createdAt));
    const tasksDone = countByDay(s.tasks || [], days, (t) => toDay(t.completedAt));
    const habitCheckins = habitCheckinsByDay(s.habits || [], days); // total checkins across habits per day
    const learningMinutes = minutesByDay(s.timeLogs || [], days); // learning only

    // --------- Summary numbers ----------
    const createdTotal = sum(tasksCreated);
    const doneTotal = sum(tasksDone);
    const doneRate = createdTotal ? Math.round((doneTotal / createdTotal) * 100) : 0;

    const habitsTotal = (s.habits || []).length;
    const checkinsTotal = sum(habitCheckins);
    const possibleCheckins = habitsTotal * ui.range;
    const habitRate = possibleCheckins ? Math.round((checkinsTotal / possibleCheckins) * 100) : 0;

    const learnTotal = sum(learningMinutes);
    const learnAvg = ui.range ? Math.round(learnTotal / ui.range) : 0;

    // Simple “score” (rough, but motivating)
    const score = Math.round(
        doneTotal * 3 +
        checkinsTotal * 1 +
        Math.min(learnTotal, ui.range * 180) / 10
    );

    // --------- Render summary ----------
    summary.innerHTML = "";

    summary.appendChild(
        statCard("Tasks", [
          ["Created", createdTotal],
          ["Completed", doneTotal],
          ["Completion rate", `${doneRate}%`],
        ])
    );

    summary.appendChild(
        statCard("Habits", [
          ["Habits count", habitsTotal],
          ["Total check-ins", checkinsTotal],
          ["Consistency", `${habitRate}%`],
        ])
    );

    summary.appendChild(
        statCard("Learning", [
          ["Total minutes", learnTotal],
          ["Avg / day", `${learnAvg} min`],
          ["Days range", ui.range],
        ])
    );

    summary.appendChild(
        statCard("Overall", [
          ["Score", score],
          ["Today", end],
          ["Data source", "localStorage"],
        ])
    );

    // --------- Render charts ----------
    charts.innerHTML = "";

    charts.appendChild(
        chartCard({
          title: "Tasks completed per day",
          subtitle: `Last ${ui.range} days`,
          labels: days.map(shortDay),
          values: tasksDone,
        })
    );

    charts.appendChild(
        chartCard({
          title: "Tasks created per day",
          subtitle: `Last ${ui.range} days`,
          labels: days.map(shortDay),
          values: tasksCreated,
        })
    );

    charts.appendChild(
        chartCard({
          title: "Habit check-ins per day",
          subtitle: `Total check-ins across all habits`,
          labels: days.map(shortDay),
          values: habitCheckins,
        })
    );

    charts.appendChild(
        chartCard({
          title: "Learning minutes per day",
          subtitle: `Sum of learning time logs`,
          labels: days.map(shortDay),
          values: learningMinutes,
          valueSuffix: " min",
        })
    );

    // active range button style
    b7.classList.toggle("btn-primary", ui.range === 7);
    b30.classList.toggle("btn-primary", ui.range === 30);
    b7.classList.toggle("btn-ghost", ui.range !== 7);
    b30.classList.toggle("btn-ghost", ui.range !== 30);
  }
}

/* ---------------- UI helpers ---------------- */

function statCard(title, rows) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="card-body" style="display:grid;gap:10px">
      <div style="font-weight:900">${escapeHTML(title)}</div>
      <div class="grid" style="gap:8px">
        ${rows
      .map(
          ([k, v]) => `
          <div class="row space-between wrap">
            <div style="color:var(--muted);font-size:12px">${escapeHTML(k)}</div>
            <div style="font-weight:800">${escapeHTML(String(v))}</div>
          </div>`
      )
      .join("")}
      </div>
    </div>
  `;
  return card;
}

function chartCard({ title, subtitle, labels, values, valueSuffix = "" }) {
  const card = document.createElement("div");
  card.className = "card";

  const max = Math.max(1, ...values);
  const total = sum(values);

  const body = document.createElement("div");
  body.className = "card-body";
  body.style.display = "grid";
  body.style.gap = "10px";

  const head = document.createElement("div");
  head.innerHTML = `
    <div style="display:grid;gap:4px">
      <div style="font-weight:900">${escapeHTML(title)}</div>
      <div style="color:var(--muted);font-size:12px">${escapeHTML(subtitle)} • Total: ${escapeHTML(String(total))}${escapeHTML(valueSuffix)}</div>
    </div>
  `;

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = `repeat(${labels.length}, minmax(0, 1fr))`;
  grid.style.gap = "6px";
  grid.style.alignItems = "end";
  grid.style.height = "160px";
  grid.style.paddingTop = "6px";

  labels.forEach((lab, i) => {
    const v = values[i] ?? 0;
    const barWrap = document.createElement("div");
    barWrap.style.display = "grid";
    barWrap.style.gap = "6px";
    barWrap.style.alignItems = "end";
    barWrap.style.height = "100%";

    const bar = document.createElement("div");
    bar.style.height = `${Math.round((v / max) * 100)}%`;
    bar.style.borderRadius = "10px";
    bar.style.background = "color-mix(in oklab, var(--accent) 35%, var(--panel-2))";
    bar.style.border = "1px solid var(--border)";
    bar.title = `${lab}: ${v}${valueSuffix}`;

    const lbl = document.createElement("div");
    lbl.style.textAlign = "center";
    lbl.style.fontSize = "11px";
    lbl.style.color = "var(--muted)";
    lbl.textContent = lab;

    barWrap.appendChild(bar);
    barWrap.appendChild(lbl);
    grid.appendChild(barWrap);
  });

  // tiny legend row
  const legend = document.createElement("div");
  legend.className = "row wrap";
  legend.style.gap = "8px";
  legend.innerHTML = `
    <span class="badge">Max/day: ${escapeHTML(String(max))}${escapeHTML(valueSuffix)}</span>
    <span class="badge">Avg/day: ${escapeHTML(String(Math.round(total / labels.length)))}${escapeHTML(valueSuffix)}</span>
  `;

  body.appendChild(head);
  body.appendChild(grid);
  body.appendChild(legend);
  card.appendChild(body);
  return card;
}

/* ---------------- Data helpers ---------------- */

function makeDateRange(n, endISO) {
  const end = new Date(endISO);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function toDay(iso) {
  if (!iso) return null;
  const s = String(iso);
  if (s.length >= 10) return s.slice(0, 10);
  return null;
}

function countByDay(items, days, getDayFn) {
  const map = new Map(days.map((d) => [d, 0]));
  for (const it of items) {
    const day = getDayFn(it);
    if (day && map.has(day)) map.set(day, map.get(day) + 1);
  }
  return days.map((d) => map.get(d) || 0);
}

function habitCheckinsByDay(habits, days) {
  const map = new Map(days.map((d) => [d, 0]));
  for (const h of habits) {
    const arr = Array.isArray(h.checkins) ? h.checkins : [];
    for (const x of arr) {
      const day = toDay(x);
      if (day && map.has(day)) map.set(day, map.get(day) + 1);
    }
  }
  return days.map((d) => map.get(d) || 0);
}

function minutesByDay(timeLogs, days) {
  const map = new Map(days.map((d) => [d, 0]));
  for (const x of timeLogs) {
    if (x?.type !== "learning") continue;
    const day = toDay(x.date || x.createdAt);
    if (!day || !map.has(day)) continue;
    map.set(day, map.get(day) + Number(x.minutes || 0));
  }
  return days.map((d) => map.get(d) || 0);
}

function shortDay(iso) {
  // show MM-DD
  return String(iso).slice(5, 10);
}

function sum(arr) {
  return (arr || []).reduce((a, b) => a + Number(b || 0), 0);
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]
  ));
}
