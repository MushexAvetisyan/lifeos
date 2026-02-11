import { getState, setState } from "../store.js";
import { uid, todayISO } from "../utils.js";
import { toast } from "../components/toast.js";

export function pageTitle() { return "Templates"; }

export function render() {
    const root = document.createElement("div");
    root.className = "grid";
    root.style.gap = "12px";

    const header = document.createElement("div");
    header.className = "card";
    header.innerHTML = `
    <div class="card-body row space-between wrap">
      <div style="display:grid;gap:6px">
        <div style="font-weight:900;font-size:16px">Templates</div>
        <div style="color:var(--muted);font-size:12px">Deploy tasks/habits sets in one click</div>
      </div>
      <div class="row wrap">
        <button class="btn btn-primary" id="seedBtn" type="button">Add starter templates</button>
      </div>
    </div>
  `;
    root.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "grid cols-2";
    grid.style.gap = "12px";
    root.appendChild(grid);

    const tasksCard = card("Task sets", "taskSets");
    const habitsCard = card("Habit sets", "habitSets");
    grid.appendChild(tasksCard);
    grid.appendChild(habitsCard);

    header.querySelector("#seedBtn").addEventListener("click", seedStarters);

    repaint();
    return root;

    function card(title, key) {
        const el = document.createElement("div");
        el.className = "card";
        el.innerHTML = `
      <div class="card-body" style="display:grid;gap:10px">
        <div class="row space-between wrap">
          <div style="font-weight:900">${title}</div>
          <button class="btn btn-ghost" data-add type="button">Add</button>
        </div>
        <div class="grid" data-list style="gap:10px"></div>
        <div data-empty style="display:none;color:var(--muted);font-size:13px"></div>
      </div>
    `;
        el.querySelector("[data-add]").addEventListener("click", () => {
            toast("Next: add create/edit modal (можем сделать позже). Пока — seed templates.");
        });
        el.dataset.key = key;
        return el;
    }

    function repaint() {
        const s = getState();
        const t = s.templates || { taskSets: [], habitSets: [] };

        renderList(tasksCard, t.taskSets || [], "task");
        renderList(habitsCard, t.habitSets || [], "habit");
    }

    function renderList(cardEl, items, type) {
        const list = cardEl.querySelector("[data-list]");
        const empty = cardEl.querySelector("[data-empty]");
        list.innerHTML = "";

        if (!items.length) {
            empty.style.display = "block";
            empty.textContent = "No templates yet. Click “Add starter templates”.";
            return;
        }
        empty.style.display = "none";

        items.forEach((set) => {
            const row = document.createElement("div");
            row.className = "card";
            row.style.boxShadow = "none";
            row.innerHTML = `
        <div class="card-body row space-between wrap" style="align-items:flex-start">
          <div style="display:grid;gap:6px">
            <div style="font-weight:900">${escapeHTML(set.title)}</div>
            <div style="color:var(--muted);font-size:12px">${escapeHTML(set.description || "")}</div>
            <div class="row wrap" style="gap:8px">
              <span class="badge">${(set.items||[]).length} items</span>
            </div>
          </div>
          <div class="row wrap">
            <button class="btn btn-primary" data-deploy type="button">Deploy</button>
            <button class="btn btn-danger" data-del type="button">Delete</button>
          </div>
        </div>
      `;

            row.querySelector("[data-deploy]").addEventListener("click", () => {
                type === "task" ? deployTaskSet(set) : deployHabitSet(set);
                toast("Deployed.");
            });

            row.querySelector("[data-del]").addEventListener("click", () => {
                setState((st) => {
                    st.templates = st.templates || { taskSets: [], habitSets: [] };
                    const k = type === "task" ? "taskSets" : "habitSets";
                    st.templates[k] = (st.templates[k] || []).filter((x) => x.id !== set.id);
                    return st;
                });
                toast("Template deleted.");
                repaint();
            });

            list.appendChild(row);
        });
    }

    function deployTaskSet(set) {
        const now = new Date().toISOString();
        const today = todayISO();
        setState((st) => {
            st.tasks = st.tasks || [];
            (set.items || []).forEach((it) => {
                const due =
                    it.dueMode === "today" ? today :
                        it.dueMode === "tomorrow" ? addDaysISO(today, 1) :
                            null;

                st.tasks.unshift({
                    id: uid(),
                    title: it.title || "Task",
                    description: "",
                    due,
                    priority: Number(it.priority ?? 2),
                    tags: Array.isArray(it.tags) ? it.tags : [],
                    status: "todo",
                    createdAt: now,
                    updatedAt: now,
                    completedAt: null,
                });
            });
            return st;
        });
    }

    function deployHabitSet(set) {
        const now = new Date().toISOString();
        setState((st) => {
            st.habits = st.habits || [];
            (set.items || []).forEach((it) => {
                st.habits.unshift({
                    id: uid(),
                    name: it.name || "Habit",
                    description: it.description || "",
                    checkins: [],
                    createdAt: now,
                });
            });
            return st;
        });
    }

    function seedStarters() {
        setState((st) => {
            st.templates = st.templates || { taskSets: [], habitSets: [] };
            if ((st.templates.taskSets || []).length || (st.templates.habitSets || []).length) return st;

            const now = new Date().toISOString();

            st.templates.taskSets = [
                {
                    id: uid(),
                    title: "Morning Checklist",
                    description: "Start the day right (deploys tasks due today).",
                    createdAt: now,
                    items: [
                        { title: "Drink water", priority: 2, tags: ["health"], dueMode: "today" },
                        { title: "Plan top 3 tasks", priority: 1, tags: ["work"], dueMode: "today" },
                        { title: "10 min stretch", priority: 3, tags: ["health"], dueMode: "today" },
                    ],
                },
                {
                    id: uid(),
                    title: "Weekly Reset",
                    description: "Quick maintenance tasks.",
                    createdAt: now,
                    items: [
                        { title: "Clean downloads folder", priority: 3, tags: ["system"], dueMode: "none" },
                        { title: "Review goals", priority: 2, tags: ["planning"], dueMode: "none" },
                    ],
                },
            ];

            st.templates.habitSets = [
                {
                    id: uid(),
                    title: "Health Basics",
                    description: "Simple daily habits.",
                    createdAt: now,
                    items: [
                        { name: "Drink 2L water", description: "" },
                        { name: "Walk 30 minutes", description: "" },
                        { name: "Sleep before 00:30", description: "" },
                    ],
                },
            ];

            return st;
        });

        toast("Starter templates added.");
        repaint();
    }
}

function addDaysISO(iso, n) {
    const d = new Date(String(iso));
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
}

function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]
    ));
}
