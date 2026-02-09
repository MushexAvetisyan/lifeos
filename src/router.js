const routes = new Map();

export function registerRoute(path, loader) {
  routes.set(path, loader); // loader: async () => module or function
}

export function getCurrentPath() {
  const hash = location.hash || "#/dashboard";
  const path = hash.replace(/^#/, "");
  return path.startsWith("/") ? path : `/${path}`;
}

export async function resolveRoute() {
  const path = getCurrentPath();
  const loader = routes.get(path) || routes.get("/dashboard");
  const mod = await loader();
  return { path, mod };
}

export function startRouter(onRoute) {
  const handle = async () => onRoute(await resolveRoute());
  window.addEventListener("hashchange", handle);
  handle();
}
