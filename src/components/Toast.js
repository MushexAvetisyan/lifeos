let root;

export function initToasts(toastRootEl) {
  root = toastRootEl;
  root.className = "toast-stack";
}

export function toast(message, opts = {}) {
  if (!root) return;

  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;

  const duration = typeof opts.duration === "number" ? opts.duration : 2500;

  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 180ms ease";
    setTimeout(() => el.remove(), 200);
  }, duration);
}
