const CACHE_NAME = "planner-operacional-semanal-v24";
const CORE_ASSETS = [
  "./index.html",
  "./planner.css",
  "./planner-manifest.webmanifest",
  "./planner-icon.svg",
  "./planner-icon-192.png",
  "./planner-icon-512.png",
  "./modules/storage.js",
  "./modules/templates-history.js",
  "./modules/schedule-grid.js",
  "./modules/slot-state.js",
  "./modules/audio-store.js",
  "./modules/app.js",
  "./modules/app-shell.js",
  "./modules/app-config.js",
  "./modules/backup-controller.js",
  "./modules/calendar-utils.js",
  "./modules/capacity-reports.js",
  "./modules/daily-agenda.js",
  "./modules/editable-content.js",
  "./modules/default-schedule.js",
  "./modules/bootstrap.js",
  "./modules/file-export.js",
  "./modules/focus-timer.js",
  "./modules/form-dialog.js",
  "./modules/goals-calendar.js",
  "./modules/goal-date-tools.js",
  "./modules/goal-reminders.js",
  "./modules/metrics.js",
  "./modules/print-preview.js",
  "./modules/planner-repositories.js",
  "./modules/planner-ui-state.js",
  "./modules/planner-navigation.js",
  "./modules/planner-preferences.js",
  "./modules/quick-fill.js",
  "./fonts/inter-latin-ext.woff2",
  "./fonts/montserrat-latin-ext.woff2"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then((response) => {
      if (response.ok) return response;
      return caches.match(new URL("./index.html", self.registration.scope).href);
    }).catch(() => caches.match(new URL("./index.html", self.registration.scope).href)));
    return;
  }
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    if (response && response.status === 200 && response.type === "basic" && new URL(event.request.url).origin === self.location.origin) {
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match(new URL("./index.html", self.registration.scope).href))));
});
