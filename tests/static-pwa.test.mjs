import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createBackupController } from "../modules/backup-controller.js";
import { createJSONStore, loadPlanner, createDebouncedPersist, PLANNER_STORAGE_KEYS } from "../modules/storage.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = async (file) => readFile(path.join(projectRoot, file), "utf8");

test("o HTML é declarativo, instalável e carrega a entrada externa", async () => {
  const [index, app, shell, pkg] = await Promise.all([
    source("index.html"), source("modules/app.js"), source("modules/app-shell.js"), source("package.json"),
  ]);
  assert.match(index, /<title>Planner Semanal<\/title>/);
  assert.match(index, /<script type="module" src="\.\/modules\/app\.js"><\/script>/);
  assert.doesNotMatch(index, /<script type="module">/);
  assert.match(index, /<link rel="manifest" href="\.\/planner-manifest\.webmanifest">/);
  assert.match(index, /<meta name="theme-color" content="#fffefa">/);
  assert.match(app, /from "\.\/app-shell\.js"/);
  assert.match(app, /getPlannerElements\(\)/);
  assert.match(shell, /export function getPlannerElements/);
  assert.match(shell, /export function startPlanner/);
  assert.match(pkg, /"type": "module"/);
});

test("o escopo é operacional e não contém blocos acadêmicos", async () => {
  const [index, css, app] = await Promise.all([source("index.html"), source("planner.css"), source("modules/app.js")]);
  const combined = `${index}\n${css}\n${app}`;
  [
    /revis[aã]o espa[çc]ada/i,
    /spaced repetition/i,
    /m[eé]todo de estud/i,
    /\bestud/i,
    /flashcard/i,
    /mat[eé]ria/i,
    /\bprova\b/i,
    /nota acad[eê]mica/i,
    /semestre/i,
  ].forEach((pattern) => assert.doesNotMatch(combined, pattern));
});

test("a navegação usa três abas e organiza perfil, métricas e ajustes", async () => {
  const index = await source("index.html");
  assert.match(index, /class="tab-switcher"/);
  assert.match(index, /data-tab="agenda"[^>]*>Agenda</);
  assert.match(index, /data-tab="tracking"[^>]*>Métricas</);
  assert.match(index, /data-tab="settings"[^>]*>Perfil &amp; Ajustes</);
  assert.match(index, /class="ghost-action"[^>]*>Imprimir \/ Prévia A4</);
  assert.match(index, /id="panel-agenda"/);
  assert.match(index, /id="panel-tracking"[^>]*hidden/);
  assert.match(index, /id="panel-settings"[^>]*hidden/);
  const agendaAt = index.indexOf('id="panel-agenda"');
  const trackingAt = index.indexOf('id="panel-tracking"');
  const settingsAt = index.indexOf('id="panel-settings"');
  assert.ok(agendaAt > -1 && trackingAt > agendaAt && settingsAt > trackingAt);
  ["capacity-content", "streak-indicator", "monthly-goals-list", "monthly-calendar", "history-list"].forEach((id) => {
    const at = index.indexOf(`id="${id}"`);
    assert.ok(at > trackingAt && at < settingsAt, `${id} deve ficar dentro da aba Métricas`);
  });
  ["adherence-value", "adherence-ring", "adherence-note", "category-chart"].forEach((id) => {
    const at = index.indexOf(`id="${id}"`);
    assert.ok(at > trackingAt && at < settingsAt, `${id} deve ficar dentro da aba Métricas`);
  });
  assert.ok(index.indexOf('id="schedule-grid"') < trackingAt, "a grade semanal deve ficar na aba Agenda");
  ["profile-avatar-button", "profile-photo-input", "profile-photo-remove", "pref-theme", "pref-hide-empty", "template-select", "backup-field"].forEach((id) => {
    const at = index.indexOf(`id="${id}"`);
    assert.ok(at > settingsAt, `${id} deve ficar dentro da aba Perfil & Ajustes`);
  });
  assert.match(index, /<details id="backup-details"/);
  assert.match(index, /id="week-meta-title"/);
  assert.match(index, /id="week-meta-range"/);
  assert.match(index, /placeholder="Ex: Treinar 4x na semana"/);
  assert.match(index, /class="print-footer print-only"/);
  assert.doesNotMatch(index, /mobile-bottom-bar/);
  assert.doesNotMatch(index, /id="acompanhamento"/);
});

