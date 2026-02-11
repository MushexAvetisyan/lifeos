// src/pages/day.js
import {getState, setState} from "../store.js";
import {uid, todayISO, formatDate, clamp} from "../utils.js";
import {toast} from "../components/toast.js";

export function pageTitle() {
    const d = getDateFromHash() || todayISO();
    return `Day • ${d}`;
}

export function render() {
    const root = document.createElement("div");
    root.className = "grid";
    root.style.gap = "12px";

    const header = document.createElement("div");
    header.className = "card";
    header.innerHTML = `
    <div class="card-body row space-between wrap" style="align-items:flex-start">
      <div style="display:grid;gap:6px">
        <div style="font-weight:900;font-size:16px">Day view</div>
        <div style="color:var(--muted);font-size:12px">Date: <strong id="dateLabel"></strong></div>
      </div>
      <div class="row wrap">
        <button class="btn" id="prevBtn" type="button">← Prev</button>
        <button class="btn" id="nextBtn" type="button">Next →</button>
        <button class="btn btn-ghost" id="calBtn" type="button">Calendar</button>
      </div>
    </div>
  `;
    root.appendChild(header);

    header.querySelector("#calBtn").addEventListener("click", () => (location.hash = "#/calendar"));
    const prevBtn = header.querySelector("#prevBtn");
    const nextBtn = header.querySelector("#nextBtn");

    prevBtn.onclick = () => navDay(getDateFromHash() || todayISO(), -1);
    nextBtn.onclick = () => navDay(getDateFromHash() || todayISO(), +1);


    const grid = document.createElement("div");
    grid.className = "grid cols-2";
    grid.style.gap = "12px";
    root.appendChild(grid);

    const tasksCard = makeCard("Tasks due", "Tasks with due date = this day");
    const habitsCard = makeCard("Habits", "Check/Uncheck for this day");
    const learningCard = makeCard("Learning", "Minutes logged for this day");

    grid.appendChild(tasksCard.card);   // ✅
    grid.appendChild(habitsCard.card);  // ✅
    grid.appendChild(learningCard.card);// ✅

    paint();
    return root;


    function paint() {
        const dateISO = getDateFromHash() || todayISO();
        const s = getState();
        header.querySelector("#dateLabel").textContent = dateISO;

        // Tasks
        const dueTasks = (s.tasks || []).filter((t) => {
            if (t.status === "done") return false;
            return normalizeDay(t.due) === dateISO;
        });

        fillTasks(tasksCard.body, dueTasks);

        // Habits
        fillHabits(habitsCard.body, s.habits || []);

        // Learning minutes
        const minutes = minutesForDay(s, dateISO);
        fillLearning(learningCard.body, minutes);
    }


    function normalizeDay(v) {
        const s = String(v || "");
        return s.length >= 10 ? s.slice(0, 10) : s;
    }


    function fillTasks(body, tasks) {
        const dateISO = getDateFromHash() || todayISO();
        body.innerHTML = "";
        // ✅ Quick add task for this day
        const addWrap = document.createElement("div");
        addWrap.className = "row wrap";
        addWrap.style.gap = "10px";
        addWrap.style.alignItems = "flex-end";

        addWrap.innerHTML = `
  <label style="flex:1;min-width:220px">
    <div style="color:var(--muted);font-size:12px;margin-bottom:6px">
  New task for <strong>${escapeHTML(dateISO)}</strong>
</div>
    <input class="input" id="dayTaskTitle" placeholder="e.g., Call, study, workout..." />
  </label>

  <label style="min-width:150px">
    <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Priority</div>
    <select class="select" id="dayTaskPr">
      <option value="1">1</option>
      <option value="2" selected>2</option>
      <option value="3">3</option>
      <option value="4">4</option>
    </select>
  </label>

  <button class="btn btn-primary" id="dayTaskAddBtn" type="button">Add</button>
`;
        body.appendChild(addWrap);

        const titleEl = addWrap.querySelector("#dayTaskTitle");
        const prEl = addWrap.querySelector("#dayTaskPr");

        addWrap.querySelector("#dayTaskAddBtn").addEventListener("click", () => {
            const title = titleEl.value.trim();
            if (!title) return toast("Type a task title first.");
            createTaskForDay({title, due: dateISO, priority: Number(prEl.value)});
            titleEl.value = "";
            titleEl.focus();
            toast("Task added.");
            paint();
        });

        titleEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                addWrap.querySelector("#dayTaskAddBtn").click();
            }
        });

        if (!tasks.length) {
            body.appendChild(muted("No tasks due this day."));
            return;
        }

        tasks.forEach((t) => {
            const row = document.createElement("div");
            row.className = "row space-between wrap";
            row.style.gap = "10px";
            row.style.alignItems = "flex-start";

            const left = document.createElement("div");
            left.style.display = "grid";
            left.style.gap = "4px";

            const title = document.createElement("div");
            title.style.fontWeight = "900";
            title.textContent = t.title || "(Untitled)";

            const meta = document.createElement("div");
            meta.style.color = "var(--muted)";
            meta.style.fontSize = "12px";
            meta.textContent = `Priority ${Number(t.priority ?? 2)} • ${t.status}`;

            left.appendChild(title);
            left.appendChild(meta);

            const btn = document.createElement("button");
            btn.className = "btn btn-ghost";
            btn.type = "button";
            btn.textContent = t.status === "done" ? "Undo" : "Done";
            btn.addEventListener("click", () => {
                patchTask(t.id, {status: t.status === "done" ? "todo" : "done"});
                toast(t.status === "done" ? "Marked todo." : "Marked done.");
                paint();
            });

            row.appendChild(left);
            row.appendChild(btn);
            body.appendChild(row);
        });
    }

    function fillHabits(body, habits) {
        body.innerHTML = "";

        if (!habits.length) {
            body.appendChild(muted("No habits yet."));
            return;
        }

        habits.forEach((h) => {
            const checked = (h.checkins || []).includes(dateISO);

            const row = document.createElement("div");
            row.className = "row space-between wrap";
            row.style.gap = "10px";
            row.style.alignItems = "center";

            const left = document.createElement("div");
            left.style.fontWeight = "900";
            left.textContent = h.name || "(Habit)";

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = checked;

            cb.addEventListener("change", () => {
                toggleHabitCheckin(h.id, dateISO, cb.checked);
                toast(cb.checked ? "Checked." : "Unchecked.");
                paint();
            });

            row.appendChild(left);
            row.appendChild(cb);
            body.appendChild(row);
        });
    }

    function fillLearning(body, minutes) {
        body.innerHTML = "";

        const top = document.createElement("div");
        top.className = "row space-between wrap";
        top.style.alignItems = "center";

        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = `${minutes} min`;

        const btns = document.createElement("div");
        btns.className = "row wrap";
        btns.style.gap = "8px";
        btns.innerHTML = `
      <button class="btn btn-ghost" type="button" data-add="10">+10</button>
      <button class="btn btn-ghost" type="button" data-add="25">+25</button>
      <button class="btn btn-ghost" type="button" data-add="60">+60</button>
      <button class="btn btn-danger" type="button" id="clearBtn">Clear day</button>
    `;

        top.appendChild(badge);
        top.appendChild(btns);
        body.appendChild(top);

        btns.querySelectorAll("[data-add]").forEach((b) => {
            b.addEventListener("click", () => {
                addLearningMinutes(Number(b.dataset.add), dateISO);
                paint();
            });
        });

        btns.querySelector("#clearBtn").addEventListener("click", () => {
            if (!confirm("Clear learning logs for this day?")) return;
            setState((st) => {
                st.timeLogs = (st.timeLogs || []).filter((x) => !(x.type === "learning" && String(x.date).slice(0, 10) === dateISO));
                return st;
            });
            toast("Learning logs cleared.");
            paint();
        });

        // show logs list
        const s = getState();
        const logs = (s.timeLogs || []).filter((x) => x.type === "learning" && String(x.date).slice(0, 10) === dateISO);

        if (!logs.length) {
            body.appendChild(muted("No learning logs for this day."));
            return;
        }

        const list = document.createElement("div");
        list.className = "grid";
        list.style.gap = "8px";
        list.style.marginTop = "10px";

        logs.forEach((x) => {
            const r = document.createElement("div");
            r.className = "row space-between wrap";
            r.style.gap = "10px";
            r.innerHTML = `
        <div style="font-weight:900">${Number(x.minutes || 0)} min</div>
        <div style="color:var(--muted);font-size:12px">${escapeHTML(String(x.createdAt || "").slice(0, 19).replace("T", " "))}</div>
      `;
            list.appendChild(r);
        });

        body.appendChild(list);
    }

    function patchTask(id, patch) {
        setState((st) => {
            const now = new Date().toISOString();
            st.tasks = (st.tasks || []).map((t) => {
                if (t.id !== id) return t;
                const next = {...t, ...patch, updatedAt: now};
                if (patch.status) {
                    if (patch.status === "done") next.completedAt = next.completedAt || now;
                    else next.completedAt = null;
                }
                return next;
            });
            return st;
        });
    }

    function createTaskForDay({title, due, priority}) {
        const now = new Date().toISOString();
        setState((st) => {
            st.tasks = st.tasks || [];
            st.tasks.unshift({
                id: uid(),
                title,
                description: "",
                due,
                priority: Number(priority ?? 2),
                tags: [],
                status: "todo",
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
            return st;
        });
    }

    function toggleHabitCheckin(habitId, date, checked) {
        setState((st) => {
            st.habits = (st.habits || []).map((h) => {
                if (h.id !== habitId) return h;
                const list = Array.isArray(h.checkins) ? h.checkins.slice() : [];
                const has = list.includes(date);
                let next = list;
                if (checked && !has) next = [date, ...list];
                if (!checked && has) next = list.filter((d) => d !== date);
                return {...h, checkins: next};
            });
            return st;
        });
    }

    function addLearningMinutes(min, date) {
        const m = clamp(Number(min) || 0, 1, 600);
        const now = new Date().toISOString();
        setState((st) => {
            st.timeLogs = st.timeLogs || [];
            st.timeLogs.unshift({id: uid(), type: "learning", minutes: m, date, createdAt: now});
            return st;
        });
        toast(`Added ${m} min.`);
    }

    function minutesForDay(state, dateISO) {
        return (state.timeLogs || [])
            .filter((x) => x.type === "learning" && String(x.date).slice(0, 10) === dateISO)
            .reduce((sum, x) => sum + Number(x.minutes || 0), 0);
    }
}

/* helpers */

function makeCard(title, subtitle) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
    <div class="card-body" style="display:grid;gap:10px">
      <div style="display:grid;gap:4px">
        <div style="font-weight:900">${escapeHTML(title)}</div>
        <div style="color:var(--muted);font-size:12px">${escapeHTML(subtitle)}</div>
      </div>
      <hr />
      <div data-body style="display:grid;gap:10px"></div>
    </div>
  `;
    return {card, body: card.querySelector("[data-body]")};
}

function getDateFromHash() {
    const hash = String(location.hash || "");
    const i = hash.indexOf("date=");
    if (i === -1) return "";
    const raw = hash.slice(i + 5).split("&")[0];
    try {
        return decodeURIComponent(raw).slice(0, 10);
    } catch {
        return raw.slice(0, 10);
    }
}

function navDay(iso, delta) {
    const d = new Date(iso + "T12:00:00"); // ✅ midday avoids TZ edge cases
    d.setDate(d.getDate() + delta);

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const next = `${y}-${m}-${day}`;

    location.hash = `#/day?date=${encodeURIComponent(next)}`;
}

function muted(text) {
    const d = document.createElement("div");
    d.style.color = "var(--muted)";
    d.style.fontSize = "13px";
    d.textContent = text;
    return d;
}

function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
        {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"}[c]
    ));
}
