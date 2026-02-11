// src/pages/search.js
import { buildResultsUI } from "../components/searchEverywhere.js";

export function pageTitle() {
    return "Search";
}

export function render() {
    const root = document.createElement("div");
    root.className = "grid";
    root.style.gap = "12px";

    const q = getQueryFromHash();

    const head = document.createElement("div");
    head.className = "card";
    head.innerHTML = `
    <div class="card-body row space-between wrap" style="align-items:flex-start">
      <div style="display:grid;gap:6px">
        <div style="font-weight:900;font-size:16px">Search results</div>
        <div style="color:var(--muted);font-size:12px">${q ? `Query: "${escapeHTML(q)}"` : "Type in the top search box."}</div>
      </div>
      <div class="row wrap">
        <button class="btn btn-ghost" id="backBtn" type="button">Back</button>
      </div>
    </div>
  `;
    head.querySelector("#backBtn").addEventListener("click", () => history.back());
    root.appendChild(head);

    if (!q) return root;

    const { body } = buildResultsUI(q, { limitPerGroup: 25 });
    root.appendChild(body);

    return root;
}

function getQueryFromHash() {
    // expects: #/search?q=...
    const hash = String(location.hash || "");
    const qIndex = hash.indexOf("?q=");
    if (qIndex === -1) return "";
    const raw = hash.slice(qIndex + 3);
    try { return decodeURIComponent(raw.replace(/\+/g, "%20")); } catch { return raw; }
}

function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]
    ));
}
