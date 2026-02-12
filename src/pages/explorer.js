// src/pages/explorer.js
import { getState } from "../store.js";
import { toast } from "../components/toast.js";
import { openModal } from "../components/modal.js";


export function pageTitle() {
    return "Data Explorer";
}

export function render() {
    const root = document.createElement("div");
    root.className = "grid";
    root.style.gap = "12px";

    const header = document.createElement("div");
    header.className = "card";
    header.innerHTML = `
    <div class="card-body" style="display:grid;gap:12px">
      <div class="row space-between wrap" style="align-items:flex-start">
        <div style="display:grid;gap:6px">
          <div style="font-weight:900;font-size:16px">Data Explorer</div>
          <div style="color:var(--muted);font-size:12px">Table view of Tasks / Habits / Lessons / Topics / Time Logs</div>
        </div>
        <div class="row wrap" style="gap:8px">
          <button class="btn btn-ghost" id="exportBtn" type="button">Export CSV</button>
        </div>
      </div>

      <div class="row wrap" style="gap:10px;align-items:flex-end">
        <label style="min-width:220px">
          <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Entity</div>
          <select class="select" id="entitySel">
            <option value="tasks">Tasks</option>
            <option value="habits">Habits</option>
            <option value="lessons">Lessons</option>
            <option value="topics">Topics</option>
            <option value="timeLogs">Time Logs</option>
          </select>
        </label>

        <label style="flex:1;min-width:240px">
          <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Search</div>
          <input class="input" id="searchInput" placeholder="Type to search (debounce 300ms)..." />
        </label>

        <label style="min-width:220px">
          <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Sort</div>
          <select class="select" id="sortSel">
            <option value="_smart">Smart (updatedAt/createdAt desc)</option>
            <option value="_id">id</option>
            <option value="createdAt">createdAt</option>
            <option value="updatedAt">updatedAt</option>
            <option value="title">title</option>
            <option value="name">name</option>
            <option value="due">due</option>
            <option value="minutes">minutes</option>
            <option value="date">date</option>
            <option value="status">status</option>
            <option value="priority">priority</option>
          </select>
        </label>

        <label style="min-width:180px">
          <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Order</div>
          <select class="select" id="orderSel">
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </label>

        <label style="min-width:240px">
          <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Filter</div>
          <select class="select" id="filterSel">
            <option value="none">None</option>
            <option value="tasks_active">Tasks: active (not done)</option>
            <option value="tasks_done">Tasks: done</option>
            <option value="lessons_done">Lessons: completed</option>
            <option value="lessons_next">Lessons: not completed</option>
            <option value="logs_learning">TimeLogs: learning only</option>
          </select>
        </label>

        <div class="row wrap" style="gap:8px;margin-left:auto">
          <span class="badge" id="countBadge">0 rows</span>
        </div>
      </div>
    </div>
  `;
    root.appendChild(header);

    const tableCard = document.createElement("div");
    tableCard.className = "card";
    tableCard.innerHTML = `
    <div class="table-wrap" style="display:grid;gap:10px">
      <div style="overflow:auto">
        <table id="tbl" style="width:100%; border-collapse:separate; border-spacing:0">
          <thead></thead>
          <tbody></tbody>
        </table>
      </div>
      <div id="empty" style="display:none;color:var(--muted);font-size:13px"></div>
    </div>
  `;
    root.appendChild(tableCard);

    const entitySel = header.querySelector("#entitySel");
    const searchInput = header.querySelector("#searchInput");
    const sortSel = header.querySelector("#sortSel");
    const orderSel = header.querySelector("#orderSel");
    const filterSel = header.querySelector("#filterSel");
    const exportBtn = header.querySelector("#exportBtn");
    const countBadge = header.querySelector("#countBadge");

    const tbl = tableCard.querySelector("#tbl");
    const thead = tbl.querySelector("thead");
    const tbody = tbl.querySelector("tbody");
    const empty = tableCard.querySelector("#empty");

    // UI state (persist)
    const ui = {
        entity: "tasks",
        q: "",
        sortKey: "_smart",
        order: "desc",
        filter: "none",
        pinned: [],
    };
    try {
        const saved = JSON.parse(localStorage.getItem("life_os_explorer_ui") || "null");
        if (saved && typeof saved === "object") Object.assign(ui, saved);
    } catch {}

    entitySel.value = ui.entity;
    searchInput.value = ui.q;
    sortSel.value = ui.sortKey;
    orderSel.value = ui.order;
    filterSel.value = ui.filter;

    function persistUI() {
        localStorage.setItem("life_os_explorer_ui", JSON.stringify(ui));
    }

    // debounce search
    let t = null;
    searchInput.addEventListener("input", () => {
        clearTimeout(t);
        t = setTimeout(() => {
            ui.q = searchInput.value.trim();
            persistUI();
            repaint();
        }, 300);
    });

    entitySel.addEventListener("change", () => {
        ui.entity = entitySel.value;
        persistUI();
        repaint();
    });
    sortSel.addEventListener("change", () => {
        ui.sortKey = sortSel.value;
        persistUI();
        repaint();
    });
    orderSel.addEventListener("change", () => {
        ui.order = orderSel.value;
        persistUI();
        repaint();
    });
    filterSel.addEventListener("change", () => {
        ui.filter = filterSel.value;
        persistUI();
        repaint();
    });

    exportBtn.addEventListener("click", () => {
        const { rows, headers } = getVisible({ forExport: true });
        if (!rows.length) return toast("Nothing to export.");
        const csv = toCSV(rows, headers);
        downloadText(csv, `life-os-${ui.entity}-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv");
        toast(`Exported ${rows.length} row(s).`);
    });

    repaint();
    return root;

    // -------- core --------

    function repaint() {
        const { rows, headers, total } = getVisible({ forExport: false });

        const shown = rows.length;
        countBadge.textContent = total === shown ? `${total} row(s)` : `${shown}/${total} shown`;

        if (!rows.length) {
            thead.innerHTML = "";
            tbody.innerHTML = "";
            empty.style.display = "block";
            empty.textContent = "No results for current filters/search.";
            return;
        }

        empty.style.display = "none";
        renderTable(headers, rows);
    }

    function getVisible({ forExport }) {
        const s = getState();
        let list = (s[ui.entity] || []).slice();

        // filter (minimum)
        list = applyFilter(ui.entity, list, ui.filter);

        // search
        const q = ui.q.toLowerCase().trim();
        if (q) list = list.filter((row) => rowMatches(row, q));

        // determine headers from visible rows
        const headers = computeHeaders(list, ui.entity);

        // sort
        list = sortRows(list, ui.sortKey, ui.order, ui.entity);

        const total = list.length;

        // limit only for UI (not for export)
        if (!forExport) list = list.slice(0, UI_ROW_LIMIT);

        return { rows: list, headers, total };
    }


    function renderTable(headers, rows) {
        thead.innerHTML = "";
        tbody.innerHTML = "";

        const pinned = new Set(ui.pinned || []);
        const PIN_W = 180; // fixed width for pinned columns (simple, stable)

        const trh = document.createElement("tr");

        headers.forEach((h, idx) => {
            const th = document.createElement("th");
            const isPinned = pinned.has(h);

            const isActive = ui.sortKey === h || (ui.sortKey === "_id" && h === "id");
            const arrow = isActive ? (ui.order === "asc" ? " ▲" : " ▼") : "";

            th.style.cssText = `
      position: sticky; top: 0;
      background: var(--panel-2);
      text-align:left;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
      padding: 6px 6px;
      z-index: 3;
    `;

            // sticky left for pinned columns
            if (isPinned) {
                const pinIndex = (ui.pinned || []).indexOf(h);
                th.style.position = "sticky";
                th.style.left = `${pinIndex * PIN_W}px`;
                th.style.zIndex = 6;
                th.style.minWidth = `${PIN_W}px`;
                th.style.maxWidth = `${PIN_W}px`;
                th.style.boxShadow = "6px 0 0 color-mix(in oklab, var(--border) 45%, transparent)";
            }

            th.innerHTML = `
      <div class="row wrap" style="gap:6px;align-items:center">
        <button type="button" class="btn btn-ghost" data-sort style="
          padding:6px 8px;
          font-weight:900;
          font-size:12px;
          color: var(--muted);
          justify-content:flex-start;
        ">${escapeHTML(h)}${arrow}</button>

        <button type="button" class="btn btn-ghost" data-pin title="Pin/unpin column" style="
          padding:6px 8px;
          font-weight:900;
          font-size:12px;
          color: ${isPinned ? "var(--accent)" : "var(--muted)"};
        ">📌</button>
      </div>
    `;

            // sort click
            th.querySelector("[data-sort]").addEventListener("click", () => {
                if (ui.sortKey === h) ui.order = ui.order === "asc" ? "desc" : "asc";
                else {
                    ui.sortKey = h;
                    ui.order = "asc";
                }
                sortSel.value = ui.sortKey;
                orderSel.value = ui.order;
                persistUI();
                repaint();
            });

            // pin click
            th.querySelector("[data-pin]").addEventListener("click", (e) => {
                e.stopPropagation();
                ui.pinned = Array.isArray(ui.pinned) ? ui.pinned.slice() : [];

                const i = ui.pinned.indexOf(h);
                if (i >= 0) ui.pinned.splice(i, 1);
                else {
                    // keep it reasonable (optional): max 3 pinned
                    if (ui.pinned.length >= 3) {
                        toast("Max 3 pinned columns.");
                        return;
                    }
                    ui.pinned.push(h);
                }

                persistUI();
                repaint();
            });

            trh.appendChild(th);
        });

        thead.appendChild(trh);

        rows.forEach((r) => {
            const tr = document.createElement("tr");
            tr.style.cursor = "default";

            // Row details on double click
            tr.addEventListener("dblclick", () => openRowDetails(r));

            headers.forEach((h) => {
                const td = document.createElement("td");
                const isPinned = pinned.has(h);

                td.style.cssText = `
        padding: 10px 10px;
        border-bottom: 1px solid color-mix(in oklab, var(--border) 75%, transparent);
        vertical-align: top;
        font-size: 13px;
        max-width: 420px;
        overflow: hidden;
        text-overflow: ellipsis;
        background: transparent;
      `;

                // sticky left for pinned columns
                if (isPinned) {
                    const pinIndex = (ui.pinned || []).indexOf(h);
                    td.style.position = "sticky";
                    td.style.left = `${pinIndex * PIN_W}px`;
                    td.style.zIndex = 2;
                    td.style.minWidth = `${PIN_W}px`;
                    td.style.maxWidth = `${PIN_W}px`;
                    td.style.background = "var(--panel-2)";
                    td.style.boxShadow = "6px 0 0 color-mix(in oklab, var(--border) 45%, transparent)";
                }

                const cellText = formatCell(r[h]);
                td.textContent = cellText;

                // Copy cell on click
                td.style.cursor = "copy";
                td.title = "Click to copy cell";
                td.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    try {
                        await navigator.clipboard.writeText(cellText);
                        toast("Cell copied.");
                    } catch {
                        // fallback
                        try {
                            const ta = document.createElement("textarea");
                            ta.value = cellText;
                            document.body.appendChild(ta);
                            ta.select();
                            document.execCommand("copy");
                            ta.remove();
                            toast("Cell copied.");
                        } catch {
                            toast("Copy failed.");
                        }
                    }
                });

                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });
    }

    function openRowDetails(row) {
        const wrap = document.createElement("div");
        wrap.className = "grid";
        wrap.style.gap = "10px";

        const pre = document.createElement("pre");
        pre.style.cssText = `
    margin:0;
    padding:12px;
    border:1px solid var(--border);
    border-radius:12px;
    background:var(--panel-2);
    max-height: 52vh;
    overflow:auto;
    font-size: 12px;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
  `;
        const json = JSON.stringify(row, null, 2);
        pre.textContent = json;

        const hint = document.createElement("div");
        hint.style.cssText = "color:var(--muted);font-size:12px";
        hint.textContent = "Tip: double-click any row to open this.";

        wrap.appendChild(pre);
        wrap.appendChild(hint);

        openModal({
            title: "Row details",
            content: wrap,
            actions: [
                {
                    label: "Copy JSON",
                    className: "btn btn-primary",
                    onClick: async (close) => {
                        try {
                            await navigator.clipboard.writeText(json);
                            toast("JSON copied.");
                        } catch {
                            toast("Copy failed.");
                        }
                        close();
                    },
                },
                { label: "Close", className: "btn", onClick: (close) => close() },
            ],
        });
    }

}


const UI_ROW_LIMIT = 500;
/* ---------- helpers ---------- */

function applyFilter(entity, list, filter) {
    if (filter === "none") return list;

    if (filter === "tasks_active" && entity === "tasks") return list.filter((t) => t.status !== "done");
    if (filter === "tasks_done" && entity === "tasks") return list.filter((t) => t.status === "done");

    if (filter === "lessons_done" && entity === "lessons") return list.filter((l) => Boolean(l.completedAt));
    if (filter === "lessons_next" && entity === "lessons") return list.filter((l) => !l.completedAt);

    if (filter === "logs_learning" && entity === "timeLogs") return list.filter((x) => x.type === "learning");

    // if filter doesn’t apply to this entity, ignore
    return list;
}

function rowMatches(row, q) {
    // search across primitive values + small arrays
    const parts = [];
    for (const [k, v] of Object.entries(row || {})) {
        if (v == null) continue;
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") parts.push(String(v));
        else if (Array.isArray(v)) parts.push(v.slice(0, 30).map((x) => (x == null ? "" : String(x))).join(" "));
        else if (typeof v === "object") {
            // shallow stringify, avoid huge nesting
            const shallow = {};
            let n = 0;
            for (const [kk, vv] of Object.entries(v)) {
                if (n++ > 12) break;
                if (vv == null) continue;
                if (typeof vv === "string" || typeof vv === "number" || typeof vv === "boolean") shallow[kk] = vv;
            }
            parts.push(JSON.stringify(shallow));
        }
    }
    return parts.join(" ").toLowerCase().includes(q);
}

function computeHeaders(list, entity) {
    // prefer stable order: common keys first
    const preferred = {
        tasks: ["id", "title", "status", "priority", "due", "tags", "updatedAt", "createdAt", "completedAt", "description"],
        habits: ["id", "name", "description", "checkins", "createdAt", "updatedAt"],
        lessons: ["id", "title", "topicId", "completedAt", "updatedAt", "createdAt", "content"],
        topics: ["id", "title", "notes", "updatedAt", "createdAt"],
        timeLogs: ["id", "type", "minutes", "date", "createdAt"],
    }[entity] || [];

    const seen = new Set();
    const headers = [];

    // add preferred keys if they exist in any row
    preferred.forEach((k) => {
        if (list.some((r) => Object.prototype.hasOwnProperty.call(r, k))) {
            headers.push(k);
            seen.add(k);
        }
    });

    // add remaining keys (union)
    list.forEach((r) => {
        Object.keys(r || {}).forEach((k) => {
            if (!seen.has(k)) {
                seen.add(k);
                headers.push(k);
            }
        });
    });

    // put pinned first (keep order)
    const pinned = Array.isArray(JSON.parse(localStorage.getItem("life_os_explorer_ui") || "null")?.pinned)
        ? JSON.parse(localStorage.getItem("life_os_explorer_ui") || "null").pinned
        : [];
    if (pinned && pinned.length) {
        const pinSet = new Set(pinned);
        const pinnedHeaders = pinned.filter((h) => headers.includes(h));
        const rest = headers.filter((h) => !pinSet.has(h));
        return [...pinnedHeaders, ...rest];
    }
    return headers;
}

function sortRows(rows, sortKey, order, entity) {
    const dir = order === "asc" ? 1 : -1;

    const key =
        sortKey === "_smart"
            ? (entity === "tasks" ? "updatedAt" : entity === "timeLogs" ? "createdAt" : "updatedAt")
            : sortKey === "_id"
                ? "id"
                : sortKey;

    const getVal = (r) => {
        if (!r) return "";
        const v = r[key];
        if (v == null) return "";
        if (typeof v === "number") return v;
        if (typeof v === "boolean") return v ? 1 : 0;
        // dates/strings
        return String(v);
    };

    return rows.slice().sort((a, b) => {
        const av = getVal(a);
        const bv = getVal(b);

        // numeric compare when both numbers
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;

        // ISO date strings compare nicely
        return String(av).localeCompare(String(bv)) * dir;
    });
}

function formatCell(v) {
    if (v == null) return "";
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
    if (Array.isArray(v)) return v.map((x) => (x == null ? "" : String(x))).join(", ");
    // objects: compact JSON
    try {
        return JSON.stringify(v);
    } catch {
        return String(v);
    }
}

/* ---------- CSV ---------- */

function toCSV(rows, headers) {
    const lines = [];
    lines.push(headers.map(csvEscape).join(","));

    rows.forEach((r) => {
        const line = headers.map((h) => csvEscape(r?.[h]));
        lines.push(line.join(","));
    });

    return lines.join("\n");
}

function csvEscape(value) {
    if (value == null) return "";
    let s = "";

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        s = String(value);
    } else if (Array.isArray(value)) {
        s = value.map((x) => (x == null ? "" : String(x))).join("; ");
    } else {
        try {
            s = JSON.stringify(value);
        } catch {
            s = String(value);
        }
    }

    // Escape quotes by doubling them
    s = s.replace(/"/g, '""');

    // If contains comma, quote, or newline -> wrap in quotes
    if (/[",\n\r]/.test(s)) {
        s = `"${s}"`;
    }

    return s;
}

function downloadText(text, filename, mime) {
    const blob = new Blob([text], { type: mime || "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename || "export.txt";
    a.click();
    URL.revokeObjectURL(a.href);
}


function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]
    ));
}