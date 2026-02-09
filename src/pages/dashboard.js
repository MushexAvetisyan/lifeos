// src/pages/dashboard.js
import { getState, setState } from "../store.js";
import { Widget } from "../components/Widget.js";
import { uid, todayISO, formatDate } from "../utils.js";
import { toast } from "../components/Toast.js";

export function pageTitle() {
  return "Dashboard";
}

export function render() {
  const root = document.createElement("div");
  root.className = "grid cols-2";

  // Initial paint
  paint();
  return root;

function paint() {
  const s = getState();
  const today = todayISO();

  const activeTasks = (s.tasks || []).filter((t) => t.status !== "done");
  const todayTasks = activeTasks.filter((t) => t.due && String(t.due).slice(0, 10) === today);

  // Top priorities (smart-ish): priority first, then due (soon), then updated
  const topPriorities = activeTasks
    .slice()
    .sort((a, b) => {
      const ap = Number(a.priority ?? 2);
      const bp = Number(b.priority ?? 2);
      if (ap !== bp) return ap - bp; // 1 is highest
      const ad = a.due ? String(a.due).slice(0, 10) : "9999-12-31";
      const bd = b.due ? String(b.due).slice(0, 10) : "9999-12-31";
      if (ad !== bd) return ad.localeCompare(bd);
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    })
    .slice(0, 3);

  // Habits summary
  const habits = s.habits || [];
  const checkedHabits = habits.filter((h) => (h.checkins || []).includes(today)).length;
  const totalHabits = habits.length;

  root.innerHTML = "";

  root.appendChild(
    Widget({
      title: "Top priorities",
      subtitle: `Today: ${today}`,
      actions: [{ label: "Open tasks", onClick: () => (location.hash = "#/tasks") }],
      body: topPriorities.length
        ? taskMiniList(topPriorities, { showDue: true, allowDone: true })
        : empty("No active tasks. Add one below."),
    })
  );

  root.appendChild(
    Widget({
      title: "Today tasks",
      subtitle: `${todayTasks.length} due today`,
      actions: [{ label: "Add due today", onClick: () => quickAdd({ dueToday: true }) }],
      body: todayTasks.length
        ? taskMiniList(todayTasks, { showDue: false, allowDone: true })
        : empty("Nothing due today. Nice."),
    })
  );

  root.appendChild(
    Widget({
      title: "Habits",
      subtitle: totalHabits ? `${checkedHabits}/${totalHabits} checked today` : "No habits yet",
      actions: [{ label: "Open habits", onClick: () => (location.hash = "#/habits") }],
      body: totalHabits ? habitMiniList(habits, today) : empty("Create your first habit in the Habits page."),
    })
  );

  root.appendChild(
    Widget({
      title: "Quick add",
      subtitle: "Create a task fast",
      actions: [],
      body: quickAddForm(),
    })
  );

  root.appendChild(
    Widget({
      title: "Quick note",
      subtitle: "Saved locally",
      actions: [{ label: "Clear", onClick: clearQuickNote }],
      body: quickNoteEditor(s.dashboard?.quickNote ?? ""),
    })
  );
}

  // ---------- widgets ----------
  function taskMiniList(tasks, { showDue, allowDone }) {
    const wrap = document.createElement("div");
    wrap.className = "grid";
    wrap.style.gap = "10px";

    tasks.forEach((t) => {
      const row = document.createElement("div");
      row.className = "row";
      row.style.alignItems = "flex-start";
      row.style.gap = "10px";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = t.status === "done";
      cb.disabled = !allowDone;

      cb.addEventListener("change", () => {
        patchTask(t.id, { status: cb.checked ? "done" : "todo" });
        toast(cb.checked ? "Marked done." : "Marked todo.");
        paint();
      });

      const info = document.createElement("div");
      info.style.display = "grid";
      info.style.gap = "4px";
      info.style.flex = "1";

      const title = document.createElement("div");
      title.style.fontWeight = "800";
      title.style.lineHeight = "1.2";
      title.textContent = t.title || "(Untitled)";

      const meta = document.createElement("div");
      meta.style.color = "var(--muted)";
      meta.style.fontSize = "12px";
      meta.textContent = [
        `Priority ${Number(t.priority ?? 2)}`,
        showDue ? (t.due ? `Due ${formatDate(t.due)}` : "No due") : null,
        (t.tags || []).length ? `#${(t.tags || [])[0]}` : null,
      ]
        .filter(Boolean)
        .join(" • ");

      info.appendChild(title);
      if (meta.textContent) info.appendChild(meta);

      const openBtn = document.createElement("button");
      openBtn.className = "btn btn-ghost";
      openBtn.type = "button";
      openBtn.textContent = "Open";
      openBtn.addEventListener("click", () => (location.hash = "#/tasks"));

      row.appendChild(cb);
      row.appendChild(info);
      row.appendChild(openBtn);

      wrap.appendChild(row);
    });

    return wrap;
  }

  function habitMiniList(habits, today) {
  const wrap = document.createElement("div");
  wrap.className = "grid";
  wrap.style.gap = "10px";

  // show up to 4 habits
  habits.slice(0, 4).forEach((h) => {
    const row = document.createElement("div");
    row.className = "row space-between wrap";

    const left = document.createElement("div");
    left.style.fontWeight = "800";
    left.textContent = h.name || "(Habit)";

    const right = document.createElement("span");
    right.className = "badge";
    right.textContent = (h.checkins || []).includes(today) ? "done" : "todo";

    row.appendChild(left);
    row.appendChild(right);

    row.addEventListener("click", () => (location.hash = "#/habits"));
    row.style.cursor = "pointer";

    wrap.appendChild(row);
  });

  return wrap;
}

  function quickAddForm() {
    const wrap = document.createElement("div");
    wrap.className = "grid";
    wrap.style.gap = "10px";

    wrap.innerHTML = `
      <div class="row wrap" style="gap:10px;align-items:flex-end">
        <label style="flex:1;min-width:220px">
          <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Task title</div>
          <input class="input" id="qaTitle" placeholder="e.g., Study JS 30 minutes" />
        </label>

        <label style="min-width:180px">
          <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Due</div>
          <input class="input" id="qaDue" type="date" />
        </label>

        <label style="min-width:160px">
          <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Priority</div>
          <select class="select" id="qaPr">
            <option value="1">1 (High)</option>
            <option value="2" selected>2</option>
            <option value="3">3</option>
            <option value="4">4 (Low)</option>
          </select>
        </label>

        <button class="btn btn-primary" id="qaAdd" type="button">Add</button>
      </div>

      <div class="row wrap" style="gap:10px">
        <label style="flex:1;min-width:220px">
          <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Tags</div>
          <input class="input" id="qaTags" placeholder="comma separated: work, learning" />
        </label>

        <button class="btn" id="qaDueToday" type="button">Due today</button>
        <button class="btn btn-ghost" id="qaOpenTasks" type="button">Go to Tasks</button>
      </div>
    `;

    const titleEl = wrap.querySelector("#qaTitle");
    const dueEl = wrap.querySelector("#qaDue");
    const prEl = wrap.querySelector("#qaPr");
    const tagsEl = wrap.querySelector("#qaTags");

    wrap.querySelector("#qaDueToday").addEventListener("click", () => {
      dueEl.value = todayISO();
      titleEl.focus();
    });

    wrap.querySelector("#qaOpenTasks").addEventListener("click", () => {
      location.hash = "#/tasks";
    });

    wrap.querySelector("#qaAdd").addEventListener("click", () => {
      const title = titleEl.value.trim();
      if (!title) return toast("Type a task title first.");

      const due = dueEl.value ? dueEl.value : null;
      const priority = Number(prEl.value);
      const tags = parseTags(tagsEl.value);

      createTask({ title, due, priority, tags });

      // reset inputs (keep due handy)
      titleEl.value = "";
      tagsEl.value = "";
      titleEl.focus();

      toast("Task added.");
      paint();
    });

    // Enter to add
    titleEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        wrap.querySelector("#qaAdd").click();
      }
    });

    return wrap;
  }

  function quickNoteEditor(initialValue) {
    const wrap = document.createElement("div");
    wrap.className = "grid";
    wrap.style.gap = "10px";

    const ta = document.createElement("textarea");
    ta.className = "textarea";
    ta.placeholder = "Write anything… it autosaves.";
    ta.value = initialValue;

    // autosave (light debounce)
    let t = null;
    ta.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        setState((st) => {
          st.dashboard = st.dashboard || { quickNote: "" };
          st.dashboard.quickNote = ta.value;
          return st;
        });
      }, 250);
    });

    const hint = document.createElement("div");
    hint.style.color = "var(--muted)";
    hint.style.fontSize = "12px";
    hint.textContent = "Autosaves locally.";

    wrap.appendChild(ta);
    wrap.appendChild(hint);
    return wrap;
  }

  function clearQuickNote() {
    setState((st) => {
      st.dashboard = st.dashboard || { quickNote: "" };
      st.dashboard.quickNote = "";
      return st;
    });
    toast("Quick note cleared.");
    paint();
  }

  // ---------- actions ----------
  function quickAdd({ dueToday }) {
    // simple helper: create a placeholder task due today
    createTask({
      title: "New task",
      due: dueToday ? todayISO() : null,
      priority: 2,
      tags: [],
    });
    toast("Added a task. Edit it in Tasks.");
    paint();
  }

  function createTask({ title, due, priority, tags }) {
    const now = new Date().toISOString();
    setState((st) => {
      st.tasks.unshift({
        id: uid(),
        title,
        description: "",
        due,
        priority,
        tags,
        status: "todo",
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
      return st;
    });
  }

  function patchTask(id, patch) {
    setState((st) => {
      const now = new Date().toISOString();
      st.tasks = st.tasks.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...patch, updatedAt: now };
        if (patch.status) {
          if (patch.status === "done") next.completedAt = next.completedAt || now;
          else next.completedAt = null;
        }
        return next;
      });
      return st;
    });
  }
}

// ---------- helpers ----------
function parseTags(str) {
  return String(str || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^#/, ""))
    .slice(0, 12);
}

function empty(text) {
  const d = document.createElement("div");
  d.style.color = "var(--muted)";
  d.style.fontSize = "13px";
  d.textContent = text;
  return d;
}
