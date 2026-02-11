export function Widget({ title, subtitle = "", actions = [], body }) {
  const card = document.createElement("div");
  card.className = "card";

  const head = document.createElement("div");
  head.className = "card-header";

  const row = document.createElement("div");
  row.className = "row space-between";

  const left = document.createElement("div");
  left.innerHTML = `
    <div class="card-title">${escapeHTML(title)}</div>
    ${subtitle ? `<div style="font-size:12px;color:var(--muted);margin-top:6px">${escapeHTML(subtitle)}</div>` : ""}
  `;

  const right = document.createElement("div");
  right.className = "row wrap";
  actions.forEach((a) => {
    const btn = document.createElement("button");
    btn.className = a.className || "btn btn-ghost";
    btn.type = "button";
    btn.textContent = a.label;
    btn.addEventListener("click", a.onClick);
    right.appendChild(btn);
  });

  row.appendChild(left);
  row.appendChild(right);
  head.appendChild(row);

  const content = document.createElement("div");
  content.className = "card-body";
  if (typeof body === "string") content.innerHTML = body;
  else content.appendChild(body);

  card.appendChild(head);
  card.appendChild(content);
  return card;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]
  ));
}
