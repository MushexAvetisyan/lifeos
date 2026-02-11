// src/components/searchEverywhere.js
import { getState } from "../store.js";
import { openModal } from "./modal.js";
import { todayISO } from "../utils.js";

let lastQuery = "";
let lastClose = null;
let debounceT = null;

export function initSearchEverywhere({ inputEl, buttonEl }) {
    if (!inputEl) return;

    const runPage = () => {
        const q = inputEl.value.trim();
        if (!q) return;
        openSearchPage(q);
    };

    // ✅ Debounce: auto-preview modal after 300ms
    inputEl.addEventListener("input", () => {
        const q = inputEl.value.trim();
        clearTimeout(debounceT);

        // если пусто — закрыть превью
        if (!q) {
            closePreview();
            return;
        }

        debounceT = setTimeout(() => {
            // показываем превью-результаты в модалке (auto)
            openSearchPreview(q);
        }, 300);
    });

    inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            // ✅ Enter = отдельная страница результатов
            closePreview();
            runPage();
        }
        if (e.key === "Escape") {
            e.preventDefault();
            inputEl.blur();
            inputEl.value = "";
            closePreview();
        }
    });

    buttonEl?.addEventListener("click", () => {
        closePreview();
        runPage();
    });
}

/* ---------------- Public: page mode ---------------- */

export function openSearchPage(query) {
    const q = String(query || "").trim();
    if (!q) return;
    // hash route with query (router path stays "/search")
    location.hash = `#/search?q=${encodeURIComponent(q)}`;
}

/* ---------------- Preview modal (auto) ---------------- */

function openSearchPreview(query) {
    const q = String(query || "").trim();
    if (!q) return;

    // Если уже открыта модалка — просто перерисуем контент
    if (lastQuery === q && lastClose) return;

    lastQuery = q;

    const { body, total } = buildResultsUI(q);

    // Закрыть предыдущую превью-модалку
    closePreview();

    lastClose = openModal({
        title: `Search preview: "${q}"`,
        content: body,
        actions: [
            {
                label: "Open full results",
                className: "btn btn-primary",
                onClick: (close) => {
                    close();
                    lastClose = null;
                    openSearchPage(q);
                },
            },
            { label: "Close", className: "btn", onClick: (close) => close() },
        ],
    });

    // если совсем нет результатов — не спамим
    if (total === 0) {
        // можно оставить модалку, но не обязательно
    }
}

function closePreview() {
    if (typeof lastClose === "function") {
        try { lastClose(); } catch {}
    }
    lastClose = null;
    lastQuery = "";
}

/* ---------------- Core: results builder (shared) ---------------- */

export function computeSearchResults(query) {
    const q = String(query || "").trim();
    const ql = q.toLowerCase();
    const s = getState();

    const tasks = (s.tasks || []).filter((t) => matchTask(t, ql)).slice(0, 25);
    const habits = (s.habits || []).filter((h) => matchHabit(h, ql)).slice(0, 25);
    const topics = (s.topics || []).filter((t) => matchTopic(t, ql)).slice(0, 25);
    const lessons = (s.lessons || []).filter((l) => matchLesson(l, ql, s.topics || [])).slice(0, 25);
    const timeLogs = (s.timeLogs || []).filter((x) => matchLog(x, ql)).slice(0, 25);

    return { tasks, habits, topics, lessons, timeLogs };
}

export function buildResultsUI(query, { limitPerGroup = 10 } = {}) {
    const q = String(query || "").trim();
    const s = getState();
    const r = computeSearchResults(q);

    const tasks = r.tasks.slice(0, limitPerGroup);
    const habits = r.habits.slice(0, limitPerGroup);
    const topics = r.topics.slice(0, limitPerGroup);
    const lessons = r.lessons.slice(0, limitPerGroup);
    const timeLogs = r.timeLogs.slice(0, limitPerGroup);

    const body = document.createElement("div");
    body.className = "grid";
    body.style.gap = "12px";

    body.appendChild(section("Tasks", tasks.length, tasks.map((t) => row({
        titleHTML: highlightHTML(t.title || "(Untitled task)", q),
        metaHTML: highlightHTML(
            [
                t.status === "done" ? "done" : "todo",
                t.due ? `due ${String(t.due).slice(0, 10)}` : null,
                (t.tags || []).length ? `#${t.tags[0]}` : null,
            ].filter(Boolean).join(" • "),
            q
        ),
        onClick: () => (location.hash = "#/tasks"),
    }))));

    body.appendChild(section("Habits", habits.length, habits.map((h) => row({
        titleHTML: highlightHTML(h.name || "(Habit)", q),
        metaHTML: highlightHTML(
            (h.checkins || []).includes(todayISO()) ? "checked today" : "not checked today",
            q
        ),
        onClick: () => (location.hash = "#/habits"),
    }))));

    body.appendChild(section("Learning: Topics", topics.length, topics.map((t) => row({
        titleHTML: highlightHTML(t.title || "(Topic)", q),
        metaHTML: highlightHTML(t.notes ? snippet(t.notes, 90) : "", q),
        onClick: () => (location.hash = "#/learning"),
    }))));

    body.appendChild(section("Learning: Lessons", lessons.length, lessons.map((l) => row({
        titleHTML: highlightHTML(l.title || "(Lesson)", q),
        metaHTML: highlightHTML(
            [lessonTopicTitle(l, s.topics || []), l.completedAt ? "done" : "not done"].filter(Boolean).join(" • "),
            q
        ),
        onClick: () => (location.hash = "#/learning"),
    }))));

    body.appendChild(section("Logs (time)", timeLogs.length, timeLogs.map((x) => row({
        titleHTML: highlightHTML(`${x.type || "log"} • ${Number(x.minutes || 0)} min`, q),
        metaHTML: highlightHTML(String(x.date || x.createdAt || "").slice(0, 10), q),
        onClick: () => (location.hash = "#/analytics"),
    }))));

    const total =
        tasks.length + habits.length + topics.length + lessons.length + timeLogs.length;

    if (total === 0) {
        const empty = document.createElement("div");
        empty.style.color = "var(--muted)";
        empty.style.fontSize = "13px";
        empty.textContent = "No results found.";
        body.appendChild(empty);
    }

    return { body, total };
}

