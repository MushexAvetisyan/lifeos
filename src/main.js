console.log("✅ main.js loaded");

import { startRouter, registerRoute } from "./router.js";
import { getState, subscribe } from "./store.js";
import { Navbar } from "./components/Navbar.js";
import { initToasts, toast } from "./components/Toast.js";
import { initModal } from "./components/Modal.js";

const sidebar = document.querySelector("#sidebar");
const content = document.querySelector("#content");
const pageTitleEl = document.querySelector("#pageTitle");

initToasts(document.querySelector("#toastRoot"));
initModal(document.querySelector("#modalRoot"));

registerRoute("/dashboard", () => import("./pages/dashboard.js"));
registerRoute("/tasks", () => import("./pages/tasks.js"));
registerRoute("/habits", () => import("./pages/habits.js"));
registerRoute("/learning", () => import("./pages/learning.js"));
registerRoute("/analytics", () => import("./pages/analytics.js"));
registerRoute("/settings", () => import("./pages/settings.js"));

applyTheme(getState());
subscribe(applyTheme);

// Sidebar toggle (mobile)
const sidebarToggle = document.querySelector("#sidebarToggle");
sidebarToggle.addEventListener("click", () => {
  sidebar.classList.toggle("is-open");
});

// Quick theme toggle button (topbar)
document.querySelector("#themeToggle").addEventListener("click", () => {
  const s = getState();
  const next = s.settings.theme === "dark" ? "light" : "dark";
  localStorage.setItem("life_os_quick_theme", next); // tiny hint if you want later
  // we update via store to keep it consistent (Settings page also changes it)
  import("./store.js").then(({ setState }) => {
    setState((st) => {
      st.settings.theme = next;
      return st;
    });
    toast(`Theme: ${next}`);
  });
});

startRouter(async ({ path, mod }) => {
  // Close sidebar on navigation (mobile)
  sidebar.classList.remove("is-open");

  // Navbar
  sidebar.innerHTML = "";
  sidebar.appendChild(Navbar({ activePath: path }));

  // Render page
  content.innerHTML = "";
  const title = mod.pageTitle?.() ?? "Life OS";
  pageTitleEl.textContent = title;

  const view = mod.render?.();
  if (view) content.appendChild(view);
  else content.innerHTML = `<div class="card"><div class="card-body">Page missing render()</div></div>`;
});

function applyTheme(state) {
  document.documentElement.dataset.theme = state.settings.theme || "dark";
  document.documentElement.style.setProperty("--accent", state.settings.accent || "#7c3aed");
}
