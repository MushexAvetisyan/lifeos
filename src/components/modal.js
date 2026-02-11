let root;

export function initModal(modalRootEl) {
  root = modalRootEl;
}

export function openModal({ title = "Modal", content, actions = [] }) {
  if (!root) return;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  const header = document.createElement("div");
  header.className = "modal-header";
  header.innerHTML = `
    <div class="row space-between">
      <strong>${escapeHTML(title)}</strong>
      <button class="btn btn-ghost" type="button" aria-label="Close">✕</button>
    </div>
  `;
  header.querySelector("button").addEventListener("click", close);

  const body = document.createElement("div");
  body.className = "modal-body";
  if (typeof content === "string") body.innerHTML = content;
  else body.appendChild(content);

  const footer = document.createElement("div");
  footer.style.padding = "0 14px 14px 14px";
  footer.className = "row wrap";
  actions.forEach((a) => {
    const b = document.createElement("button");
    b.className = a.className || "btn";
    b.type = "button";
    b.textContent = a.label;
    b.addEventListener("click", () => a.onClick?.(close));
    footer.appendChild(b);
  });

  modal.appendChild(header);
  modal.appendChild(body);
  if (actions.length) modal.appendChild(footer);

  backdrop.appendChild(modal);
  root.appendChild(backdrop);

  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  window.addEventListener("keydown", onKey);

  function close() {
    window.removeEventListener("keydown", onKey);
    backdrop.remove();
  }

  return close;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]
  ));
}
