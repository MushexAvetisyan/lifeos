export function pageTitle() { return "Analytics"; }

export function render() {
  const root = document.createElement("div");
  root.className = "card";
  root.innerHTML = `
    <div class="card-body">
      <div style="font-weight:800;font-size:16px">Analytics</div>
      <div style="color:var(--muted);font-size:13px;margin-top:10px">
        Simple charts (no library) coming after tasks/habits/learning store real data.
      </div>
    </div>
  `;
  return root;
}
