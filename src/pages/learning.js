export function pageTitle() { return "Learning"; }

export function render() {
  const root = document.createElement("div");
  root.className = "card";
  root.innerHTML = `
    <div class="card-body">
      <div style="font-weight:800;font-size:16px">Learning</div>
      <div style="color:var(--muted);font-size:13px;margin-top:10px">
        Topics → Lessons → Completion tracking. Flashcards later.
      </div>
    </div>
  `;
  return root;
}