/* ---------- UI builders ---------- */

function section(title, count, rows) {
    const wrap = document.createElement("div");
    wrap.className = "card";
    wrap.style.boxShadow = "none";
    wrap.innerHTML = `
    <div class="card-body" style="display:grid;gap:10px">
      <div class="row space-between wrap">
        <div style="font-weight:900">${escapeHTML(title)}</div>
        <span class="badge">${count}</span>
      </div>
      <div class="grid" data-list style="gap:8px"></div>
    </div>
  `;
    const list = wrap.querySelector("[data-list]");
    if (!rows.length) {
        const d = document.createElement("div");
        d.style.color = "var(--muted)";
        d.style.fontSize = "13px";
        d.textContent = "—";
        list.appendChild(d);
    } else {
        rows.forEach((r) => list.appendChild(r));
    }
    return wrap;
}

function row({ titleHTML, metaHTML, onClick }) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "btn btn-ghost";
    el.style.textAlign = "left";
    el.style.display = "grid";
    el.style.gap = "4px";
    el.style.padding = "10px 12px";
    el.style.border = "1px solid var(--border)";
    el.style.borderRadius = "14px";
    el.style.background = "var(--panel-2)";

    el.innerHTML = `
    <div style="font-weight:900">${titleHTML}</div>
    ${metaHTML ? `<div style="color:var(--muted);font-size:12px">${metaHTML}</div>` : ""}
  `;

    el.addEventListener("click", () => onClick?.());
    return el;
}

/* ---------- Matchers ---------- */

function matchTask(t, ql) {
    const tags = Array.isArray(t.tags) ? t.tags.join(" ") : "";
    const hay = `${t.title || ""} ${t.description || ""} ${tags}`.toLowerCase();
    return hay.includes(ql);
}

function matchHabit(h, ql) {
    const hay = `${h.name || ""} ${h.description || ""}`.toLowerCase();
    return hay.includes(ql);
}

function matchTopic(t, ql) {
    const hay = `${t.title || ""} ${t.notes || ""}`.toLowerCase();
    return hay.includes(ql);
}

function matchLesson(l, ql, topics) {
    const topic = topics.find((t) => t.id === l.topicId);
    const hay = `${l.title || ""} ${l.content || ""} ${topic?.title || ""}`.toLowerCase();
    return hay.includes(ql);
}

function matchLog(x, ql) {
    const hay = `${x.type || ""} ${x.minutes || ""} ${x.date || ""} ${x.createdAt || ""}`.toLowerCase();
    if (ql === "today") return String(x.date || "").slice(0, 10) === todayISO();
    return hay.includes(ql);
}

function lessonTopicTitle(l, topics) {
    const t = topics.find((x) => x.id === l.topicId);
    return t?.title || "No topic";
}

/* ---------- Highlight helpers ---------- */

function highlightHTML(text, query) {
    const s = String(text || "");
    const q = String(query || "").trim();
    if (!q) return escapeHTML(s);

    const escaped = escapeHTML(s);

    // split by query (case-insensitive)
    // We can’t safely regex on escaped text with different case, so do it on raw text, build pieces safely.
    const parts = splitMatchKeep(s, q);
    return parts
        .map((p) => {
            if (!p.matched) return escapeHTML(p.value);
            return `<mark style="padding:0 3px;border-radius:6px;background: color-mix(in oklab, var(--accent) 35%, transparent); color: inherit;">${escapeHTML(p.value)}</mark>`;
        })
        .join("");
}

function splitMatchKeep(text, query) {
    const t = String(text || "");
    const q = String(query || "");
    if (!q) return [{ value: t, matched: false }];

    const tl = t.toLowerCase();
    const ql = q.toLowerCase();

    const out = [];
    let i = 0;

    while (i < t.length) {
        const idx = tl.indexOf(ql, i);
        if (idx === -1) {
            out.push({ value: t.slice(i), matched: false });
            break;
        }
        if (idx > i) out.push({ value: t.slice(i, idx), matched: false });
        out.push({ value: t.slice(idx, idx + q.length), matched: true });
        i = idx + q.length;
    }
    return out;
}

/* ---------- Utils ---------- */

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