test("a exibição em tela usa cartões, tipografia 16px e barra de progresso diária", async () => {
  const [index, css] = await Promise.all([source("index.html"), source("planner.css")]);
  assert.equal((index.match(/class="day-card"/g) || []).length, 7);
  assert.equal((index.match(/class="day-progress"/g) || []).length, 7);
  assert.equal((index.match(/class="period-add"/g) || []).length, 21);
  assert.match(css, /html \{ font-size: 16px; \}/);
  assert.match(css, /input, button, select, textarea \{ font: inherit; font-size: 1rem;/);
  assert.match(css, /input, select, textarea \{ max-width: 100%; \}/);
  assert.match(css, /\.row-actions input:not\(\[type="checkbox"\]\), \.row-actions select \{/);
  assert.match(css, /--ink: #1d1d24;/);
  assert.match(css, /--ink-body: #2b2b33;/);
  assert.match(css, /--muted: #5b5b66;/);
  assert.match(css, /--line: #e7e7ee;/);
  assert.match(css, /--select-ring: #2563eb;/);
  assert.match(css, /@media screen and \(max-width: 1099px\)/);
  assert.match(css, /\.day-card \{[^}]*border-radius: var\(--radius-lg\)/);
  assert.match(css, /\.day-card \{[^}]*box-shadow: var\(--shadow-rest\)/);
  assert.match(css, /\.day-card:hover \{ transform: translateY\(-3px\)/);
  assert.match(css, /\.day-card:active \{ transform:/);
  assert.match(css, /\.day-card\.is-selected-day \{ outline: 2px solid var\(--select-ring\)/);
  assert.match(css, /\.day-progress-bar \{[^}]*width: var\(--progress, 0%\)/);
  assert.match(css, /transition: width 0\.35s ease/);
  assert.match(css, /\.schedule-slot\.is-empty \{ display: none; \}/);
  assert.match(css, /\.day-period\.is-full \.period-add \{ display: none; \}/);
  assert.match(css, /\.day-card\.is-today \{ border-top: 3px solid var\(--accent\); \}/);
  assert.match(css, /\.side-tools \{[^}]*position: sticky;/);
});

test("a tipografia segue a escala editorial com fontes locais", async () => {
  const css = await source("planner.css");
  assert.match(css, /@font-face \{\s*font-family: "Inter";/);
  assert.match(css, /@font-face \{\s*font-family: "Montserrat";/);
  assert.match(css, /src: url\("\.\/fonts\/inter-latin-ext\.woff2"\)/);
  assert.match(css, /src: url\("\.\/fonts\/montserrat-latin-ext\.woff2"\)/);
  assert.match(css, /font-family: "Inter", "Segoe UI", system-ui/);
  assert.match(css, /font-family: var\(--font-display\);/);
  assert.match(css, /--font-display: "Playfair Display"/);
  assert.match(css, /h2 \{ font-size: 1\.125rem; font-weight: 600; letter-spacing: -0\.02em;/);
  assert.match(css, /h3 \{ font-size: 0\.75rem; font-weight: 600;/);
  assert.match(css, /\.slot-text \{[^}]*font-size: 0\.875rem;/);
  assert.match(css, /\.slot-text \{[^}]*color: var\(--ink-body\);/);
});

test("o bloco @media print preserva a grade editorial A4 paisagem em folha única", async () => {
  const css = await source("planner.css");
  const printBlock = css.slice(css.indexOf("@media print"));
  assert.ok(printBlock.includes("@media print"));
  assert.match(printBlock, /@page \{ size: A4 landscape; margin: 8mm; \}/);
  assert.match(printBlock, /html, body \{ height: 100%; overflow: hidden;/);
  assert.match(printBlock, /height: 166mm/);
  assert.match(printBlock, /max-height: 166mm/);
  assert.match(printBlock, /break-inside: avoid/);
  assert.match(printBlock, /page-break-inside: avoid/);
  assert.match(printBlock, /grid-template-columns: repeat\(7, 1fr\) !important/);
  assert.match(printBlock, /\.schedule-grid\[data-mobile-day\] \.day-card \{ display: flex !important; \}/);
  assert.match(printBlock, /font-family: Georgia/);
  assert.match(printBlock, /button, select, textarea, input \{ display: none !important; \}/);
  assert.match(printBlock, /#panel-tracking/);
  assert.match(printBlock, /\.day-progress/);
  assert.match(printBlock, /\.schedule-slot \{ display: flex !important;/);
  assert.match(printBlock, /\.slot-text \{ font-size: 8\.5pt; border-bottom: 0\.4pt solid #333;/);
  assert.match(printBlock, /\.print-footer/);
  assert.match(printBlock, /\.print-priorities/);
  assert.match(printBlock, /\.print-box \{ display: inline-block; width: 3\.5mm; height: 3\.5mm;/);
  assert.match(printBlock, /transition: none !important/);
});

test("diálogos usam o elemento dialog sem janelas nativas", async () => {
  const [index, app] = await Promise.all([source("index.html"), source("modules/app.js")]);
  assert.match(index, /<dialog id="planner-dialog">/);
  ["dialog-title", "dialog-detail", "dialog-fields", "dialog-submit", "dialog-cancel"].forEach((id) =>
    assert.match(index, new RegExp(`id="${id}"`)));
  assert.match(app, /dialogElement\.showModal\(\)/);
  assert.match(app, /modal\.open\(/);
  assert.match(app, /modal\.confirm\(/);
  assert.doesNotMatch(app, /window\.(prompt|confirm)\(/);
});

test("a composição centraliza seletores no app-shell", async () => {
  const [app, shell] = await Promise.all([source("modules/app.js"), source("modules/app-shell.js")]);
  [
    "saveStatus", "tabButtons", "panels", "weekPicker", "printWeekRange", "weekMetaTitle", "weekMetaRange",
    "mobileTabs", "grid", "templateSelect",
    "prioritySummary", "agendaList", "agendDateLabel", "agendaSummary", "capacityContent", "streakIndicator",
    "adherenceValue", "adherenceFill", "adherenceBar", "adherenceNote", "categoryChart",
    "goalsList", "calendarTitle", "calendarGrid", "historyList", "profileAvatar", "profileSummary",
    "backupField", "backupStatus", "focusClock",
    "dialogElement", "dialogTitle", "dialogDescription", "dialogForm", "dialogFields", "dialogSubmit", "dialogCancel",
  ].forEach((key) => assert.match(shell, new RegExp(`\\b${key}:`)));
  assert.match(app, /function rangesOverlap\(/);
  assert.doesNotMatch(app, /rangesOverlap,/);
  assert.match(app, /from "\.\/calendar-utils\.js"/);
  assert.match(app, /mondayFromWeekValue,/);
});

test("perfil, preferências e dia reduzido são persistidos e aplicados", async () => {
  const app = await source("modules/app.js");
  ["getProfile", "saveProfile", "getPrefs", "savePrefs", "applyTheme", "initialsFor", "renderProfile", "syncEmptySlots"]
    .forEach((symbol) => assert.match(app, new RegExp(`function ${symbol}\\(`)));
  assert.match(app, /function resizeImageForAvatar\(/);
  assert.match(app, /function applyProfilePhoto\(/);
  assert.match(app, /profile-avatar-button/);
  assert.match(app, /profile-photo-input/);
  assert.match(app, /profile-photo-remove/);
  assert.match(app, /KEY\.profile/);
  assert.match(app, /KEY\.prefs/);
  assert.match(app, /theme-dark/);
  assert.match(app, /theme-eink/);
  assert.match(app, /pref-hide-empty/);
});

test("métricas calculam aderência e distribuição por categoria", async () => {
  const app = await source("modules/app.js");
  ["renderAdherence", "renderCategoryChart", "refreshMetrics", "categorizeEntryText"]
    .forEach((symbol) => assert.match(app, new RegExp(`function ${symbol}\\(`)));
  assert.match(app, /CATEGORY_LABELS/);
  assert.match(app, /Trabalho/);
  assert.match(app, /Saúde/);
  assert.match(app, /Pessoal/);
  assert.match(app, /function weekRangeLabel\(/);
  assert.match(app, /Semana \$\{Number\(match\[2\]\)\} · \$\{match\[1\]\}/);
});

test("o estado de UI preserva a interface pública", async () => {
  const uiState = await source("modules/planner-ui-state.js");
  assert.match(uiState, /export function createPlannerUiState/);
  assert.match(uiState, /root\.querySelectorAll\("\[data-priority\]"\)/);
});

test("métricas e persistência preservam interfaces conhecidas", async () => {
  const [metrics, storage] = await Promise.all([source("modules/metrics.js"), source("modules/storage.js")]);
  assert.match(metrics, /renderWeeklyLoad/);
  assert.match(storage, /writeText/);
  assert.match(storage, /remove\(key\)/);
});

test("domínios conhecidos preservam exportações públicas", async () => {
  const checks = [
    ["modules/daily-agenda.js", "createDailyAgendaController"],
    ["modules/bootstrap.js", "bootstrapPlanner"],
    ["modules/app-shell.js", "getPlannerElements"],
    ["modules/calendar-utils.js", "weekValueForDate"],
    ["modules/calendar-utils.js", "mondayFromWeekValue"],
    ["modules/print-preview.js", "openPrintPreview"],
    ["modules/print-preview.js", "closePrintPreview"],
    ["modules/quick-fill.js", "applyQuickFillPreset"],
    ["modules/planner-ui-state.js", "createPlannerUiState"],
    ["modules/backup-controller.js", "createBackupController"],
  ];
  for (const [file, symbol] of checks) assert.match(await source(file), new RegExp(`\\b${symbol}\\b`));
});

test("backup serializa o payload atual e oferece cópia com fallback", async () => {
  const backup = await source("modules/backup-controller.js");
  assert.match(backup, /field\.value = value/);
  assert.match(backup, /navigator\.clipboard\?\.writeText\(value\)/);
  assert.match(backup, /Clipboard indisponível/);
  assert.match(backup, /window\.setTimeout/);
});

test("a cópia de backup envia exatamente o payload atual à área de transferência", async () => {
  const originalNavigator = globalThis.navigator;
  const originalWindow = globalThis.window;
  let copied = "";
  const field = { value: "", focus() {}, select() {} };
  const messages = [];
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { clipboard: { writeText: async (value) => { copied = value; } } },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { setTimeout, clearTimeout },
  });
  try {
    const controller = createBackupController({
      storage: { getItem: () => null, setItem() {}, removeItem() {} },
      app: "planner-operacional-semanal",
      version: 3,
      storageKeys: ["planner"],
      collectSnapshot: () => ({ planner: { monday: "Rotina 40m" } }),
      restoreSnapshot: () => ({}),
      field,
      download() {},
      status: (message) => messages.push(message),
    });
    await controller.copy();
    assert.equal(copied, field.value);
    assert.deepEqual(JSON.parse(copied).snapshot, { planner: { monday: "Rotina 40m" } });
    assert.deepEqual(messages, ["Backup consolidado copiado."]);
  } finally {
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: originalNavigator });
    Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  }
});

test("o service worker aplica a estratégia de cache v30 por tipo de recurso", async () => {
  const worker = await source("planner-service-worker.js");
  assert.match(worker, /planner-static-v30/);
  assert.match(worker, /planner-fonts-v1/);
  assert.match(worker, /cacheFirstFont/);
  assert.match(worker, /staleWhileRevalidate/);
  assert.match(worker, /networkFirstNavigation/);
  [
    "./modules/app.js", "./modules/app-shell.js", "./modules/planner-ui-state.js",
    "./modules/backup-controller.js", "./modules/calendar-utils.js",
    "./fonts/inter-latin-ext.woff2", "./fonts/montserrat-latin-ext.woff2",
  ].forEach((asset) => assert.match(worker, new RegExp(asset.replaceAll(".", "\\."))));
});

function memoryStorage(initial = {}) {
  const mem = new Map(Object.entries(initial));
  return {
    getItem: (key) => (mem.has(key) ? mem.get(key) : null),
    setItem: (key, value) => mem.set(key, value),
    removeItem: (key) => mem.delete(key),
  };
}

function installBackupController({ version, storage }) {
  return createBackupController({
    storage,
    app: "planner-operacional-semanal",
    version,
    storageKeys: ["planner"],
    collectSnapshot: () => ({ planner: { monday: "Rotina 40m" } }),
    restoreSnapshot: (snapshot) => ({ planner: JSON.stringify(snapshot.planner ?? {}) }),
    field: { value: "", focus() {}, select() {} },
    download() {},
    status: () => {},
  });
}

test("loadPlanner tolera JSON corrompido e remove o dado inválido", () => {
  const storage = memoryStorage({ planner: "{planner-corrompido" });
  const doc = loadPlanner(storage, PLANNER_STORAGE_KEYS.planner);
  assert.deepEqual(doc, { fields: {}, checks: {}, checklist: {}, priorities: {} });
  assert.equal(storage.getItem(PLANNER_STORAGE_KEYS.planner), null);
});

test("loadPlanner preserva campos válidos e descarta subcampos inválidos", () => {
  const storage = memoryStorage({
    planner: JSON.stringify({ fields: { slot: "ok" }, checks: "não-é-objeto", checklist: { a: true }, priorities: "corrompido" }),
  });
  const doc = loadPlanner(storage, PLANNER_STORAGE_KEYS.planner);
  assert.deepEqual(doc, {
    fields: { slot: "ok" },
    checks: {},
    checklist: { a: true },
    priorities: {},
  });
});

test("o backup rejeita versões superiores à atual sem restaurar dados", async () => {
  const storage = memoryStorage({ planner: "{}" });
  const controller = installBackupController({ version: 3, storage });
  await assert.rejects(
  () => controller.restore({ app: "planner-operacional-semanal", version: 4, data: { planner: "{}" } }, "planner.backup-consolidated"),
    /Backup de versão mais recente/,
  );
  assert.equal(storage.getItem("planner"), "{}");
});

test("o debounce de 350 ms serializa o plannerDoc em uma única escrita", async () => {
  const storage = memoryStorage();
  let writes = 0;
  const writePlanner = () => { writes += 1; storage.setItem(PLANNER_STORAGE_KEYS.planner, JSON.stringify({ fields: { a: "x" } })); };
  const debounced = createDebouncedPersist(writePlanner, 350, globalThis);
  debounced();
  debounced();
  debounced();
  assert.equal(storage.getItem(PLANNER_STORAGE_KEYS.planner), null);
  await new Promise((resolve) => setTimeout(resolve, 460));
  assert.equal(writes, 1);
  assert.deepEqual(JSON.parse(storage.getItem(PLANNER_STORAGE_KEYS.planner)), { fields: { a: "x" } });
});

test("o fallback de cota redireciona gravação volumosa ao IndexedDB", async () => {
  const idbSaved = new Map();
  const idb = {
    save: async (key, value) => idbSaved.set(key, value),
    load: async (key) => idbSaved.get(key),
    remove: async (key) => idbSaved.delete(key),
  };
  const apontadores = new Map();
  const failingStorage = {
    getItem: () => null,
    getApontador: (key) => apontadores.get(key) ?? null,
    setItem: (key, value) => {
      if (String(value).length > 100) throw Object.assign(new Error("QuotaExceededError"), { name: "QuotaExceededError" });
      apontadores.set(key, value);
      return value;
    },
    removeItem: () => {},
  };
  const store = createJSONStore(failingStorage, { idb, quotaKeys: new Set(["planner.history"]) });
  const value = { semana: "2026-W34", itens: "x".repeat(500) };
  assert.equal(store.write("planner.history", value), value);
  assert.equal(failingStorage.getItem("planner.history"), null);
  assert.equal(failingStorage.getApontador?.("planner.history"), "idb:planner.history");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(idbSaved.get("planner.history"), JSON.stringify(value));
});

test("chaves não volumosas mantêm gravação normal no localStorage", () => {
  const saved = new Map();
  const store = createJSONStore({
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
    removeItem: (key) => saved.delete(key),
  });
  const value = { a: 1 };
  store.write("planner", value);
  assert.equal(JSON.parse(saved.get("planner")).a, 1);
});

test("o import lazy de métricas é disparado somente na ativação da aba", async () => {
  const app = await source("modules/app.js");
  assert.match(app, /let metricsBundleLoaded = false;/);
  assert.match(app, /if \(name === "tracking"\) maybeLoadMetricsBundle\(\);/);
  assert.match(app, /import\("\.\/metrics-lazy\.js"\)/);
  const lazyModule = await import("../modules/metrics-lazy.js");
  assert.equal(typeof lazyModule.loadMetricsEnhancements, "function");
  assert.deepEqual(await lazyModule.loadMetricsEnhancements(), { loaded: true, label: "Métricas avançadas disponíveis" });
});

test("toggleDoneClass alterna is-done no slot sem percorrer a lista toda", async () => {
  const uiState = await source("modules/planner-ui-state.js");
  assert.match(uiState, /const toggleDoneClass = \(element, done\) => \{/);
  assert.match(uiState, /toggleDoneClass,/);
});