import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createBackupController } from "../modules/backup-controller.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = async (file) => readFile(path.join(projectRoot, file), "utf8");

test("o HTML é declarativo e carrega a entrada externa", async () => {
  const [index, app, shell] = await Promise.all([source("index.html"), source("modules/app.js"), source("modules/app-shell.js")]);
  assert.match(index, /<script type="module" src="\.\/modules\/app\.js"><\/script>/);
  assert.doesNotMatch(index, /<script type="module">/);
  assert.match(app, /from "\.\/app-shell\.js"/);
  assert.match(app, /startPlanner\(\{/);
  assert.match(shell, /export function getPlannerElements/);
  assert.match(shell, /export function startPlanner/);
  assert.match(await source("package.json"), /"type": "module"/);
});

test("a entrada conecta os controladores de domínio", async () => {
  const app = await source("modules/app.js");
  [
    "createDailyAgendaController", "createMetricsController", "createCapacityReports", "createGoalsCalendarController",
    "createFormDialog", "createScheduleGridController", "createPlannerNavigation", "createGoalRemindersController",
    "createSlotStateController", "createPlannerPreferences", "createTemplatesHistoryController",
  ].forEach((symbol) => assert.match(app, new RegExp(symbol)));
  assert.match(app, /const plannerRoot = document\.querySelector\("\.planner-page"\)/);
  assert.match(app, /scheduleRoot: grid/);
  assert.doesNotMatch(app, /function (agendaAnalysis|agendaEntry|addDailyAgendaItem|renderWeeklyCapacity|renderCalendar)\(/);
});

test("métricas e persistência ignoram a cópia da pré-visualização A4", async () => {
  const [app, metrics, uiState] = await Promise.all([source("modules/app.js"), source("modules/metrics.js"), source("modules/planner-ui-state.js")]);
  assert.doesNotMatch(app, /planner-paper/);
  assert.match(metrics, /scheduleRoot = document/);
  assert.match(metrics, /scheduleRoot\.querySelectorAll/);
  assert.match(uiState, /root\.querySelectorAll\("\[data-priority\]"\)/);
});

test("a composição móvel usa duas colunas, barra inferior e menu compacto", async () => {
  const [index, bootstrap, css] = await Promise.all([source("index.html"), source("modules/bootstrap.js"), source("planner.css")]);
  assert.match(index, /class="mobile-bottom-bar"/);
  assert.match(index, /id="mobile-tools-dialog"/);
  assert.match(index, /id="mobile-menu-open"/);
  assert.match(index, /data-mobile-quick-fill="study"/);
  assert.match(bootstrap, /syncMobileToolPlacement/);
  assert.match(bootstrap, /mobileToolsDialog\?\.showModal\(\)/);
  assert.match(bootstrap, /data-mobile-proxy/);
  assert.match(await source("modules/app-shell.js"), /mobileQuickFillSelection/);
  assert.match(css, /grid-template-columns: 4\.25rem minmax\(0, 1fr\)/);
  assert.match(css, /\.day-heading, \.schedule-slot \{ grid-column: 2 !important; \}/);
  assert.match(css, /\.mobile-bottom-bar \{ position: fixed/);
  assert.match(css, /padding-bottom: calc\(6\.5rem \+ env\(safe-area-inset-bottom\)\) !important/);
  assert.match(css, /max-height: min\(80dvh, 38rem\)/);
  assert.match(css, /grid-template-columns: 4\.25rem minmax\(0, 1fr\)/);
  assert.match(css, /#toggle-theme, \.mobile-tools-slot \.utility-tools #export-backup/);
  assert.match(css, /\.backup-paste-tools textarea/);
  assert.match(css, /overscroll-behavior: contain/);
  assert.match(css, /\.planner-toolbar \{ display: none; \}/);
});

test("a prévia A4 restaura a grade completa e isola a barra móvel", async () => {
  const [printPreview, css] = await Promise.all([source("modules/print-preview.js"), source("planner.css")]);
  assert.match(printPreview, /previewGrid\?\.removeAttribute\("data-mobile-day"\)/);
  assert.match(printPreview, /setProperty\("grid-column", String\(column\), "important"\)/);
  assert.match(printPreview, /setProperty\("display", "flex", "important"\)/);
  assert.match(printPreview, /slot\.classList\.contains\("is-continuation"\)/);
  assert.match(css, /min-width: 281mm !important/);
  assert.match(css, /max-width: none !important/);
  assert.match(css, /\.print-preview-document \.schedule-grid \{ display: grid !important/);
  assert.match(css, /\.print-preview-document \.schedule-slot\.is-continuation \{ display: none !important; \}/);
  assert.match(css, /\.print-preview-stage::after/);
  assert.match(css, /body\.is-print-preview-open \.mobile-bottom-bar \{ display: none !important; \}/);
  assert.match(css, /\.print-preview-document \.mobile-day-tabs \{ display: none !important; \}/);
  assert.match(css, /width: 3\.5mm !important; height: 3\.5mm !important/);
  assert.match(css, /overflow-x: auto !important; overflow-y: auto !important/);
});

test("agenda e metas usam o modal reutilizável sem diálogos nativos", async () => {
  const [index, app, agenda, goals, modal] = await Promise.all([
    source("index.html"), source("modules/app.js"), source("modules/daily-agenda.js"), source("modules/goals-calendar.js"), source("modules/form-dialog.js"),
  ]);
  assert.match(index, /<dialog class="planner-dialog"/);
  assert.match(app, /createFormDialog\(/);
  assert.match(app, /modal: plannerDialog/);
  assert.match(agenda, /modal\.open\(/);
  assert.match(agenda, /modal\.confirm\(/);
  assert.match(goals, /modal\.confirm\(/);
  assert.doesNotMatch(`${agenda}\n${goals}`, /window\.(prompt|confirm)/);
  assert.match(modal, /element\.showModal\(\)/);
});

test("backup serializa o payload atual e oferece cópia com fallback", async () => {
  const backup = await source("modules/backup-controller.js");
  assert.match(backup, /field\.value = value/);
  assert.match(backup, /navigator\.clipboard\?\.writeText\(value\)/);
  assert.match(backup, /Clipboard indisponível/);
  assert.match(backup, /window\.setTimeout\(\(\) => reject/);
  assert.match(backup, /field\.select\(\)/);
  assert.match(backup, /document\.execCommand\("copy"\)/);
  assert.match(backup, /Backup consolidado copiado\./);
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
      collectSnapshot: () => ({ planner: { monday: "Estudo 40m" } }),
      restoreSnapshot: () => ({}),
      field,
      download() {},
      status: (message) => messages.push(message),
    });
    await controller.copy();
    assert.equal(copied, field.value);
    assert.deepEqual(JSON.parse(copied).snapshot, { planner: { monday: "Estudo 40m" } });
    assert.deepEqual(messages, ["Backup consolidado copiado."]);
  } finally {
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: originalNavigator });
    Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  }
});

test("os dados padrão e a composição são módulos independentes", async () => {
  const [app, defaults, config, shell] = await Promise.all([
    source("modules/app.js"), source("modules/default-schedule.js"), source("modules/app-config.js"), source("modules/app-shell.js"),
  ]);
  assert.match(app, /from "\.\/default-schedule\.js"/);
  assert.match(app, /from "\.\/app-config\.js"/);
  assert.match(app, /from "\.\/app-shell\.js"/);
  assert.match(defaults, /export const defaults/);
  assert.match(config, /export const storageKeys/);
  assert.match(shell, /export function getPlannerElements/);
});

test("os domínios extraídos preservam interfaces públicas", async () => {
  const checks = [
    ["modules/editable-content.js", "activatePlannerEditing"], ["modules/planner-repositories.js", "createPlannerRepositories"],
    ["modules/planner-ui-state.js", "createPlannerUiState"], ["modules/goal-date-tools.js", "createGoalDateTools"],
    ["modules/templates-history.js", "createTemplatesHistoryController"], ["modules/schedule-grid.js", "createScheduleGridController"],
    ["modules/planner-navigation.js", "createPlannerNavigation"], ["modules/goal-reminders.js", "createGoalRemindersController"],
    ["modules/slot-state.js", "createSlotStateController"], ["modules/planner-preferences.js", "createPlannerPreferences"],
  ];
  for (const [file, symbol] of checks) assert.match(await source(file), new RegExp(`export function ${symbol}`));
});

test("o cache offline v24 inclui a entrada, os módulos e as fontes locais", async () => {
  const worker = await source("planner-service-worker.js");
  [
    "./modules/app.js", "./modules/app-shell.js", "./modules/daily-agenda.js", "./modules/capacity-reports.js", "./modules/goals-calendar.js",
    "./modules/metrics.js", "./modules/backup-controller.js", "./modules/focus-timer.js", "./modules/form-dialog.js", "./modules/default-schedule.js",
    "./modules/editable-content.js", "./modules/planner-repositories.js", "./modules/planner-ui-state.js", "./modules/goal-date-tools.js",
    "./modules/templates-history.js", "./modules/schedule-grid.js", "./modules/planner-navigation.js", "./modules/goal-reminders.js",
    "./modules/slot-state.js", "./modules/planner-preferences.js", "./fonts/inter-latin-ext.woff2", "./fonts/montserrat-latin-ext.woff2",
  ].forEach((asset) => assert.match(worker, new RegExp(asset.replaceAll(".", "\\."))));
  assert.match(worker, /planner-operacional-semanal-v24/);
});

test("o PWA permanece autônomo e sem fontes externas", async () => {
  const [index, app, css] = await Promise.all([source("index.html"), source("modules/app.js"), source("planner.css")]);
  assert.doesNotMatch(`${index}\n${app}\n${css}`, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.match(css, /\.\/fonts\/inter-latin-ext\.woff2/);
  assert.match(css, /\.\/fonts\/montserrat-latin-ext\.woff2/);
});

test("a barra desktop agrupa controles horizontalmente e oculta o backup bruto", async () => {
  const css = await source("planner.css");
  assert.match(css, /@media screen and \(min-width: 921px\)/);
  assert.match(css, /\.planner-toolbar \{ display: flex !important; align-items: center !important; justify-content: space-between !important/);
  assert.match(css, /\.routine-tools-body, \.control-set, \.category-controls, \.planner-utilities \{ display: flex !important; flex-direction: row !important/);
  assert.match(css, /\.backup-paste-tools \{ display: none !important; \}/);
  assert.match(css, /#archive-week \{ min-height: 1\.8rem !important/);
});

test("o acompanhamento fecha por padrão e reduz densidade abaixo de 400 px", async () => {
  const [html, css] = await Promise.all([source("index.html"), source("planner.css")]);
  assert.match(html, /<details class="secondary-tools" id="acompanhamento">/);
  assert.doesNotMatch(html, /<details class="secondary-tools" id="acompanhamento" open/);
  assert.match(css, /@media screen and \(max-width: 399px\)/);
  assert.match(css, /\.secondary-tools \.annual-months \{ max-block-size: 46rem; grid-template-columns: repeat\(2, minmax\(8\.5rem, 1fr\)\); gap: 0\.55rem; overflow-y: auto/);
  assert.match(css, /scrollbar-width: thin; box-shadow: inset 0 -0\.85rem/);
  assert.match(css, /\.secondary-tools \.annual-months::-webkit-scrollbar-thumb/);
  assert.match(css, /Contrato final de impressão: uma única folha A4 paisagem/);
  assert.match(css, /\.workspace, \.planner-page, \.planner-content \{ width: 281mm !important; height: 194mm !important/);
  assert.match(css, /break-inside: avoid-page; page-break-inside: avoid/);
  assert.match(css, /\.secondary-tools \.work-hours-content \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});
