import { getState, setState, exportState, importState, resetState } from "../../styles/src/store.js";
import { toast } from "../components/Toast.js";
import { openModal } from "../components/Modal.js";

export function pageTitle() { return "Settings"; }

export function render() {
  const s = getState();

  const root = document.createElement("div");
  root.className = "grid cols-2";

  // Theme / Accent
  root.appendChild(card("Appearance", appearanceForm(s)));

  // Backup
  root.appendChild(card("Backup", backupPanel()));

  // Danger zone
  root.appendChild(card("Danger zone", dangerPanel()));

  return root;

  function appearanceForm(state) {
    const wrap = document.createElement("div");
    wrap.className = "grid";
    wrap.innerHTML = `
      <label>
        <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Theme</div>
        <select class="select" id="themeSelect">
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </label>

      <label>
        <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Accent color</div>
        <input class="input" id="accentInput" type="color" value="${escapeHTML(state.settings.accent)}" />
      </label>

      <div class="row wrap">
        <button class="btn btn-primary" id="saveAppearance" type="button">Save</button>
      </div>
    `;

    wrap.querySelector("#themeSelect").value = state.settings.theme;

    wrap.querySelector("#saveAppearance").addEventListener("click", () => {
      const theme = wrap.querySelector("#themeSelect").value;
      const accent = wrap.querySelector("#accentInput").value;

      setState((st) => {
        st.settings.theme = theme;
        st.settings.accent = accent;
        return st;
      });

      toast("Saved appearance.");
    });

    return wrap;
  }

  function backupPanel() {
    const wrap = document.createElement("div");
    wrap.className = "grid";
    wrap.innerHTML = `
      <div style="color:var(--muted);font-size:13px">
        Export your data to a JSON file, or import it back later.
      </div>
      <div class="row wrap">
        <button class="btn btn-primary" id="exportBtn" type="button">Export JSON</button>
        <button class="btn" id="importBtn" type="button">Import JSON</button>
      </div>
    `;

    wrap.querySelector("#exportBtn").addEventListener("click", () => {
      const data = exportState();
      const blob = new Blob([data], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `life-os-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast("Backup exported.");
    });

    wrap.querySelector("#importBtn").addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file) return;
        const text = await file.text();
        try {
          importState(text);
          toast("Backup imported.");
          location.hash = "#/dashboard";
        } catch (e) {
          toast(`Import failed: ${e.message}`);
        }
      });
      input.click();
    });

    return wrap;
  }

  function dangerPanel() {
    const wrap = document.createElement("div");
    wrap.className = "grid";
    wrap.innerHTML = `
      <div style="color:var(--muted);font-size:13px">
        This will wipe all local data for Life OS on this browser.
      </div>
      <button class="btn btn-danger" id="resetBtn" type="button">Reset all data</button>
    `;

    wrap.querySelector("#resetBtn").addEventListener("click", () => {
      openModal({
        title: "Reset all data?",
        content: `<div style="color:var(--muted);font-size:13px">
          This cannot be undone. Export a backup first if you want.
        </div>`,
        actions: [
          { label: "Cancel", className: "btn", onClick: (close) => close() },
          { label: "Reset", className: "btn btn-danger", onClick: (close) => { resetState(); toast("Data reset."); close(); location.hash = "#/dashboard"; } }
        ]
      });
    });

    return wrap;
  }
}

function card(title, bodyEl) {
  const c = document.createElement("div");
  c.className = "card";
  const header = document.createElement("div");
  header.className = "card-header";
  header.innerHTML = `<div class="card-title">${escapeHTML(title)}</div>`;
  const body = document.createElement("div");
  body.className = "card-body";
  body.appendChild(bodyEl);
  c.appendChild(header);
  c.appendChild(body);
  return c;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]
  ));
}
