export function Navbar({ activePath }) {
  const wrap = document.createElement("div");

  const title = document.createElement("div");
  title.style.display = "grid";
  title.style.gap = "6px";
  title.style.marginBottom = "14px";
  title.innerHTML = `
    <div style="font-weight:900;font-size:18px">Life OS</div>
    <div style="color:var(--muted);font-size:12px">Dashboard • Productivity • Learning</div>
  `;
  wrap.appendChild(title);

  const navTitle = document.createElement("div");
  navTitle.className = "nav-title";
  navTitle.textContent = "Navigation";
  wrap.appendChild(navTitle);

  const nav = document.createElement("nav");
  nav.className = "nav";

  const links = [
    { path: "/dashboard", label: "Dashboard" },
    { path: "/tasks", label: "Tasks" },
    { path: "/habits", label: "Habits" },
    { path: "/learning", label: "Learning" },
    { path: "/analytics", label: "Analytics" },
    { path: "/settings", label: "Settings" },
  ];

  links.forEach((l) => {
    const a = document.createElement("a");
    a.href = `#${l.path}`;
    a.textContent = l.label;

    if (activePath === l.path) a.classList.add("active");

    nav.appendChild(a);
  });

  wrap.appendChild(nav);

  const help = document.createElement("div");
  help.style.marginTop = "16px";
  help.style.color = "var(--muted)";
  help.style.fontSize = "12px";
  help.innerHTML = `
    Tip: use <span class="kbd">Ctrl</span>+<span class="kbd">K</span> later for command palette.
  `;
  wrap.appendChild(help);

  return wrap;
}
