// src/pages/settings.js
import { getState, setState, resetAllData } from "../store.js";
import { toast } from "../components/toast.js";
import { openModal } from "../components/modal.js";

export function pageTitle() {
  return "Settings";
}

export function render() {
  const root = document.createElement("div");
  root.className = "grid";
  root.style.gap = "12px";

  root.appendChild(themeCard());
  root.appendChild(dataCard());

  repaint();
  return root;

  function repaint() {
    const s = getState();
    // apply in DOM too (store subscription обычно делает это, но пусть будет дубль)
    document.documentElement.dataset.theme = s.settings?.theme || "dark";
    document.documentElement.style.setProperty("--accent", s.settings?.accent || "#7c3aed");
  }

  function themeCard() {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-body" style="display:grid;gap:12px">
        <div style="font-weight:900;font-size:16px">Appearance</div>
        <div class="row wrap" style="gap:12px;align-items:flex-end">

          <label style="min-width:220px">
            <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Theme</div>
            <select class="select" id="themeSelect">
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>

          <label style="min-width:220px">
            <div style="color:var(--muted);font-size:12px;margin-bottom:6px">Accent color</div>
            <input class="input" id="accentInput" type="color" />
          </label>

          <button class="btn btn-ghost" id="accentReset" type="button">Reset accent</button>
        </div>

        <div class="row wrap" style="gap:10px">
          <button class="btn" id="applyBtn" type="button">Apply</button>
          <span style="color:var(--muted);font-size:12px">Changes are saved locally.</span>
        </div>
      </div>
    `;

    const themeSelect = card.querySelector("#themeSelect");
    const accentInput = card.querySelector("#accentInput");
    const applyBtn = card.querySelector("#applyBtn");
    const accentReset = card.querySelector("#accentReset");

    const s = getState();
    themeSelect.value = s.settings?.theme || "dark";
    accentInput.value = s.settings?.accent || "#7c3aed";

    applyBtn.addEventListener("click", () => {
      const theme = themeSelect.value === "light" ? "light" : "dark";
      const accent = accentInput.value || "#7c3aed";
      setState((st) => {
        st.settings = st.settings || { theme: "dark", accent: "#7c3aed" };
        st.settings.theme = theme;
        st.settings.accent = accent;
        return st;
      });
      toast(`Saved: ${theme}, ${accent}`);
      repaint();
    });

    accentReset.addEventListener("click", () => {
      accentInput.value = "#7c3aed";
      applyBtn.click();
    });

    return card;
  }

  function dataCard() {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-body" style="display:grid;gap:12px">
        <div style="font-weight:900;font-size:16px">Data</div>

        <div class="row wrap" style="gap:10px">
          <button class="btn btn-primary" id="exportBtn" type="button">Backup (Export JSON)</button>
          <button class="btn" id="importBtn" type="button">Restore (Import JSON)</button>
          <button class="btn btn-danger" id="resetBtn" type="button">Reset all data</button>
        </div>

        <div style="color:var(--muted);font-size:12px">
          Backup exports your full Life OS state (tasks, habits, learning, settings).
        </div>
      </div>
    `;

    card.querySelector("#exportBtn").addEventListener("click", exportAll);
    card.querySelector("#importBtn").addEventListener("click", importAll);
    card.querySelector("#resetBtn").addEventListener("click", confirmReset);

    return card;
  }

  function exportAll() {
    const s = getState();
    const data = JSON.stringify(s, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `life-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Backup exported.");
  }

  function importAll() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const next = JSON.parse(text);

        // minimal validation
        if (!next || typeof next !== "object") throw new Error("Invalid JSON.");
        if (!("tasks" in next) && !("habits" in next) && !("topics" in next)) {
          throw new Error("Not a Life OS backup.");
        }

        setState((st) => {
          // Replace the whole state safely (merge with existing defaults already handled by store.load usually)
          return Object.assign(st, next);
        });

        toast("Backup imported.");
        repaint();
        // optional reload to ensure all pages see it
        // location.reload();
      } catch (e) {
        toast(`Import failed: ${e.message}`);
      }
    });
    input.click();
  }

  function confirmReset() {
    openModal({
      title: "Reset all data?",
      content: `<div style="color:var(--muted);font-size:13px">
        This will delete tasks, habits, learning, analytics logs, and settings from this browser.
        <br/><br/>
        Tip: Export a backup first.
      </div>`,
      actions: [
        { label: "Cancel", className: "btn", onClick: (close) => close() },
        {
          label: "Reset",
          className: "btn btn-danger",
          onClick: (close) => {
            resetAllData?.(); // if you have it
            // fallback if store doesn't have resetAllData
            try {
              localStorage.removeItem("life_os_state");
            } catch {}
            close();
            toast("Data reset. Reloading…");
            location.reload();
          },
        },
      ],
    });
  }
}
