// src/pages/learning.js
import { getState, setState } from "../store.js";
import { uid, todayISO, formatDate, clamp } from "../utils.js";
import { openModal } from "../components/modal.js";
import { toast } from "../components/toast.js";

export function pageTitle() {
  return "Learning";
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
          <div style="font-weight:900;font-size:16px">Learning</div>
          <div style="color:var(--muted);font-size:12px">Topics → Lessons → Completion + minutes</div>
        </div>
        <div class="row wrap">
          <button class="btn btn-primary" id="addTopicBtn" type="button">Add topic</button>
          <button class="btn" id="addLessonBtn" type="button">Add lesson</button>
        </div>
      </div>

      <div class="row wrap" style="margin-top:12px">
        <input class="input" id="searchInput" placeholder="Search lessons/topics..." />
        <select class="select" id="filterSelect" style="max-width:240px">
          <option value="all">All lessons</option>
          <option value="next">Next (not completed)</option>
          <option value="completed">Completed</option>
        </select>
        <select class="select" id="sortSelect" style="max-width:240px">
          <option value="smart">Sort: Smart</option>
          <option value="recent">Recently updated</option>
          <option value="title">Title A→Z</option>
        </select>

        <div style="flex:1"></div>

        <div class="row wrap" style="gap:8px">
          <span class="badge" id="minutesBadge">0 min today</span>
          <button class="btn btn-ghost" id="add10Btn" type="button">+10 min</button>
          <button class="btn btn-ghost" id="add25Btn" type="button">+25 min</button>
          <button class="btn btn-ghost" id="add60Btn" type="button">+60 min</button>
        </div>
      </div>
    </div>
  `;
  root.appendChild(header);

  const body = document.createElement("div");
  body.className = "grid cols-2";
  body.style.gap = "12px";
  root.appendChild(body);

  const topicsCard = document.createElement("div");
  topicsCard.className = "card";
  topicsCard.innerHTML = `
    <div class="card-body">
      <div class="row space-between wrap">
        <div style="font-weight:900">Topics</div>
        <div class="row wrap">
          <button class="btn btn-ghost" id="exportTopicsBtn" type="button">Export</button>
          <button class="btn btn-ghost" id="importTopicsBtn" type="button">Import</button>
        </div>
      </div>
      <hr />
      <div id="topicsList" class="grid" style="gap:10px"></div>
      <div id="topicsEmpty" style="display:none;color:var(--muted);font-size:13px;margin-top:8px"></div>
    </div>
  `;
  body.appendChild(topicsCard);

  const lessonsCard = document.createElement("div");
  lessonsCard.className = "card";
  lessonsCard.innerHTML = `
    <div class="card-body">
      <div class="row space-between wrap">
        <div style="font-weight:900">Lessons</div>
        <div class="row wrap">
          <span class="badge" id="countBadge">0</span>
        </div>
      </div>
      <hr />
      <div id="lessonsList" class="grid" style="gap:10px"></div>
      <div id="lessonsEmpty" style="display:none;color:var(--muted);font-size:13px;margin-top:8px"></div>
    </div>
  `;
  body.appendChild(lessonsCard);

  // UI refs
  const addTopicBtn = header.querySelector("#addTopicBtn");
  const addLessonBtn = header.querySelector("#addLessonBtn");
  const searchInput = header.querySelector("#searchInput");
  const filterSelect = header.querySelector("#filterSelect");
  const sortSelect = header.querySelector("#sortSelect");

  const minutesBadge = header.querySelector("#minutesBadge");
  const add10Btn = header.querySelector("#add10Btn");
  const add25Btn = header.querySelector("#add25Btn");
  const add60Btn = header.querySelector("#add60Btn");

  const topicsList = topicsCard.querySelector("#topicsList");
  const topicsEmpty = topicsCard.querySelector("#topicsEmpty");
  const exportTopicsBtn = topicsCard.querySelector("#exportTopicsBtn");
  const importTopicsBtn = topicsCard.querySelector("#importTopicsBtn");

  const lessonsList = lessonsCard.querySelector("#lessonsList");
  const lessonsEmpty = lessonsCard.querySelector("#lessonsEmpty");
  const countBadge = lessonsCard.querySelector("#countBadge");

  const ui = {
    q: "",
    filter: "next",
    sort: "smart",
    topicId: "all",
  };
  try {
    const saved = JSON.parse(localStorage.getItem("life_os_learning_ui") || "null");
    if (saved && typeof saved === "object") Object.assign(ui, saved);
  } catch {}

  searchInput.value = ui.q;
  filterSelect.value = ui.filter;
  sortSelect.value = ui.sort;

  function persistUI() {
    localStorage.setItem("life_os_learning_ui", JSON.stringify(ui));
  }

  // Events
  addTopicBtn.addEventListener("click", () => openTopicModal({ mode: "create" }));

  addLessonBtn.addEventListener("click", () => {
    const s = getState();
    if (!(s.topics || []).length) {
      toast("Create a topic first.");
      return openTopicModal({ mode: "create" });
    }
    openLessonModal({ mode: "create" });
  });

  searchInput.addEventListener("input", () => {
    ui.q = searchInput.value.trim();
    persistUI();
    repaint();
  });
  filterSelect.addEventListener("change", () => {
    ui.filter = filterSelect.value;
    persistUI();
    repaint();
  });
  sortSelect.addEventListener("change", () => {
    ui.sort = sortSelect.value;
    persistUI();
    repaint();
  });

  add10Btn.addEventListener("click", () => addMinutes(10));
  add25Btn.addEventListener("click", () => addMinutes(25));
  add60Btn.addEventListener("click", () => addMinutes(60));

  exportTopicsBtn.addEventListener("click", () => exportLearningPack());
  importTopicsBtn.addEventListener("click", () => importLearningPack());

  repaint();
  return root;

  // ---------- render ----------
  function repaint() {
    const s = getState();
    const topics = s.topics || [];
    const lessons = s.lessons || [];
    const today = todayISO();

    minutesBadge.textContent = `${minutesForDay(s, today)} min today`;

    // Topics list
    topicsList.innerHTML = "";
    if (!topics.length) {
      topicsEmpty.style.display = "block";
      topicsEmpty.textContent = "No topics yet. Click “Add topic”.";
    } else {
      topicsEmpty.style.display = "none";
      topics
          .slice()
          .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")))
          .forEach((t) => topicsList.appendChild(topicRow(t)));
    }

    // Lessons list (filtered)
    const visibleLessons = getVisibleLessons({ topics, lessons });
    countBadge.textContent = `${visibleLessons.length}`;

    lessonsList.innerHTML = "";
    if (!visibleLessons.length) {
      lessonsEmpty.style.display = "block";
      lessonsEmpty.textContent = emptyLessonsText();
    } else {
      lessonsEmpty.style.display = "none";
      visibleLessons.forEach((l) => lessonsList.appendChild(lessonRow(l, topics)));
    }
  }

  function topicRow(topic) {
    const s = getState();
    const lessons = s.lessons || [];
    const total = lessons.filter((l) => l.topicId === topic.id).length;
    const done = lessons.filter((l) => l.topicId === topic.id && l.completedAt).length;

    const row = document.createElement("div");
    row.className = "card";
    row.style.boxShadow = "none";
    row.innerHTML = `
      <div class="card-body">
        <div class="row space-between wrap" style="align-items:flex-start">
          <div style="display:grid;gap:6px">
            <div style="font-weight:900">${escapeHTML(topic.title || "(Untitled topic)")}</div>
            ${topic.notes ? `<div style="color:var(--muted);font-size:13px">${escapeHTML(topic.notes)}</div>` : ""}
            <div class="row wrap" style="gap:8px">
              <span class="badge">${done}/${total} done</span>
              <span class="badge">id: ${escapeHTML(topic.id.slice(0, 6))}</span>
            </div>
          </div>
          <div class="row wrap">
            <button class="btn btn-ghost" data-act="addLesson" type="button">Add lesson</button>
            <button class="btn btn-ghost" data-act="edit" type="button">Edit</button>
            <button class="btn btn-danger" data-act="del" type="button">Delete</button>
          </div>
        </div>
      </div>
    `;

    row.querySelector('[data-act="addLesson"]').addEventListener("click", () => {
      openLessonModal({ mode: "create", presetTopicId: topic.id });
    });
    row.querySelector('[data-act="edit"]').addEventListener("click", () => {
      openTopicModal({ mode: "edit", topicId: topic.id });
    });
    row.querySelector('[data-act="del"]').addEventListener("click", () => confirmDeleteTopic(topic.id));

    // Clicking topic filters lessons by this topic (optional)
    row.style.cursor = "pointer";
    row.addEventListener("click", (e) => {
      // avoid when pressing buttons
      if (e.target.closest("button")) return;
      ui.topicId = ui.topicId === topic.id ? "all" : topic.id;
      toast(ui.topicId === "all" ? "Showing all topics" : `Filter: ${topic.title}`);
      persistUI();
      repaint();
    });

    return row;
  }

  function lessonRow(lesson, topics) {
    const topic = topics.find((t) => t.id === lesson.topicId);
    const isDone = Boolean(lesson.completedAt);

    const row = document.createElement("div");
    row.className = "card";
    row.style.boxShadow = "none";

    row.innerHTML = `
      <div class="card-body" style="display:grid;gap:10px">
        <div class="row space-between wrap" style="align-items:flex-start">
          <div class="row wrap" style="gap:10px;align-items:flex-start">
            <input type="checkbox" ${isDone ? "checked" : ""} aria-label="Toggle complete" />
            <div style="display:grid;gap:6px;min-width:240px">
              <div style="font-weight:900;line-height:1.2;${isDone ? "text-decoration:line-through;opacity:0.75" : ""}">
                ${escapeHTML(lesson.title || "(Untitled lesson)")}
              </div>
              <div class="row wrap" style="gap:8px">
                <span class="badge">${escapeHTML(topic?.title || "No topic")}</span>
                ${lesson.updatedAt ? `<span class="badge">Updated ${escapeHTML(formatDate(lesson.updatedAt))}</span>` : ""}
                ${isDone ? `<span class="badge">Done ${escapeHTML(formatDate(lesson.completedAt))}</span>` : `<span class="badge">Not done</span>`}
              </div>
            </div>
          </div>

          <div class="row wrap">
            <button class="btn btn-ghost" data-act="open" type="button">Open</button>
            <button class="btn btn-ghost" data-act="edit" type="button">Edit</button>
            <button class="btn btn-danger" data-act="del" type="button">Delete</button>
          </div>
        </div>

        ${lesson.content ? `<div style="color:var(--muted);font-size:13px;white-space:pre-wrap">${escapeHTML(snippet(lesson.content, 240))}</div>` : ""}
      </div>
    `;

    const cb = row.querySelector('input[type="checkbox"]');
    cb.addEventListener("change", () => {
      patchLesson(lesson.id, { completedAt: cb.checked ? new Date().toISOString() : null });
      toast(cb.checked ? "Lesson completed." : "Lesson marked not done.");
      repaint();
    });

    row.querySelector('[data-act="open"]').addEventListener("click", () => openLessonReader(lesson.id));
    row.querySelector('[data-act="edit"]').addEventListener("click", () => openLessonModal({ mode: "edit", lessonId: lesson.id }));
    row.querySelector('[data-act="del"]').addEventListener("click", () => confirmDeleteLesson(lesson.id));

    return row;
  }

  function emptyLessonsText() {
    if (ui.filter === "completed") return "No completed lessons match your filters.";
    if (ui.filter === "next") return "No next lessons. Everything is completed (or create lessons).";
    return "No lessons yet. Click “Add lesson”.";
  }

  // ---------- filters ----------
  function getVisibleLessons({ topics, lessons }) {
    const q = ui.q.toLowerCase().trim();
    const filter = ui.filter;
    const sort = ui.sort;

    let out = lessons.slice();

    // topic filter toggle (from clicking a topic)
    if (ui.topicId !== "all") out = out.filter((l) => l.topicId === ui.topicId);

    // completed filter
    if (filter === "completed") out = out.filter((l) => Boolean(l.completedAt));
    if (filter === "next") out = out.filter((l) => !l.completedAt);

    // search
    if (q) {
      out = out.filter((l) => {
        const topicTitle = topics.find((t) => t.id === l.topicId)?.title || "";
        const hay = `${l.title || ""} ${l.content || ""} ${topicTitle}`.toLowerCase();
        return hay.includes(q);
      });
    }

    // sort
    if (sort === "title") {
      out.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
      return out;
    }

    if (sort === "recent") {
      out.sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
      return out;
    }

    // smart:
    // 1) not completed first
    // 2) within same, recently updated
    out.sort((a, b) => {
      const ad = a.completedAt ? 1 : 0;
      const bd = b.completedAt ? 1 : 0;
      if (ad !== bd) return ad - bd;
      return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""));
    });

    return out;
  }

  // ---------- minutes ----------
  function addMinutes(min) {
    const m = clamp(Number(min) || 0, 1, 600);
    const date = todayISO();
    setState((st) => {
      const now = new Date().toISOString();
      st.timeLogs = st.timeLogs || [];
      st.timeLogs.unshift({
        id: uid(),
        type: "learning",
        minutes: m,
        date,
        createdAt: now,
      });
      return st;
    });
    toast(`Added ${m} min learning.`);
    repaint();
  }

  function minutesForDay(state, dateISO) {
    const logs = state.timeLogs || [];
    return logs
        .filter((x) => x.type === "learning" && String(x.date).slice(0, 10) === dateISO)
        .reduce((sum, x) => sum + Number(x.minutes || 0), 0);
  }

  // ---------- modals ----------
  function openTopicModal({ mode, topicId }) {
    const isEdit = mode === "edit";
    const s = getState();
    const existing = isEdit ? (s.topics || []).find((t) => t.id === topicId) : null;

    const form = document.createElement("form");
    form.className = "grid";
    form.style.gap = "12px";
    form.innerHTML = `
      <label>
        <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Topic title</div>
        <input class="input" name="title" placeholder="e.g., JavaScript Foundations" required />
      </label>

      <label>
        <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Notes (optional)</div>
        <textarea class="textarea" name="notes" placeholder="What is this topic about?"></textarea>
      </label>

      <div class="row wrap" style="justify-content:flex-end">
        <button class="btn" type="button" data-cancel>Cancel</button>
        <button class="btn btn-primary" type="submit">${isEdit ? "Save" : "Create"}</button>
      </div>
    `;

    const titleEl = form.querySelector('[name="title"]');
    const notesEl = form.querySelector('[name="notes"]');
    titleEl.value = existing?.title || "";
    notesEl.value = existing?.notes || "";

    const close = openModal({
      title: isEdit ? "Edit topic" : "New topic",
      content: form,
      actions: [],
    });

    form.querySelector("[data-cancel]").addEventListener("click", () => close?.());
    setTimeout(() => titleEl.focus(), 0);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const title = titleEl.value.trim();
      const notes = notesEl.value.trim();
      if (!title) return toast("Topic title is required.");

      const now = new Date().toISOString();
      if (isEdit) {
        setState((st) => {
          st.topics = (st.topics || []).map((t) => (t.id === existing.id ? { ...t, title, notes, updatedAt: now } : t));
          return st;
        });
        toast("Topic saved.");
      } else {
        setState((st) => {
          st.topics = st.topics || [];
          st.topics.unshift({ id: uid(), title, notes, createdAt: now, updatedAt: now });
          return st;
        });
        toast("Topic created.");
      }

      close?.();
      repaint();
    });
  }

  function openLessonModal({ mode, lessonId, presetTopicId }) {
    const isEdit = mode === "edit";
    const s = getState();
    const existing = isEdit ? (s.lessons || []).find((l) => l.id === lessonId) : null;
    const topics = s.topics || [];
    const defaultTopicId = presetTopicId || existing?.topicId || topics[0]?.id;

    const form = document.createElement("form");
    form.className = "grid";
    form.style.gap = "12px";
    form.innerHTML = `
      <div class="grid cols-2">
        <label>
          <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Lesson title</div>
          <input class="input" name="title" placeholder="e.g., Promises and async/await" required />
        </label>

        <label>
          <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Topic</div>
          <select class="select" name="topicId"></select>
        </label>
      </div>

      <label>
        <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Content / Notes</div>
        <textarea class="textarea" name="content" placeholder="Write lesson notes, links, steps..."></textarea>
      </label>

      <div class="row wrap" style="gap:10px">
        <label class="row wrap" style="gap:8px">
          <input type="checkbox" name="done" />
          <span style="color:var(--muted);font-size:13px">Mark as completed</span>
        </label>
      </div>

      <div class="row wrap" style="justify-content:flex-end">
        <button class="btn" type="button" data-cancel>Cancel</button>
        <button class="btn btn-primary" type="submit">${isEdit ? "Save" : "Create"}</button>
      </div>
    `;

    const titleEl = form.querySelector('[name="title"]');
    const topicEl = form.querySelector('[name="topicId"]');
    const contentEl = form.querySelector('[name="content"]');
    const doneEl = form.querySelector('[name="done"]');

    topicEl.innerHTML = topics
        .map((t) => `<option value="${escapeHTML(t.id)}">${escapeHTML(t.title || "Topic")}</option>`)
        .join("");

    titleEl.value = existing?.title || "";
    topicEl.value = defaultTopicId || "";
    contentEl.value = existing?.content || "";
    doneEl.checked = Boolean(existing?.completedAt);

    const close = openModal({
      title: isEdit ? "Edit lesson" : "New lesson",
      content: form,
      actions: [],
    });

    form.querySelector("[data-cancel]").addEventListener("click", () => close?.());
    setTimeout(() => titleEl.focus(), 0);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const title = titleEl.value.trim();
      const topicId = topicEl.value;
      const content = contentEl.value.trim();
      const done = doneEl.checked;

      if (!title) return toast("Lesson title is required.");
      if (!topicId) return toast("Pick a topic.");

      const now = new Date().toISOString();
      if (isEdit) {
        setState((st) => {
          st.lessons = (st.lessons || []).map((l) => {
            if (l.id !== existing.id) return l;
            return {
              ...l,
              title,
              topicId,
              content,
              updatedAt: now,
              completedAt: done ? (l.completedAt || now) : null,
            };
          });
          return st;
        });
        toast("Lesson saved.");
      } else {
        setState((st) => {
          st.lessons = st.lessons || [];
          st.lessons.unshift({
            id: uid(),
            title,
            topicId,
            content,
            createdAt: now,
            updatedAt: now,
            completedAt: done ? now : null,
          });
          return st;
        });
        toast("Lesson created.");
      }

      close?.();
      repaint();
    });
  }

  function openLessonReader(lessonId) {
    const s = getState();
    const lesson = (s.lessons || []).find((l) => l.id === lessonId);
    if (!lesson) return;

    const topic = (s.topics || []).find((t) => t.id === lesson.topicId);

    const body = document.createElement("div");
    body.className = "grid";
    body.style.gap = "12px";

    const meta = document.createElement("div");
    meta.style.color = "var(--muted)";
    meta.style.fontSize = "12px";
    meta.textContent = `Topic: ${topic?.title || "—"} • Updated: ${formatDate(lesson.updatedAt || lesson.createdAt)} • Done: ${lesson.completedAt ? formatDate(lesson.completedAt) : "No"}`;

    const content = document.createElement("div");
    content.style.whiteSpace = "pre-wrap";
    content.style.lineHeight = "1.5";
    content.textContent = lesson.content || "(No content yet)";

    body.appendChild(meta);
    body.appendChild(content);

    openModal({
      title: lesson.title || "Lesson",
      content: body,
      actions: [
        {
          label: lesson.completedAt ? "Mark not done" : "Mark done",
          className: "btn btn-primary",
          onClick: (close) => {
            patchLesson(lesson.id, { completedAt: lesson.completedAt ? null : new Date().toISOString() });
            toast(lesson.completedAt ? "Marked not done." : "Marked done.");
            close();
            repaint();
          },
        },
        { label: "Close", className: "btn", onClick: (close) => close() },
      ],
    });
  }

  // ---------- delete confirmations ----------
  function confirmDeleteTopic(topicId) {
    const s = getState();
    const t = (s.topics || []).find((x) => x.id === topicId);
    if (!t) return;

    const lessonsCount = (s.lessons || []).filter((l) => l.topicId === topicId).length;

    openModal({
      title: "Delete topic?",
      content: `<div style="color:var(--muted);font-size:13px">
        Delete topic <strong>${escapeHTML(t.title)}</strong>?
        ${lessonsCount ? `<br/>It has <strong>${lessonsCount}</strong> lesson(s) and they will be removed too.` : ""}
      </div>`,
      actions: [
        { label: "Cancel", className: "btn", onClick: (close) => close() },
        {
          label: "Delete",
          className: "btn btn-danger",
          onClick: (close) => {
            setState((st) => {
              st.topics = (st.topics || []).filter((x) => x.id !== topicId);
              st.lessons = (st.lessons || []).filter((l) => l.topicId !== topicId);
              return st;
            });
            close();
            toast("Topic deleted.");
            // reset filter if needed
            if (ui.topicId === topicId) ui.topicId = "all";
            persistUI();
            repaint();
          },
        },
      ],
    });
  }

  function confirmDeleteLesson(lessonId) {
    const s = getState();
    const l = (s.lessons || []).find((x) => x.id === lessonId);
    if (!l) return;

    openModal({
      title: "Delete lesson?",
      content: `<div style="color:var(--muted);font-size:13px">
        This will permanently delete: <strong>${escapeHTML(l.title || "Untitled")}</strong>
      </div>`,
      actions: [
        { label: "Cancel", className: "btn", onClick: (close) => close() },
        {
          label: "Delete",
          className: "btn btn-danger",
          onClick: (close) => {
            setState((st) => {
              st.lessons = (st.lessons || []).filter((x) => x.id !== lessonId);
              return st;
            });
            close();
            toast("Lesson deleted.");
            repaint();
          },
        },
      ],
    });
  }

  // ---------- pack import/export ----------
  function exportLearningPack() {
    const s = getState();
    const pack = {
      meta: { type: "learning-pack", version: 1 },
      topics: s.topics || [],
      lessons: s.lessons || [],
    };
    const data = JSON.stringify(pack, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `learning-pack-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Learning pack exported.");
  }

  function importLearningPack() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const pack = JSON.parse(text);
        if (!pack?.meta?.type || pack.meta.type !== "learning-pack") throw new Error("Not a learning-pack JSON.");
        setState((st) => {
          st.topics = Array.isArray(pack.topics) ? pack.topics : [];
          st.lessons = Array.isArray(pack.lessons) ? pack.lessons : [];
          return st;
        });
        toast("Learning pack imported.");
        repaint();
      } catch (e) {
        toast(`Import failed: ${e.message}`);
      }
    });
    input.click();
  }

  // ---------- patch helpers ----------
  function patchLesson(id, patch) {
    setState((st) => {
      const now = new Date().toISOString();
      st.lessons = (st.lessons || []).map((l) => {
        if (l.id !== id) return l;
        return { ...l, ...patch, updatedAt: now };
      });
      return st;
    });
  }
}

// ---------- tiny helpers ----------
function snippet(s, n) {
  const str = String(s || "");
  if (str.length <= n) return str;
  return str.slice(0, n).trimEnd() + "…";
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]
  ));
}
