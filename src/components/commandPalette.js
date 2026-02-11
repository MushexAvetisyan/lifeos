// src/components/commandPalette.js
import { getState, setState, exportState, importState, resetAllData } from "../store.js";
import { toast } from "./toast.js";
import { uid, todayISO } from "../utils.js";

let overlay = null;
let inputEl = null;
let listEl = null;
let isOpen = false;

let allCommands = [];
let filtered = [];
let activeIndex = 0;

export function initCommandPalette() {
    if (overlay) return; // already init

    overlay = document.createElement("div");
    overlay.id = "cmdkOverlay";
    overlay.style.cssText = `
    position: fixed; inset: 0; display: none;
    background: rgba(0,0,0,.45);
    z-index: 9999;
    padding: 10vh 12px 12px;
  `;

    const panel = document.createElement("div");
    panel.style.cssText = `
    max-width: 720px; margin: 0 auto;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 18px;
    box-shadow: 0 20px 60px rgba(0,0,0,.35);
    overflow: hidden;
  `;

    const top = document.createElement("div");
    top.style.cssText = `
    padding: 12px 12px 10px;
    border-bottom: 1px solid var(--border);
    display: grid; gap: 8px;
  `;

    inputEl = document.createElement("input");
    inputEl.className = "input";
    inputEl.placeholder = "Type a command… (e.g. tasks, new habit, theme)";
    inputEl.autocomplete = "off";

    const hint = document.createElement("div");
    hint.style.cssText = `color: var(--muted); font-size: 12px; padding: 0 2px;`;
    hint.textContent = "↑↓ navigate • Enter run • Esc close";

    top.appendChild(inputEl);
    top.appendChild(hint);

    listEl = document.createElement("div");
    listEl.style.cssText = `
    max-height: 360px;
    overflow: auto;
    padding: 8px;
    display: grid;
    gap: 6px;
  `;

    panel.appendChild(top);
    panel.appendChild(listEl);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // close on background click
    overlay.addEventListener("mousedown", (e) => {
        if (e.target === overlay) closePalette();
    });

    // keyboard handling
    document.addEventListener("keydown", (e) => {
        // Ctrl+K / Cmd+K
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            isOpen ? closePalette() : openPalette();
            return;
        }
        if (!isOpen) return;

        if (e.key === "Escape") {
            e.preventDefault();
            closePalette();
            return;
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
            renderList();
            scrollActiveIntoView();
            return;
        }
        if (e.key === "ArrowUp") {
            e.preventDefault();
            activeIndex = Math.max(activeIndex - 1, 0);
            renderList();
            scrollActiveIntoView();
            return;
        }
        if (e.key === "Enter") {
            e.preventDefault();
            runActive();
            return;
        }
    });

    inputEl.addEventListener("input", () => {
        activeIndex = 0;
        applyFilter(inputEl.value);
        renderList();
    });

    // initial commands
    allCommands = buildCommands();
    applyFilter("");
    renderList();
}

export function openPalette() {
    if (!overlay) initCommandPalette();
    allCommands = buildCommands(); // refresh dynamic commands
    applyFilter("");
    activeIndex = 0;
    renderList();

    overlay.style.display = "block";
    isOpen = true;

    setTimeout(() => {
        inputEl.focus();
        inputEl.select();
    }, 0);
}

export function closePalette() {
    if (!overlay) return;
    overlay.style.display = "none";
    isOpen = false;
}

