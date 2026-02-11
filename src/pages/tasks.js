// src/pages/tasks.js
import { getState, setState } from "../store.js";
import { uid, todayISO, formatDate } from "../utils.js";
import { openModal } from "../components/modal.js";
import { toast } from "../components/toast.js";

export function pageTitle() { return "Tasks"; }

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
          <div style="font-weight:900;font-size:16px">Tasks</div>
          <div style="color:var(--muted);font-size:12px">Fast CRUD + filters + tags • stored locally</div>
        </div>
        <div class="row wrap">
          <button class="btn btn-primary" id="addTaskBtn" type="button">Add task</button>
        </div>
      </div>

      <div class="row wrap" style="margin-top:12px">
        <input class="input" id="searchInput" placeholder="Search tasks (title/description/tags)..." />
        <select class="select" id="viewSelect" style="max-width:220px">
          <option value="inbox">Inbox</option>
          <option value="today">Today</option>
          <option value="upcoming">Upcoming</option>
          <option value="completed">Completed</option>
        </select>
        <select class="select" id="statusSelect" style="max-width:220px">
          <option value="all">All statuses</option>
          <option value="todo">To do</option>
          <option value="doing">Doing</option>
          <option value="done">Done</option>
        </select>
        <input class="input" id="tagFilterInput" placeholder="Filter by tag (optional)" style="max-width:240px" />
        <select class="select" id="sortSelect" style="max-width:220px">
          <option value="smart">Sort: Smart</option>
          <option value="dueAsc">Due date (earliest)</option>
          <option value="priorityDesc">Priority (high→low)</option>
          <option value="updatedDesc">Recently updated</option>
          <option value="createdDesc">Recently created</option>
        </select>
      </div>
    </div>
  `;
  root.appendChild(header);

  const listCard = document.createElement("div");
  listCard.className = "card";
  listCard.innerHTML = `
    <div class="card-body">
      <div class="row space-between wrap">
        <div class="row wrap" style="gap:8px">
          <span class="badge" id="countBadge">0 tasks</span>
          <span class="badge" id="doneBadge">0 done</span>
        </div>
        <div class="row wrap">
          <button class="btn btn-ghost" id="markAllDoneBtn" type="button">Mark visible done</button>
          <button class="btn btn-ghost" id="clearDoneBtn" type="button">Clear completed</button>
        </div>
      </div>
      <hr />
      <div id="listRoot" class="grid" style="gap:10px"></div>
      <div id="emptyState" style="display:none;color:var(--muted);font-size:13px;margin-top:8px"></div>
    </div>
  `;
  root.appendChild(listCard);

  // Wire up
  const addBtn = header.querySelector("#addTaskBtn");
  const searchInput = header.querySelector("#searchInput");
  const viewSelect = header.querySelector("#viewSelect");
  const statusSelect = header.querySelector("#statusSelect");
  const tagFilterInput = header.querySelector("#tagFilterInput");
  const sortSelect = header.querySelector("#sortSelect");

  const listRoot = listCard.querySelector("#listRoot");
  const emptyState = listCard.querySelector("#emptyState");
  const countBadge = listCard.querySelector("#countBadge");
  const doneBadge = listCard.querySelector("#doneBadge");
  const markAllDoneBtn = listCard.querySelector("#markAllDoneBtn");
  const clearDoneBtn = listCard.querySelector("#clearDoneBtn");

  const ui = {
    q: "",
    view: "inbox",
    status: "all",
    tag: "",
    sort: "smart",
  };

  // Restore simple UI state (optional, nice)
  try {
    const saved = JSON.parse(localStorage.getItem("life_os_tasks_ui") || "null");
    if (saved && typeof saved === "object") Object.assign(ui, saved);
  } catch {}

  searchInput.value = ui.q;
  viewSelect.value = ui.view;
  statusSelect.value = ui.status;
  tagFilterInput.value = ui.tag;
  sortSelect.value = ui.sort;

  function persistUI() {
    localStorage.setItem("life_os_tasks_ui", JSON.stringify(ui));
  }

  addBtn.addEventListener("click", () => openTaskModal({ mode: "create" }));

  searchInput.addEventListener("input", () => {
    ui.q = searchInput.value.trim();
    persistUI();
    repaint();
  });

  viewSelect.addEventListener("change", () => {
    ui.view = viewSelect.value;
    persistUI();
    repaint();
  });

  statusSelect.addEventListener("change", () => {
    ui.status = statusSelect.value;
    persistUI();
    repaint();
  });

  tagFilterInput.addEventListener("input", () => {
    ui.tag = tagFilterInput.value.trim();
    persistUI();
    repaint();
  });

  sortSelect.addEventListener("change", () => {
    ui.sort = sortSelect.value;
    persistUI();
    repaint();
  });

  markAllDoneBtn.addEventListener("click", () => {
    const visible = getVisibleTasks();
    if (!visible.length) return toast("No visible tasks to mark done.");
    setState((st) => {
      const now = new Date().toISOString();
      const ids = new Set(visible.map((t) => t.id));
      st.tasks = st.tasks.map((t) => {
        if (!ids.has(t.id)) return t;
        if (t.status === "done") return t;
        return { ...t, status: "done", completedAt: now, updatedAt: now };
      });
      return st;
    });
    toast("Marked visible tasks as done.");
    repaint();
  });

  clearDoneBtn.addEventListener("click", () => {
    const s = getState();
    const doneCount = s.tasks.filter((t) => t.status === "done").length;
    if (!doneCount) return toast("No completed tasks to clear.");

    openModal({
      title: "Clear completed tasks?",
      content: `<div style="color:var(--muted);font-size:13px">
        This will permanently remove <strong>${doneCount}</strong> completed task(s).
      </div>`,
      actions: [
        { label: "Cancel", className: "btn", onClick: (close) => close() },
        {
          label: "Clear",
          className: "btn btn-danger",
          onClick: (close) => {
            setState((st) => {
              st.tasks = st.tasks.filter((t) => t.status !== "done");
              return st;
            });
            close();
            toast("Cleared completed tasks.");
            repaint();
          },
        },
      ],
    });
  });

  // Initial paint
  repaint();

  return root;

  // ---------- rendering ----------
  function repaint() {
    const s = getState();
    const all = s.tasks || [];

    const visible = getVisibleTasks(all);
    const done = all.filter((t) => t.status === "done").length;

    countBadge.textContent = `${visible.length} task${visible.length === 1 ? "" : "s"} shown`;
    doneBadge.textContent = `${done} done`;

    listRoot.innerHTML = "";
    if (!visible.length) {
      emptyState.style.display = "block";
      emptyState.textContent = emptyMessage();
      return;
    }
    emptyState.style.display = "none";

    visible.forEach((task) => listRoot.appendChild(taskRow(task)));
  }

  function taskRow(task) {
    const row = document.createElement("div");
    row.className = "card";
    row.style.boxShadow = "none";

    const dueText = task.due ? formatDate(task.due) : "No due date";
    const pr = priorityLabel(task.priority);
    const tags = (task.tags || []).slice(0, 6);

    row.innerHTML = `
      <div class="card-body" style="display:grid;gap:10px">
        <div class="row space-between wrap" style="align-items:flex-start">
          <div class="row wrap" style="gap:10px;align-items:flex-start">
            <input type="checkbox" ${task.status === "done" ? "checked" : ""} aria-label="Toggle done" />
            <div style="display:grid;gap:6px;min-width:240px">
              <div style="font-weight:800;line-height:1.2;${task.status === "done" ? "text-decoration:line-through;opacity:0.75" : ""}">
                ${escapeHTML(task.title || "(Untitled task)")}
              </div>
              ${task.description ? `<div style="color:var(--muted);font-size:13px">${escapeHTML(task.description)}</div>` : ""}
              <div class="row wrap" style="gap:8px">
                <span class="badge">${escapeHTML(task.status)}</span>
                <span class="badge">${escapeHTML(pr)}</span>
                <span class="badge">${escapeHTML(dueText)}</span>
                ${tags.map((t) => `<span class="badge">#${escapeHTML(t)}</span>`).join("")}
              </div>
            </div>
          </div>

          <div class="row wrap">
            <button class="btn btn-ghost" data-act="edit" type="button">Edit</button>
            <button class="btn btn-ghost" data-act="dup" type="button">Duplicate</button>
            <button class="btn btn-danger" data-act="del" type="button">Delete</button>
          </div>
        </div>

        <div class="row wrap" style="gap:10px">
          <label style="min-width:180px">
            <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Status</div>
            <select class="select" data-act="status">
              <option value="todo">todo</option>
              <option value="doing">doing</option>
              <option value="done">done</option>
            </select>
          </label>

          <label style="min-width:180px">
            <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Priority</div>
            <select class="select" data-act="priority">
              <option value="4">4 (Low)</option>
              <option value="3">3</option>
              <option value="2">2</option>
              <option value="1">1 (High)</option>
            </select>
          </label>

          <label style="min-width:220px">
            <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Due</div>
            <input class="input" data-act="due" type="date" />
          </label>

          <div style="flex:1"></div>
          <div style="color:var(--muted);font-size:12px">
            Updated: ${escapeHTML(formatDate(task.updatedAt || task.createdAt))}
          </div>
        </div>
      </div>
    `;

    // Init controls
    const checkbox = row.querySelector('input[type="checkbox"]');
    const statusSel = row.querySelector('select[data-act="status"]');
    const prSel = row.querySelector('select[data-act="priority"]');
    const dueInp = row.querySelector('input[data-act="due"]');

    statusSel.value = task.status || "todo";
    prSel.value = String(task.priority ?? 2);
    dueInp.value = task.due ? String(task.due).slice(0, 10) : "";

    checkbox.addEventListener("change", () => {
      const next = checkbox.checked ? "done" : "todo";
      patchTask(task.id, { status: next });
      repaint();
    });

    statusSel.addEventListener("change", () => {
      patchTask(task.id, { status: statusSel.value });
      repaint();
    });

    prSel.addEventListener("change", () => {
      patchTask(task.id, { priority: Number(prSel.value) });
      repaint();
    });

    dueInp.addEventListener("change", () => {
      patchTask(task.id, { due: dueInp.value || null });
      repaint();
    });

    // Actions
    row.querySelector('[data-act="edit"]').addEventListener("click", () => {
      openTaskModal({ mode: "edit", taskId: task.id });
    });

    row.querySelector('[data-act="dup"]').addEventListener("click", () => {
      duplicateTask(task.id);
      toast("Task duplicated.");
      repaint();
    });

    row.querySelector('[data-act="del"]').addEventListener("click", () => {
      confirmDelete(task.id);
    });

    return row;
  }

  function emptyMessage() {
    if (ui.view === "today") return "No tasks due today.";
    if (ui.view === "upcoming") return "No upcoming tasks.";
    if (ui.view === "completed") return "No completed tasks match your filters.";
    return "No tasks yet. Click “Add task” to create your first one.";
  }

  // ---------- data helpers ----------
  function getVisibleTasks(source) {
    const s = source ? { tasks: source } : getState();
    const all = (s.tasks || []).slice();

    const q = ui.q.toLowerCase();
    const tag = ui.tag.trim().toLowerCase();
    const view = ui.view;
    const statusFilter = ui.status;

    const today = todayISO();

    let filtered = all.filter((t) => {
      // view filter
      if (view === "today") {
        if (!t.due) return false;
        if (String(t.due).slice(0, 10) !== today) return false;
        if (t.status === "done") return false; // today shows active by default
      } else if (view === "upcoming") {
        if (!t.due) return false;
        const d = String(t.due).slice(0, 10);
        if (d <= today) return false;
        if (t.status === "done") return false;
      } else if (view === "completed") {
        if (t.status !== "done") return false;
      } else {
        // inbox: no view restriction
      }

      // status filter (optional)
      if (statusFilter !== "all" && t.status !== statusFilter) return false;

      // tag filter
      if (tag) {
        const tags = (t.tags || []).map((x) => String(x).toLowerCase());
        if (!tags.includes(tag)) return false;
      }

      // search
      if (q) {
        const hay = [
          t.title || "",
          t.description || "",
          ...(t.tags || []),
          t.status || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });

    filtered = sortTasks(filtered, ui.sort);
    return filtered;
  }

  function sortTasks(list, mode) {
    const arr = list.slice();
    const byStrDesc = (a, b, k) => (String(b[k] || "")).localeCompare(String(a[k] || ""));
    const byNumDesc = (a, b, k) => (Number(b[k] || 0) - Number(a[k] || 0));

    if (mode === "dueAsc") {
      arr.sort((a, b) => {
        const ad = a.due ? String(a.due).slice(0, 10) : "9999-12-31";
        const bd = b.due ? String(b.due).slice(0, 10) : "9999-12-31";
        return ad.localeCompare(bd);
      });
      return arr;
    }

    if (mode === "priorityDesc") {
      // priority: 1 high, 4 low
      arr.sort((a, b) => (Number(a.priority ?? 2) - Number(b.priority ?? 2)));
      return arr;
    }

    if (mode === "updatedDesc") {
      arr.sort((a, b) => byStrDesc(a, b, "updatedAt"));
      return arr;
    }

    if (mode === "createdDesc") {
      arr.sort((a, b) => byStrDesc(a, b, "createdAt"));
      return arr;
    }

    // smart:
    // 1) not done first
    // 2) due soon first (missing due goes last)
    // 3) priority high first (1 first)
    // 4) recently updated
    arr.sort((a, b) => {
      const adone = a.status === "done" ? 1 : 0;
      const bdone = b.status === "done" ? 1 : 0;
      if (adone !== bdone) return adone - bdone;

      const ad = a.due ? String(a.due).slice(0, 10) : "9999-12-31";
      const bd = b.due ? String(b.due).slice(0, 10) : "9999-12-31";
      if (ad !== bd) return ad.localeCompare(bd);

      const ap = Number(a.priority ?? 2);
      const bp = Number(b.priority ?? 2);
      if (ap !== bp) return ap - bp;

      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });
    return arr;
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

  function duplicateTask(id) {
    setState((st) => {
      const t = st.tasks.find((x) => x.id === id);
      if (!t) return st;
      const now = new Date().toISOString();
      st.tasks.unshift({
        ...structuredClone(t),
        id: uid(),
        title: `${t.title} (copy)`,
        status: "todo",
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      return st;
    });
  }

  function confirmDelete(id) {
    const t = getState().tasks.find((x) => x.id === id);
    if (!t) return;
    openModal({
      title: "Delete task?",
      content: `<div style="color:var(--muted);font-size:13px">
        This will permanently delete: <strong>${escapeHTML(t.title || "Untitled")}</strong>
      </div>`,
      actions: [
        { label: "Cancel", className: "btn", onClick: (close) => close() },
        {
          label: "Delete",
          className: "btn btn-danger",
          onClick: (close) => {
            setState((st) => {
              st.tasks = st.tasks.filter((x) => x.id !== id);
              return st;
            });
            close();
            toast("Task deleted.");
            repaint();
          },
        },
      ],
    });
  }

  // ---------- modal forms ----------
  function openTaskModal({ mode, taskId }) {
    const isEdit = mode === "edit";
    const s = getState();
    const existing = isEdit ? s.tasks.find((t) => t.id === taskId) : null;

    const form = document.createElement("form");
    form.className = "grid";
    form.style.gap = "12px";
    form.innerHTML = `
      <div class="grid cols-2">
        <label>
          <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Title</div>
          <input class="input" name="title" placeholder="e.g., Finish Life OS tasks module" required />
        </label>
        <label>
          <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Due</div>
          <input class="input" name="due" type="date" />
        </label>
      </div>

      <label>
        <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Description</div>
        <textarea class="textarea" name="description" placeholder="Optional details..."></textarea>
      </label>

      <div class="grid cols-3">
        <label>
          <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Status</div>
          <select class="select" name="status">
            <option value="todo">todo</option>
            <option value="doing">doing</option>
            <option value="done">done</option>
          </select>
        </label>

        <label>
          <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Priority</div>
          <select class="select" name="priority">
            <option value="1">1 (High)</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4 (Low)</option>
          </select>
        </label>

        <label>
          <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Tags</div>
          <input class="input" name="tags" placeholder="comma separated: work, health" />
        </label>
      </div>

      <div class="row wrap" style="justify-content:flex-end">
        <button class="btn" type="button" data-cancel>Cancel</button>
        <button class="btn btn-primary" type="submit">${isEdit ? "Save" : "Create"}</button>
      </div>
    `;

    // Fill defaults
    const el = (name) => form.querySelector(`[name="${name}"]`);
    el("title").value = existing?.title || "";
    el("description").value = existing?.description || "";
    el("due").value = existing?.due ? String(existing.due).slice(0, 10) : "";
    el("status").value = existing?.status || "todo";
    el("priority").value = String(existing?.priority ?? 2);
    el("tags").value = (existing?.tags || []).join(", ");

    const close = openModal({
      title: isEdit ? "Edit task" : "New task",
      content: form,
      actions: [], // actions built into form
    });

    form.querySelector("[data-cancel]").addEventListener("click", () => close?.());

    // Focus title
    setTimeout(() => el("title").focus(), 0);

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const now = new Date().toISOString();
      const title = el("title").value.trim();
      const description = el("description").value.trim();
      const due = el("due").value ? el("due").value : null;
      const status = el("status").value;
      const priority = Number(el("priority").value);
      const tags = parseTags(el("tags").value);

      if (!title) return toast("Title is required.");

      if (isEdit) {
        setState((st) => {
          st.tasks = st.tasks.map((t) => {
            if (t.id !== existing.id) return t;
            const updated = {
              ...t,
              title,
              description,
              due,
              status,
              priority,
              tags,
              updatedAt: now,
            };
            if (status === "done") updated.completedAt = updated.completedAt || now;
            else updated.completedAt = null;
            return updated;
          });
          return st;
        });
        toast("Task saved.");
      } else {
        setState((st) => {
          st.tasks.unshift({
            id: uid(),
            title,
            description,
            due,
            priority,
            tags,
            status,
            createdAt: now,
            updatedAt: now,
            completedAt: status === "done" ? now : null,
          });
          return st;
        });
        toast("Task created.");
      }

      close?.();
      repaint();
    });
  }
}

// ---------- small helpers ----------
function parseTags(str) {
  return String(str || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^#/, "")) // allow user to type "#work"
    .slice(0, 12);
}

function priorityLabel(p) {
  const n = Number(p ?? 2);
  if (n === 1) return "Priority: High";
  if (n === 2) return "Priority: Med";
  if (n === 3) return "Priority: Low";
  return "Priority: Lowest";
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]
  ));
}
