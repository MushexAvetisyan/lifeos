// src/pages/calendar.js
import { getState } from "../store.js";
import { todayISO } from "../utils.js";

export function pageTitle() {
    return "Calendar";
}

export function render() {
    const root = document.createElement("div");
    root.className = "grid";
    root.style.gap = "12px";

    const header = document.createElement("div");
    header.className = "card";
    header.innerHTML = `
    <div class="card-body row space-between wrap" style="align-items:center">
      <div style="display:grid;gap:6px">
        <div style="font-weight:900;font-size:16px">Calendar</div>
        <div style="color:var(--muted);font-size:12px">Tasks due • Habit check-ins • Learning minutes</div>
      </div>

      <div class="row wrap" style="gap:8px;align-items:center">
        <button class="btn" id="prevBtn" type="button">←</button>
        <div class="badge" id="monthLabel">—</div>
        <button class="btn" id="nextBtn" type="button">→</button>
        <button class="btn btn-ghost" id="todayBtn" type="button">Today</button>
      </div>
    </div>
  `;
    root.appendChild(header);

    const gridCard = document.createElement("div");
    gridCard.className = "card";
    gridCard.innerHTML = `
    <div class="card-body" style="display:grid;gap:10px">
      <div class="row wrap" style="gap:10px">
        <span class="badge">🟣 Tasks due</span>
        <span class="badge">🟢 Habit check-ins</span>
        <span class="badge">🔵 Learning minutes</span>
      </div>

      <div id="calGrid" style="
        display:grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap:10px;
      "></div>
    </div>
  `;
    root.appendChild(gridCard);

    const monthLabel = header.querySelector("#monthLabel");
    const calGrid = gridCard.querySelector("#calGrid");

    // month state
    const today = todayISO();
    let current = new Date(today + "T00:00:00"); // local
    current.setDate(1);

    header.querySelector("#prevBtn").addEventListener("click", () => {
        current.setMonth(current.getMonth() - 1);
        repaint();
    });
    header.querySelector("#nextBtn").addEventListener("click", () => {
        current.setMonth(current.getMonth() + 1);
        repaint();
    });
    header.querySelector("#todayBtn").addEventListener("click", () => {
        current = new Date(today + "T00:00:00");
        current.setDate(1);
        repaint();
    });

    repaint();
    return root;

    function repaint() {
        const s = getState();
        const ym = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
        monthLabel.textContent = formatMonthLabel(current);

        const counts = buildDayCounts(s); // { [YYYY-MM-DD]: {tasksDue, habitCheckins, learnMin} }

        calGrid.innerHTML = "";
        renderWeekdayHeader();

        const { start, end } = monthGridRange(current);
        const days = eachDayISO(start, end);

        days.forEach((iso) => {
            const cell = document.createElement("button");
            cell.type = "button";
            cell.className = "btn btn-ghost";
            cell.style.cssText = `
        text-align:left;
        padding: 10px 10px 8px;
        border: 1px solid var(--border);
        border-radius: 16px;
        background: var(--panel-2);
        min-height: 92px;
        display:grid;
        gap:8px;
      `;

            const isThisMonth = iso.startsWith(ym);
            const isToday = iso === today;

            const top = document.createElement("div");
            top.className = "row space-between";
            top.style.alignItems = "center";

            const dayNum = document.createElement("div");
            dayNum.style.fontWeight = "900";
            dayNum.style.opacity = isThisMonth ? "1" : "0.45";
            dayNum.textContent = String(Number(iso.slice(8, 10)));

            const todayBadge = document.createElement("span");
            todayBadge.className = "badge";
            todayBadge.style.display = isToday ? "inline-flex" : "none";
            todayBadge.textContent = "Today";

            top.appendChild(dayNum);
            top.appendChild(todayBadge);

            const dots = document.createElement("div");
            dots.className = "row wrap";
            dots.style.gap = "6px";

            const c = counts[iso] || { tasksDue: 0, habitCheckins: 0, learnMin: 0, taskTitles: [] };

            // ✅ highlight days with any events
            const hasEvents =
                (c.tasksDue || 0) > 0 ||
                (c.habitCheckins || 0) > 0 ||
                (c.learnMin || 0) > 0;

            if (hasEvents) {
                cell.style.border = "1px solid color-mix(in oklab, var(--accent) 55%, var(--border))";
            }

            if (c.tasksDue > 0) dots.appendChild(pill(`🟣 ${c.tasksDue}`, "Tasks due"));
            if (c.habitCheckins > 0) dots.appendChild(pill(`🟢 ${c.habitCheckins}`, "Habit check-ins"));
            if (c.learnMin > 0) dots.appendChild(pill(`🔵 ${c.learnMin}m`, "Learning minutes"));

            if (!dots.childNodes.length) {
                const none = document.createElement("div");
                none.style.color = "var(--muted)";
                none.style.fontSize = "12px";
                none.textContent = "—";
                dots.appendChild(none);
            }

            cell.appendChild(top);
            cell.appendChild(dots);

            // ✅ Task preview lines (up to 2)
            if (c.taskTitles && c.taskTitles.length) {
                const preview = document.createElement("div");
                preview.style.cssText = "display:grid;gap:4px;margin-top:2px;";
                c.taskTitles.slice(0, 2).forEach((title) => {
                    const line = document.createElement("div");
                    line.style.cssText =
                        "font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
                    line.textContent = `• ${title}`;
                    preview.appendChild(line);
                });
                cell.appendChild(preview);
            }

            cell.addEventListener("click", () => {
                location.hash = `#/day?date=${encodeURIComponent(iso)}`;
            });

            // dim non-month cells
            if (!isThisMonth) cell.style.opacity = "0.55";

            calGrid.appendChild(cell);
        });
    }

    function renderWeekdayHeader() {
        const labels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
        labels.forEach((x) => {
            const el = document.createElement("div");
            el.style.cssText = `color: var(--muted); font-size: 12px; font-weight: 800; padding: 2px 6px;`;
            el.textContent = x;
            calGrid.appendChild(el);
        });
    }
}

