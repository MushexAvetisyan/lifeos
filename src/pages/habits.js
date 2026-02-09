// src/pages/habits.js
import { getState, setState } from "../store.js";
import { uid, todayISO } from "../utils.js";
import { openModal } from "../components/Modal.js";
import { toast } from "../components/Toast.js";

export function pageTitle() { return "Habits"; }

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
          <div style="font-weight:900;font-size:16px">Habits</div>
          <div style="color:var(--muted);font-size:12px">Daily check-ins • streaks • last 14 days</div>
        </div>
        <div class="row wrap">
          <button class="btn btn-primary" id="addHabitBtn" type="button">Add habit</button>
        </div>
      </div>

      <div class="row wrap" style="margin-top:12px">
        <input class="input" id="searchInput" placeholder="Search habits..." />
        <select class="select" id="sortSelect" style="max-width:240px">
          <option value="smart">Sort: Smart</option>
          <option value="streakDesc">Streak (high→low)</option>
          <option value="nameAsc">Name (A→Z)</option>
          <option value="createdDesc">Recently created</option>
        </select>
        <button class="btn btn-ghost" id="checkAllBtn" type="button">Check all today</button>
        <button class="btn btn-ghost" id="uncheckAllBtn" type="button">Uncheck all today</button>
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
          <span class="badge" id="countBadge">0 habits</span>
          <span class="badge" id="todayBadge">0 checked today</span>
        </div>
        <div style="color:var(--muted);font-size:12px">
          Tip: streak counts consecutive days up to today.
        </div>
      </div>
      <hr />
      <div id="listRoot" class="grid" style="gap:10px"></div>
      <div id="emptyState" style="display:none;color:var(--muted);font-size:13px;margin-top:8px"></div>
    </div>
  `;
  root.appendChild(listCard);

  const addHabitBtn = header.querySelector("#addHabitBtn");
  const searchInput = header.querySelector("#searchInput");
  const sortSelect = header.querySelector("#sortSelect");
  const checkAllBtn = header.querySelector("#checkAllBtn");
  const uncheckAllBtn = header.querySelector("#uncheckAllBtn");

  const listRoot = listCard.querySelector("#listRoot");
  const emptyState = listCard.querySelector("#emptyState");
  const countBadge = listCard.querySelector("#countBadge");
  const todayBadge = listCard.querySelector("#todayBadge");

  const ui = { q: "", sort: "smart" };
  try {
    const saved = JSON.parse(localStorage.getItem("life_os_habits_ui") || "null");
    if (saved && typeof saved === "object") Object.assign(ui, saved);
  } catch {}

  searchInput.value = ui.q;
  sortSelect.value = ui.sort;

  function persistUI() {
    localStorage.setItem("life_os_habits_ui", JSON.stringify(ui));
  }

  addHabitBtn.addEventListener("click", () => openHabitModal({ mode: "create" }));

  searchInput.addEventListener("input", () => {
    ui.q = searchInput.value.trim();
    persistUI();
    repaint();
  });

  sortSelect.addEventListener("change", () => {
    ui.sort = sortSelect.value;
    persistUI();
    repaint();
  });

  checkAllBtn.addEventListener("click", () => {
    const today = todayISO();
    const visible = getVisibleHabits();
    if (!visible.length) return toast("No visible habits.");
    setState((st) => {
      const ids = new Set(visible.map((h) => h.id));
      st.habits = st.habits.map((h) => {
        if (!ids.has(h.id)) return h;
        const checkins = normalizeCheckins(h.checkins);
        if (!checkins.includes(today)) checkins.push(today);
        return { ...h, checkins };
      });
      return st;
    });
    toast("Checked visible habits for today.");
    repaint();
  });

  uncheckAllBtn.addEventListener("click", () => {
    const today = todayISO();
    const visible = getVisibleHabits();
    if (!visible.length) return toast("No visible habits.");
    setState((st) => {
      const ids = new Set(visible.map((h) => h.id));
      st.habits = st.habits.map((h) => {
        if (!ids.has(h.id)) return h;
        const checkins = normalizeCheckins(h.checkins).filter((d) => d !== today);
        return { ...h, checkins };
      });
      return st;
    });
    toast("Unchecked visible habits for today.");
    repaint();
  });

  repaint();
  return root;

  // ---------- rendering ----------
  function repaint() {
    const s = getState();
    const visible = getVisibleHabits(s.habits || []);
    const today = todayISO();

    const todayChecked = (s.habits || []).filter((h) => normalizeCheckins(h.checkins).includes(today)).length;

    countBadge.textContent = `${visible.length} habit${visible.length === 1 ? "" : "s"} shown`;
    todayBadge.textContent = `${todayChecked} checked today`;

    listRoot.innerHTML = "";
    if (!visible.length) {
      emptyState.style.display = "block";
      emptyState.textContent = ui.q ? "No habits match your search." : "No habits yet. Click “Add habit”.";
      return;
    }
    emptyState.style.display = "none";

    visible.forEach((h) => listRoot.appendChild(habitRow(h)));
  }

  function habitRow(habit) {
    const today = todayISO();
    const checkins = normalizeCheckins(habit.checkins);
    const checkedToday = checkins.includes(today);
    const streak = calcStreak(checkins, today);
    const last14 = lastNDays(14, today);

    const row = document.createElement("div");
    row.className = "card";
    row.style.boxShadow = "none";

    row.innerHTML = `
      <div class="card-body" style="display:grid;gap:12px">
        <div class="row space-between wrap" style="align-items:flex-start">
          <div style="display:grid;gap:6px">
            <div class="row wrap" style="gap:10px;align-items:center">
              <input type="checkbox" ${checkedToday ? "checked" : ""} aria-label="Check in today" />
              <div style="font-weight:900;font-size:15px;line-height:1.2">${escapeHTML(habit.name)}</div>
              <span class="badge">Streak: ${streak}</span>
            </div>
            ${habit.description ? `<div style="color:var(--muted);font-size:13px">${escapeHTML(habit.description)}</div>` : ""}
          </div>

          <div class="row wrap">
            <button class="btn btn-ghost" data-act="edit" type="button">Edit</button>
            <button class="btn btn-danger" data-act="del" type="button">Delete</button>
          </div>
        </div>

        <div class="row wrap" style="gap:10px;align-items:center">
          <div style="color:var(--muted);font-size:12px">Last 14 days:</div>
          <div class="row wrap" style="gap:6px" data-strip></div>
          <div style="flex:1"></div>
          <div style="color:var(--muted);font-size:12px">
            Created: ${escapeHTML((habit.createdAt || "").slice(0, 10) || "—")}
          </div>
        </div>
      </div>
    `;

    // Build 14-day strip
    const strip = row.querySelector("[data-strip]");
    last14.forEach((d) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "icon-btn";
      dot.style.width = "28px";
      dot.style.height = "28px";
      dot.style.borderRadius = "10px";
      dot.style.borderColor = "var(--border)";
      dot.style.background = checkins.includes(d)
        ? "color-mix(in oklab, var(--ok) 25%, var(--panel-2))"
        : "var(--panel-2)";
      dot.title = d;
      dot.textContent = d.slice(8, 10);

      dot.addEventListener("click", () => {
        toggleCheckin(habit.id, d);
        repaint();
      });

      strip.appendChild(dot);
    });

    // Today checkbox
    const cb = row.querySelector('input[type="checkbox"]');
    cb.addEventListener("change", () => {
      toggleCheckin(habit.id, today);
      toast(cb.checked ? "Checked in." : "Unchecked.");
      repaint();
    });

    // Actions
    row.querySelector('[data-act="edit"]').addEventListener("click", () => {
      openHabitModal({ mode: "edit", habitId: habit.id });
    });

    row.querySelector('[data-act="del"]').addEventListener("click", () => {
      confirmDeleteHabit(habit.id);
    });

    return row;
  }

  // ---------- modal ----------
  function openHabitModal({ mode, habitId }) {
    const isEdit = mode === "edit";
    const s = getState();
    const existing = isEdit ? (s.habits || []).find((h) => h.id === habitId) : null;

    const form = document.createElement("form");
    form.className = "grid";
    form.style.gap = "12px";
    form.innerHTML = `
      <label>
        <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Habit name</div>
        <input class="input" name="name" placeholder="e.g., Read 20 minutes" required />
      </label>

      <label>
        <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Description (optional)</div>
        <textarea class="textarea" name="description" placeholder="What counts as a win?"></textarea>
      </label>

      <div class="row wrap" style="justify-content:flex-end">
        <button class="btn" type="button" data-cancel>Cancel</button>
        <button class="btn btn-primary" type="submit">${isEdit ? "Save" : "Create"}</button>
      </div>
    `;

    const nameEl = form.querySelector('[name="name"]');
    const descEl = form.querySelector('[name="description"]');
    nameEl.value = existing?.name || "";
    descEl.value = existing?.description || "";

    const close = openModal({
      title: isEdit ? "Edit habit" : "New habit",
      content: form,
      actions: [],
    });

    form.querySelector("[data-cancel]").addEventListener("click", () => close?.());
    setTimeout(() => nameEl.focus(), 0);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = nameEl.value.trim();
      const description = descEl.value.trim();
      if (!name) return toast("Habit name is required.");

      if (isEdit) {
        setState((st) => {
          st.habits = (st.habits || []).map((h) => {
            if (h.id !== existing.id) return h;
            return { ...h, name, description };
          });
          return st;
        });
        toast("Habit saved.");
      } else {
        setState((st) => {
          const now = new Date().toISOString();
          st.habits.unshift({
            id: uid(),
            name,
            description,
            checkins: [],
            createdAt: now,
          });
          return st;
        });
        toast("Habit created.");
      }

      close?.();
      repaint();
    });
  }

  function confirmDeleteHabit(id) {
    const h = (getState().habits || []).find((x) => x.id === id);
    if (!h) return;
    openModal({
      title: "Delete habit?",
      content: `<div style="color:var(--muted);font-size:13px">
        This will permanently delete: <strong>${escapeHTML(h.name)}</strong>
      </div>`,
      actions: [
        { label: "Cancel", className: "btn", onClick: (close) => close() },
        {
          label: "Delete",
          className: "btn btn-danger",
          onClick: (close) => {
            setState((st) => {
              st.habits = (st.habits || []).filter((x) => x.id !== id);
              return st;
            });
            close();
            toast("Habit deleted.");
            repaint();
          },
        },
      ],
    });
  }

  // ---------- data ops ----------
  function toggleCheckin(habitId, dateISO) {
    setState((st) => {
      st.habits = (st.habits || []).map((h) => {
        if (h.id !== habitId) return h;
        const checkins = normalizeCheckins(h.checkins);
        const has = checkins.includes(dateISO);
        const next = has ? checkins.filter((d) => d !== dateISO) : [...checkins, dateISO];
        next.sort(); // ISO sort
        return { ...h, checkins: next };
      });
      return st;
    });
  }

  function getVisibleHabits(source) {
    const all = (source || getState().habits || []).slice();
    const q = ui.q.toLowerCase().trim();

    let filtered = all.filter((h) => {
      if (!q) return true;
      const hay = `${h.name || ""} ${h.description || ""}`.toLowerCase();
      return hay.includes(q);
    });

    filtered = sortHabits(filtered, ui.sort);
    return filtered;
  }

  function sortHabits(list, mode) {
    const arr = list.slice();
    const today = todayISO();

    if (mode === "nameAsc") {
      arr.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      return arr;
    }

    if (mode === "createdDesc") {
      arr.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      return arr;
    }

    if (mode === "streakDesc") {
      arr.sort((a, b) => calcStreak(normalizeCheckins(b.checkins), today) - calcStreak(normalizeCheckins(a.checkins), today));
      return arr;
    }

    // smart:
    // 1) unchecked today first
    // 2) higher streak first
    // 3) name
    arr.sort((a, b) => {
      const aChecks = normalizeCheckins(a.checkins);
      const bChecks = normalizeCheckins(b.checkins);

      const aDone = aChecks.includes(today) ? 1 : 0;
      const bDone = bChecks.includes(today) ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;

      const as = calcStreak(aChecks, today);
      const bs = calcStreak(bChecks, today);
      if (as !== bs) return bs - as;

      return String(a.name || "").localeCompare(String(b.name || ""));
    });

    return arr;
  }
}

// ---------- pure helpers ----------
function normalizeCheckins(checkins) {
  const arr = Array.isArray(checkins) ? checkins : [];
  // Keep only ISO yyyy-mm-dd strings
  const cleaned = arr
    .map((d) => String(d).slice(0, 10))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  // unique
  return Array.from(new Set(cleaned)).sort();
}

function lastNDays(n, endISO) {
  const out = [];
  const end = new Date(endISO);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function calcStreak(checkins, todayISODate) {
  // Streak = consecutive days ending today (or yesterday if not checked today? we keep it strict to today)
  // We'll count consecutive days up to today where checkins include each day.
  const set = new Set(checkins);
  let streak = 0;

  let d = new Date(todayISODate);
  while (true) {
    const iso = d.toISOString().slice(0, 10);
    if (!set.has(iso)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]
  ));
}