function applyFilter(q) {
    const query = String(q || "").trim().toLowerCase();
    if (!query) {
        filtered = allCommands.slice();
        return;
    }
    filtered = allCommands
        .map((c) => ({ c, score: scoreMatch(c, query) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.c);
}

function scoreMatch(cmd, q) {
    const hay = `${cmd.title} ${cmd.keywords || ""}`.toLowerCase();
    if (hay === q) return 100;
    if (cmd.title.toLowerCase().startsWith(q)) return 80;
    if (hay.includes(q)) return 60;
    // token partial match
    const parts = q.split(/\s+/).filter(Boolean);
    let hit = 0;
    for (const p of parts) if (hay.includes(p)) hit++;
    return hit ? 20 + hit * 5 : 0;
}

function renderList() {
    listEl.innerHTML = "";

    if (!filtered.length) {
        const empty = document.createElement("div");
        empty.style.cssText = `padding: 12px; color: var(--muted); font-size: 13px;`;
        empty.textContent = "No commands found.";
        listEl.appendChild(empty);
        return;
    }

    filtered.forEach((cmd, idx) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "btn";
        item.style.cssText = `
      width: 100%;
      text-align: left;
      display: grid;
      gap: 4px;
      padding: 10px 12px;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: ${idx === activeIndex ? "color-mix(in oklab, var(--accent) 18%, var(--panel-2))" : "var(--panel-2)"};
      cursor: pointer;
    `;

        const title = document.createElement("div");
        title.style.cssText = `font-weight: 900;`;
        title.textContent = cmd.title;

        const sub = document.createElement("div");
        sub.style.cssText = `color: var(--muted); font-size: 12px;`;
        sub.textContent = cmd.subtitle || "";

        item.appendChild(title);
        if (cmd.subtitle) item.appendChild(sub);

        item.addEventListener("mouseenter", () => {
            activeIndex = idx;
            renderList();
        });

        item.addEventListener("click", () => {
            activeIndex = idx;
            runActive();
        });

        listEl.appendChild(item);
    });
}

function scrollActiveIntoView() {
    const btns = listEl.querySelectorAll("button");
    const el = btns[activeIndex];
    if (!el) return;
    el.scrollIntoView({ block: "nearest" });
}

function runActive() {
    const cmd = filtered[activeIndex];
    if (!cmd) return;
    try {
        cmd.run?.();
    } finally {
        closePalette();
    }
}

/* ---------------- Commands ---------------- */

function buildCommands() {
    const s = getState();
    const hasTopics = (s.topics || []).length > 0;

    const cmds = [
        // Navigation
        nav("Go: Dashboard", "#/dashboard", "Navigate"),
        nav("Go: Tasks", "#/tasks", "Navigate"),
        nav("Go: Habits", "#/habits", "Navigate"),
        nav("Go: Learning", "#/learning", "Navigate"),
        nav("Go: Analytics", "#/analytics", "Navigate"),
        nav("Go: Settings", "#/settings", "Navigate"),

        // Create
        {
            title: "Create: Task",
            subtitle: "Quick-create a task (todo, priority 2)",
            keywords: "new add task todo",
            run: () => {
                const now = new Date().toISOString();
                setState((st) => {
                    st.tasks = st.tasks || [];
                    st.tasks.unshift({
                        id: uid(),
                        title: "New task",
                        description: "",
                        due: null,
                        priority: 2,
                        tags: [],
                        status: "todo",
                        createdAt: now,
                        updatedAt: now,
                        completedAt: null,
                    });
                    return st;
                });
                toast("Task created.");
                location.hash = "#/tasks";
            },
        },
        {
            title: "Create: Habit",
            subtitle: "Quick-create a habit",
            keywords: "new add habit",
            run: () => {
                const now = new Date().toISOString();
                setState((st) => {
                    st.habits = st.habits || [];
                    st.habits.unshift({
                        id: uid(),
                        name: "New habit",
                        description: "",
                        checkins: [],
                        createdAt: now,
                    });
                    return st;
                });
                toast("Habit created.");
                location.hash = "#/habits";
            },
        },
        {
            title: "Create: Topic",
            subtitle: "New learning topic",
            keywords: "new add topic learning",
            run: () => {
                const now = new Date().toISOString();
                setState((st) => {
                    st.topics = st.topics || [];
                    st.topics.unshift({
                        id: uid(),
                        title: "New topic",
                        notes: "",
                        createdAt: now,
                        updatedAt: now,
                    });
                    return st;
                });
                toast("Topic created.");
                location.hash = "#/learning";
            },
        },
        {
            title: "Create: Lesson",
            subtitle: hasTopics ? "New lesson in first topic" : "Creates a topic first, then a lesson",
            keywords: "new add lesson learning",
            run: () => {
                const now = new Date().toISOString();
                setState((st) => {
                    st.topics = st.topics || [];
                    st.lessons = st.lessons || [];

                    let topicId = st.topics[0]?.id;
                    if (!topicId) {
                        const tId = uid();
                        st.topics.unshift({
                            id: tId,
                            title: "New topic",
                            notes: "",
                            createdAt: now,
                            updatedAt: now,
                        });
                        topicId = tId;
                    }

                    st.lessons.unshift({
                        id: uid(),
                        title: "New lesson",
                        topicId,
                        content: "",
                        createdAt: now,
                        updatedAt: now,
                        completedAt: null,
                    });

                    return st;
                });
                toast("Lesson created.");
                location.hash = "#/learning";
            },
        },

        // Actions
        {
            title: "Toggle theme (Light/Dark)",
            subtitle: "Switch app theme",
            keywords: "theme dark light toggle",
            run: () => {
                const s = getState();
                const next = (s.settings?.theme || "dark") === "dark" ? "light" : "dark";
                setState((st) => {
                    st.settings = st.settings || { theme: "dark", accent: "#7c3aed" };
                    st.settings.theme = next;
                    return st;
                });
                toast(`Theme: ${next}`);
            },
        },
        {
            title: "Learning: +25 minutes",
            subtitle: "Add learning minutes for today",
            keywords: "learning minutes time log add 25",
            run: () => addLearningMinutes(25),
        },
        {
            title: "Backup: Export JSON",
            subtitle: "Download full Life OS backup",
            keywords: "backup export json download",
            run: () => downloadBackup(),
        },
        {
            title: "Backup: Import JSON",
            subtitle: "Restore from a backup file",
            keywords: "backup import restore json",
            run: () => pickAndImport(),
        },
        {
            title: "Reset: All data",
            subtitle: "Deletes local data (use backup first)",
            keywords: "reset wipe clear data",
            run: () => {
                if (!confirm("Reset all data? This will delete your local Life OS data.")) return;
                resetAllData();
                toast("Data reset.");
                location.hash = "#/dashboard";
            },
        },
    ];

    return cmds;
}

function nav(title, hash, group) {
    return {
        title,
        subtitle: group,
        keywords: `go open navigate ${hash}`,
        run: () => (location.hash = hash),
    };
}

function addLearningMinutes(min) {
    const m = Number(min) || 0;
    if (m <= 0) return;
    const now = new Date().toISOString();
    const date = todayISO();
    setState((st) => {
        st.timeLogs = st.timeLogs || [];
        st.timeLogs.unshift({ id: uid(), type: "learning", minutes: m, date, createdAt: now });
        return st;
    });
    toast(`Added ${m} min learning.`);
}

function downloadBackup() {
    const json = exportState();
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `life-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Backup exported.");
}

function pickAndImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            importState(text);
            toast("Backup imported.");
            // optional refresh current page rendering
            location.hash = location.hash || "#/dashboard";
        } catch (e) {
            toast(`Import failed: ${e.message}`);
        }
    });
    input.click();
}