/* ------------ helpers ------------ */

function pill(text, title) {
    const s = document.createElement("span");
    s.className = "badge";
    s.title = title || "";
    s.textContent = text;
    return s;
}

// Monday-first grid range for a month
function monthGridRange(monthDate) {
    const start = new Date(monthDate);
    start.setDate(1);

    const end = new Date(monthDate);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0); // last day of month

    // convert JS day (0=Sun) to Mon-first index (0=Mon..6=Sun)
    const startIdx = monFirstIndex(start);
    const endIdx = monFirstIndex(end);

    const gridStart = new Date(start);
    gridStart.setDate(gridStart.getDate() - startIdx);

    const gridEnd = new Date(end);
    gridEnd.setDate(gridEnd.getDate() + (6 - endIdx));

    return { start: toISO(gridStart), end: toISO(gridEnd) };
}

function monFirstIndex(d) {
    const js = d.getDay(); // 0 Sun ... 6 Sat
    return js === 0 ? 6 : js - 1; // Mon=0 ... Sun=6
}

function eachDayISO(startISO, endISO) {
    const out = [];
    const d = new Date(startISO + "T00:00:00");
    const end = new Date(endISO + "T00:00:00");
    while (d <= end) {
        out.push(toISO(d));
        d.setDate(d.getDate() + 1);
    }
    return out;
}

function toISO(d) {
    return d.toISOString().slice(0, 10);
}

function formatMonthLabel(d) {
    const month = d.toLocaleString(undefined, { month: "long" });
    return `${month} ${d.getFullYear()}`;
}

// Build daily counts from state
function buildDayCounts(state) {
    const out = {};

    // tasks due
    (state.tasks || []).forEach((t) => {
        if (t.status === "done") return; // ✅ только активные
        const d = t.due ? String(t.due).slice(0, 10) : null;
        if (!d) return;
        out[d] = out[d] || { tasksDue: 0, habitCheckins: 0, learnMin: 0, taskTitles: [] };
        out[d].tasksDue += 1;

        // ✅ store titles for preview
        if (out[d].taskTitles.length < 2) {
            out[d].taskTitles.push(t.title || "(Untitled)");
        }
    });

    // habit checkins
    (state.habits || []).forEach((h) => {
        (h.checkins || []).forEach((day) => {
            const d = String(day).slice(0, 10);
            if (!d) return;
            out[d] = out[d] || { tasksDue: 0, habitCheckins: 0, learnMin: 0, taskTitles: [] };
            out[d].habitCheckins += 1;
        });
    });

    // learning minutes
    (state.timeLogs || []).forEach((x) => {
        if (x.type !== "learning") return;
        const d = String(x.date || "").slice(0, 10);
        if (!d) return;
        out[d] = out[d] || { tasksDue: 0, habitCheckins: 0, learnMin: 0, taskTitles: [] };
        out[d].learnMin += Number(x.minutes || 0);
    });

    return out;
}
