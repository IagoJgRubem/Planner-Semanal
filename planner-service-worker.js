// Estratégias de cache do Planner Semanal.
//
// - Fontes (fonts/*.woff2): Cache-First em cache dedicado e imutável,
//   pois os arquivos são versionados por nome e nunca mudam de conteúdo.
// - Shell estático (HTML/CSS/JS/ícones/manifest): pré-cache na instalação
//   e Stale-While-Revalidate em tempo de execução.
// - Navegações (documentos): Network-First com fallback ao index.html em
//   cache, garantindo documento fresco quando há rede e offline quando não há.
const STATIC_CACHE = "planner-static-v29";
const FONT_CACHE = "planner-fonts-v1";

const PRECACHE_URLS = [
  "./index.html",
  "./planner.css",
  "./planner-manifest.webmanifest",
  "./planner-icon.svg",
  "./planner-icon-192.png",
  "./planner-icon-512.png",
  "./modules/app.js",
  "./modules/app-config.js",
  "./modules/app-shell.js",
  "./modules/backup-controller.js",
  "./modules/bootstrap.js",
  "./modules/calendar-utils.js",
  "./modules/capacity-reports.js",
  "./modules/daily-agenda.js",
  "./modules/default-schedule.js",
  "./modules/editable-content.js",
  "./modules/file-export.js",
  "./modules/focus-timer.js",
  "./modules/form-dialog.js",
  "./modules/goal-date-tools.js",
  "./modules/goal-reminders.js",
  "./modules/goals-calendar.js",
  "./modules/metrics.js",
  "./modules/planner-navigation.js",
  "./modules/planner-preferences.js",
  "./modules/planner-repositories.js",
  "./modules/planner-ui-state.js",
  "./modules/print-preview.js",
  "./modules/quick-fill.js",
  "./modules/schedule-grid.js",
  "./modules/slot-state.js",
  "./modules/storage.js",
  "./modules/templates-history.js",
];

const FONT_URLS = [
  "./fonts/inter-latin-ext.woff2",
  "./fonts/montserrat-latin-ext.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const staticCache = await caches.open(STATIC_CACHE);
    await staticCache.addAll(PRECACHE_URLS);
    const fontCache = await caches.open(FONT_CACHE);
    await fontCache.addAll(FONT_URLS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key !== STATIC_CACHE && key !== FONT_CACHE).map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

const isFontRequest = (url) =>
  url.origin === self.location.origin && /\.woff2?$/i.test(url.pathname);

const isStaticAssetRequest = (url) =>
  url.origin === self.location.origin &&
  (url.pathname.includes("/modules/") ||
   /\.(css|js|png|svg|ico|webmanifest)$/i.test(url.pathname));

async function cacheFirstFont(request) {
  const cache = await caches.open(FONT_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.ok || response.type === "opaque")) {
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    })
    .catch(() => undefined);
  if (cached) return cached;
  const response = await refresh;
  return response || Response.error();
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put("./index.html", response.clone()).catch(() => {});
    }
    return response;
  } catch {
    return (await cache.match("./index.html")) ||
           (await cache.match(request)) ||
           (await caches.match("./index.html")) ||
           Response.error();
  }
}

async function networkFirstFallback(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok && request.url.startsWith(self.location.origin)) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    return (await cache.match(request)) ||
           (await caches.match("./index.html")) ||
           Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(event.request));
    return;
  }

  if (isFontRequest(url)) {
    event.respondWith(cacheFirstFont(event.request).catch(() => caches.match(event.request)));
    return;
  }

  if (isStaticAssetRequest(url)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  event.respondWith(networkFirstFallback(event.request));
});
