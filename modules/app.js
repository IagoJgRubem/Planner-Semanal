import { createBackupController, CONSOLIDATED_BACKUP_KEY } from "./backup-controller.js";
import { createJSONStore, loadPlanner as loadPlannerFromStore, createDebouncedPersist } from "./storage.js";
import { getPlannerElements } from "./app-shell.js";
import { createPlannerUiState } from "./planner-ui-state.js";
import {
  weekValueForDate,
  mondayFromWeekValue,
  localDateKey,
  dateFromKey,
  timeToMinutes,
  formatDuration,
} from "./calendar-utils.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const APP_NAME = "planner-operacional-semanal";
const APP_VERSION = 3;
const BACKUP_STORAGE_KEYS = ["planner"];

const KEY = {
  planner: "planner",
  templates: "planner.templates",
  history: "planner.history",
  monthlyGoals: "planner.monthly-goals",
  dailyAgenda: "planner.daily-agenda",
  dailyBlocks: "planner.daily-blocks",
  timeOff: "planner.time-off",
  durations: "planner.durations",
  week: "planner.week",
  selectedDate: "planner.selected-date",
  workHours: "planner.work-hours",
  activeTab: "planner.active-tab",
  profile: "planner.profile",
  prefs: "planner.prefs",
  rollover: "planner.rollover",
  backupConsolidated: CONSOLIDATED_BACKUP_KEY,
};

const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS = {
  monday: "Segunda",
  tuesday: "Terça",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sábado",
  sunday: "Domingo",
};
const PERIODS = [
  { key: "manha", label: "Manhã" },
  { key: "tarde", label: "Tarde" },
  { key: "noite", label: "Noite" },
];
const WEEKDAY_LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"];

const CATEGORY_LABELS = { trabalho: "Trabalho", saude: "Saúde", pessoal: "Pessoal" };
const CATEGORY_RULES = [
  { key: "trabalho", pattern: /(trabalh|reuni|projeto|cliente|entrega|follow-up|execu)/i },
  { key: "saude", pattern: /(treino|academia|caminhad|corrid|sa[uú]de|m[eé]dic|dentist|yoga|alonga)/i },
];

const NATIONAL_HOLIDAYS = [
  { month: 1, day: 1, label: "Confraternização Universal" },
  { month: 4, day: 21, label: "Tiradentes" },
  { month: 5, day: 1, label: "Dia do Trabalho" },
  { month: 9, day: 7, label: "Independência do Brasil" },
  { month: 10, day: 12, label: "Nossa Senhora Aparecida" },
  { month: 11, day: 2, label: "Finados" },
  { month: 11, day: 15, label: "Proclamação da República" },
  { month: 12, day: 25, label: "Natal" },
];
const REGIONAL_HOLIDAYS = {
  "America/Manaus": [{ month: 6, day: 24, label: "Aniversário de Manaus" }],
  "America/Sao_Paulo": [{ month: 1, day: 25, label: "Aniversário de São Paulo" }],
  "America/Rio_Branco": [{ month: 12, day: 28, label: "Aniversário de Rio Branco" }],
};

const jsonStore = createJSONStore(localStorage);
function readJSON(key, fallback) {
  return jsonStore.read(key, fallback);
}
function writeJSON(key, value) {
  return jsonStore.write(key, value);
}
function readText(key, fallback = "") {
  return jsonStore.readText(key, fallback);
}
function writeText(key, value) {
  return jsonStore.writeText(key, value);
}
function safeParse(raw) {
  try { return JSON.parse(raw); } catch { return {}; }
}
function randomId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function rangesOverlap(startTime, startDuration, endTime, endDuration) {
  const firstStart = timeToMinutes(startTime);
  const firstEnd = firstStart + Math.max(0, Number(startDuration) || 0);
  const secondStart = timeToMinutes(endTime);
  const secondEnd = secondStart + Math.max(0, Number(endDuration) || 0);
  return firstStart < secondEnd && secondStart < firstEnd;
}

function loadPlanner() {
  return loadPlannerFromStore(localStorage, KEY.planner);
}

let plannerDoc = loadPlanner();
let selectedDate = readText(KEY.selectedDate, "") || null;
let currentWeek = readText(KEY.week, "") || weekValueForDate(new Date());
const todaySeed = new Date();
let calendarCursor = { year: todaySeed.getFullYear(), month: todaySeed.getMonth() };

const els = getPlannerElements();

const uiState = createPlannerUiState({
  root: document,
  prioritySummary: els.prioritySummary,
  saveStatus: els.saveStatus,
  allEditables: () => $$(".slot-text"),
  allChecklistItems: () => $$("[data-checklist]"),
});

const dialogElement = els.dialogElement;
let dialogResolve = null;

function buildField(definition) {
  const wrap = document.createElement("label");
  const caption = document.createElement("span");
  caption.textContent = definition.label;
  wrap.append(caption);
  let input;
  if (definition.type === "select") {
    input = document.createElement("select");
    (definition.options || []).forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option.value;
      opt.textContent = option.label;
      input.append(opt);
    });
  } else if (definition.type === "textarea") {
    input = document.createElement("textarea");
    input.rows = definition.rows || 3;
  } else {
    input = document.createElement("input");
    input.type = definition.type || "text";
    if (definition.min != null) input.min = definition.min;
    if (definition.max != null) input.max = definition.max;
    if (definition.step != null) input.step = definition.step;
    if (definition.placeholder != null) input.placeholder = String(definition.placeholder);
    if (definition.required) input.required = true;
    if (definition.value != null) input.value = definition.value;
  }
  input.name = definition.name;
  wrap.append(input);
  return wrap;
}

function closeModal(value) {
  if (dialogElement.open) dialogElement.close();
  const resolve = dialogResolve;
  dialogResolve = null;
  resolve?.(value);
}

function openModal({ heading, detail = "", submitLabel = "Salvar", fields = [] }) {
  if (dialogResolve) closeModal(null);
  els.dialogTitle.textContent = heading;
  els.dialogDescription.textContent = detail;
  els.dialogDescription.hidden = !detail;
  els.dialogFields.replaceChildren(...fields.map(buildField));
  els.dialogSubmit.textContent = submitLabel;
  els.dialogCancel.textContent = "Cancelar";
  dialogElement.showModal();
  window.setTimeout(() => els.dialogFields.querySelector("input:not([type=checkbox])")?.focus(), 0);
  return new Promise((resolve) => { dialogResolve = resolve; });
}

dialogElement.addEventListener("close", () => {
  const resolve = dialogResolve;
  dialogResolve = null;
  resolve?.(null);
});
els.dialogForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.submitter === els.dialogCancel) {
    closeModal(null);
    return;
  }
  const values = {};
  els.dialogFields.querySelectorAll("input, select, textarea").forEach((field) => {
    values[field.name] = field.type === "checkbox" ? field.checked : field.value;
  });
  closeModal(values);
});

const modal = {
  open: openModal,
  confirm: async ({ heading, detail = "", confirmLabel = "Confirmar" } = {}) =>
    Boolean(await openModal({ heading, detail, submitLabel: confirmLabel, fields: [] })),
};

function persistPlanner() {
  plannerDoc.fields = uiState.getFieldValues();
  plannerDoc.checklist = uiState.getChecklistValues();
  plannerDoc.priorities = uiState.getPriorityValues();
  plannerDoc.checks = Object.fromEntries($$(".slot-check").map((item) => [item.dataset.slotCheck, item.checked]));
  writeText(KEY.planner, JSON.stringify(plannerDoc));
  uiState.showStatus("Alterações salvas ✓");
  refreshDayProgress();
  syncEmptySlots();
  recordWeekSnapshot();
  refreshMetrics();
  backupController.queueSync(KEY.backupConsolidated);
}
const debouncedPersist = createDebouncedPersist(persistPlanner, 350);

function getScheduleEntries(dayKey) {
  const durations = getDurations();
  return $$(`.schedule-slot[data-day="${dayKey}"]`).reduce((acc, slot) => {
    const text = $(".slot-text", slot)?.textContent.trim() || "";
    if (!text) return acc;
    const period = slot.closest(".day-period")?.dataset.period || "";
    const stored = Number(durations[`${dayKey}-${period}`]);
    const slotsInPeriod = $$(`.schedule-slot[data-day="${dayKey}"]`, slot.closest(".day-period") || document).length || 1;
    const duration = Number.isFinite(stored) && stored > 0 ? Math.round(stored / slotsInPeriod) : 60;
    acc.push({ slot, text, duration });
    return acc;
  }, []);
}

function applyStoredValues() {
  uiState.applyFieldValues(plannerDoc.fields);
  uiState.applyChecklistValues(plannerDoc.checklist);
  uiState.applyPriorityValues(plannerDoc.priorities);
  $$(".slot-check").forEach((item) => { item.checked = Boolean(plannerDoc.checks[item.dataset.slotCheck]); });
  applyDurations();
  syncDoneClasses();
  syncEmptySlots();
}

function syncDoneClasses() {
  $$(".schedule-slot").forEach((slot) => {
    const check = slot.querySelector(".slot-check");
    slot.classList.toggle("is-done", Boolean(check?.checked));
  });
}

function getDurations() { return readJSON(KEY.durations, {}); }
function applyDurations(values = getDurations()) {
  $$("[data-duration]").forEach((chip) => {
    const stored = values[chip.dataset.duration];
    if (stored != null) chip.textContent = `${stored}m`;
  });
}

async function editDuration(chip) {
  const key = chip.dataset.duration;
  const current = Number(getDurations()[key]) || Number.parseInt(chip.textContent, 10) || 60;
  const values = await modal.open({
    heading: "Duração do bloco",
    fields: [
      { name: "duration", label: "Duração (minutos)", type: "number", min: 0, step: 5, value: current },
    ],
  });
  if (!values) return;
  const minutes = Math.max(0, Math.round(Number(values.duration) || 0));
  const durations = getDurations();
  durations[key] = minutes;
  writeJSON(KEY.durations, durations);
  chip.textContent = `${minutes}m`;
  uiState.showStatus(`Duração atualizada para ${minutes} min ✓`);
}

function swapPriorities(firstKey, secondKey) {
  const values = uiState.getPriorityValues();
  const temp = values[firstKey];
  values[firstKey] = values[secondKey];
  values[secondKey] = temp;
  uiState.applyPriorityValues(values);
  persistPlanner();
}

function getProfile() {
  const saved = readJSON(KEY.profile, {});
  return {
    name: typeof saved.name === "string" ? saved.name : "",
    email: typeof saved.email === "string" ? saved.email : "",
    timezone: typeof saved.timezone === "string" ? saved.timezone : "America/Manaus",
    weekFormat: saved.weekFormat === "sunday" ? "sunday" : "iso",
    photo: typeof saved.photo === "string" && saved.photo.startsWith("data:image/") ? saved.photo : "",
  };
}
function saveProfile(profile) { writeJSON(KEY.profile, profile); }

function getPrefs() {
  const saved = readJSON(KEY.prefs, {});
  return {
    theme: ["light", "dark", "eink"].includes(saved.theme) ? saved.theme : "light",
    hideEmpty: saved.hideEmpty !== false,
    dayStart: saved.dayStart || "08:00",
  };
}
function savePrefs(prefs) { writeJSON(KEY.prefs, prefs); }

function applyTheme(theme) {
  document.body.classList.toggle("theme-dark", theme === "dark");
  document.body.classList.toggle("theme-eink", theme === "eink");
  $$(".theme-option").forEach((option) => {
    option.classList.toggle("is-active", option.dataset.themeOption === theme);
    option.setAttribute("aria-pressed", String(option.dataset.themeOption === theme));
  });
}

function initialsFor(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0].charAt(0) || "";
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return `${first}${last}`.toUpperCase();
}

function resizeImageForAvatar(file, size = 160) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, size, size);
        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      image.onerror = () => reject(new Error("Imagem inválida"));
      image.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo"));
    reader.readAsDataURL(file);
  });
}

async function applyProfilePhoto(file) {
  if (!file?.type.startsWith("image/")) {
    uiState.showStatus("Escolha um arquivo de imagem.");
    return;
  }
  try {
    const photo = await resizeImageForAvatar(file);
    const profile = getProfile();
    profile.photo = photo;
    saveProfile(profile);
    renderProfile();
    uiState.showStatus("Foto de perfil atualizada ✓");
  } catch {
    uiState.showStatus("Não foi possível carregar esta imagem.");
  }
}

function renderProfile() {
  const profile = getProfile();
  if (els.profileAvatar) {
    els.profileAvatar.textContent = profile.photo ? "" : initialsFor(profile.name);
    els.profileAvatar.classList.toggle("has-photo", Boolean(profile.photo));
    els.profileAvatar.style.backgroundImage = profile.photo ? `url("${profile.photo}")` : "";
  }
  const removeButton = $("#profile-photo-remove");
  if (removeButton) removeButton.hidden = !profile.photo;
  const timezoneLabel = $("#profile-timezone option:checked")?.textContent || profile.timezone;
  const formatLabel = $("#profile-week-format option:checked")?.textContent || "";
  if (els.profileSummary) {
    els.profileSummary.textContent = [
      profile.name ? `Planejando como ${profile.name}.` : "Defina seu nome para personalizar o avatar.",
      `${timezoneLabel} · ${formatLabel}`,
    ].join(" ");
  }
}

function importHolidays() {
  const profile = getProfile();
  const regional = REGIONAL_HOLIDAYS[profile.timezone] || [];
  const timeOff = getTimeOff();
  const known = new Set(timeOff.dates.map((item) => item.date));
  const years = [new Date().getFullYear(), new Date().getFullYear() + 1];
  const additions = [];
  years.forEach((year) => {
    NATIONAL_HOLIDAYS.forEach(({ month, day, label }) => {
      const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (!known.has(dateKey)) {
        additions.push({ date: dateKey, label: `Feriado nacional: ${label}` });
        known.add(dateKey);
      }
    });
    regional.forEach(({ month, day, label }) => {
      const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (!known.has(dateKey)) {
        additions.push({ date: dateKey, label: `Feriado municipal: ${label}` });
        known.add(dateKey);
      }
    });
  });
  if (additions.length) {
    saveTimeOff({ ...timeOff, dates: [...timeOff.dates, ...additions] });
  }
  uiState.showStatus(additions.length
    ? `${additions.length} feriado(s) importados para ${years[0]}–${years[1]} ✓`
    : "Feriados nacionais e municipais já estão sincronizados.");
  return additions.length;
}

function syncEmptySlots() {
  const hideEmpty = getPrefs().hideEmpty;
  $$(".schedule-slot").forEach((slot) => {
    const text = $(".slot-text", slot);
    const isEmpty = !text?.textContent.trim();
    const focused = document.activeElement === text;
    slot.classList.toggle("is-empty", hideEmpty && isEmpty && !focused);
  });
  $$(".day-period").forEach((period) => {
    const hasEmpty = $$(".schedule-slot", period).some((slot) => slot.classList.contains("is-empty"));
    period.classList.toggle("is-full", !hasEmpty);
    const allEmpty = $$(".schedule-slot", period).every((slot) => slot.classList.contains("is-empty"));
    period.classList.toggle("is-collapsed", hideEmpty && allEmpty);
  });
}

function refreshDayProgress() {
  $$(".day-card").forEach((card) => {
    const checks = $$(".slot-check", card);
    const done = checks.filter((item) => item.checked).length;
    const percent = checks.length ? Math.round((done / checks.length) * 100) : 0;
    const bar = $(".day-progress", card);
    if (bar) {
      bar.style.setProperty("--progress", `${percent}%`);
      bar.setAttribute("aria-valuenow", String(percent));
    }
  });
}

let metricsBundleLoaded = false;

function maybeLoadMetricsBundle() {
  if (metricsBundleLoaded) return;
  metricsBundleLoaded = true;
  import("./metrics-lazy.js")
    .then(({ loadMetricsEnhancements }) => loadMetricsEnhancements())
    .catch(() => { metricsBundleLoaded = false; });
}

function activateTab(name, { persist = true } = {}) {
  els.tabButtons.forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.tab === name));
  });
  Object.entries(els.panels).forEach(([key, panel]) => {
    const active = key === name;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });
  if (name === "tracking") maybeLoadMetricsBundle();
  if (persist) writeText(KEY.activeTab, name);
}

function dateOfWeekDay(dayKey) {
  const monday = mondayFromWeekValue(currentWeek);
  if (!monday) return new Date();
  const date = new Date(monday);
  date.setDate(monday.getDate() + DAY_KEYS.indexOf(dayKey));
  return date;
}

function weekRangeLabel(monday, sunday) {
  const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });
  const dayOnly = new Intl.DateTimeFormat("pt-BR", { day: "numeric" });
  const sameMonth = monday.getMonth() === sunday.getMonth() && monday.getFullYear() === sunday.getFullYear();
  return sameMonth
    ? `${dayOnly.format(monday)} a ${dayMonth.format(sunday)}`
    : `${dayMonth.format(monday)} a ${dayMonth.format(sunday)}`;
}

function renderWeekMeta() {
  const monday = mondayFromWeekValue(currentWeek);
  if (!monday) return;
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const match = /^(\d{4})-W(\d{2})$/.exec(currentWeek);
  const title = match ? `Semana ${Number(match[2])} · ${match[1]}` : currentWeek;
  const shortTitle = match ? `Semana ${Number(match[2])}` : currentWeek;
  const range = weekRangeLabel(monday, sunday);
  if (els.weekMetaTitle) els.weekMetaTitle.textContent = shortTitle;
  if (els.weekMetaRange) els.weekMetaRange.textContent = range;
  if (els.printWeekRange) els.printWeekRange.textContent = `${title} · ${range}`;
}

function shiftWeek(offset) {
  const monday = mondayFromWeekValue(currentWeek) || new Date();
  monday.setDate(monday.getDate() + offset * 7);
  currentWeek = weekValueForDate(monday);
  writeText(KEY.week, currentWeek);
  if (els.weekPicker) els.weekPicker.value = currentWeek;
  renderWeekMeta();
  renderCapacity();
  refreshMetrics();
}

function buildMobileTabs() {
  if (!els.mobileTabs) return;
  els.mobileTabs.replaceChildren();
  DAY_KEYS.forEach((dayKey) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.day = dayKey;
    button.textContent = DAY_LABELS[dayKey];
    button.addEventListener("click", () => selectDay(dayKey));
    els.mobileTabs.append(button);
  });
  selectDay(DAY_KEYS[(new Date().getDay() + 6) % 7], { silent: true });
}

function selectDay(dayKey, { silent = false } = {}) {
  if (els.grid) {
    els.grid.dataset.mobileDay = dayKey;
    $$(".day-card", els.grid).forEach((card) => {
      const isActive = card.dataset.day === dayKey;
      card.classList.toggle("is-mobile-active", isActive);
      card.classList.toggle("is-selected-day", isActive);
    });
  }
  if (els.mobileTabs) {
    $$("button", els.mobileTabs).forEach((button) => {
      button.classList.toggle("is-active", button.dataset.day === dayKey);
    });
  }
  if (!silent) setSelectedDate(localDateKey(dateOfWeekDay(dayKey)));
}

function setSelectedDate(dateKey) {
  selectedDate = dateKey;
  writeText(KEY.selectedDate, dateKey || "");
  renderAgenda();
  renderCapacity();
  renderCalendar();
}

function markTodayCard() {
  const todayKey = DAY_KEYS[(new Date().getDay() + 6) % 7];
  $$(".day-card").forEach((card) => {
    const isToday = card.dataset.day === todayKey;
    card.classList.toggle("is-today", isToday);
    const heading = $(".day-card-header h2", card);
    let tag = $(".today-tag", card);
    if (isToday && !tag && heading) {
      tag = document.createElement("span");
      tag.className = "today-tag";
      tag.textContent = "Hoje";
      heading.after(tag);
    }
    if (!isToday) tag?.remove();
  });
}

function getAgenda() { return readJSON(KEY.dailyAgenda, {}); }
function saveAgenda(agenda) { writeJSON(KEY.dailyAgenda, agenda); }
function getBlocks() { return readJSON(KEY.dailyBlocks, {}); }
function saveBlocks(blocks) { writeJSON(KEY.dailyBlocks, blocks); }
function getTimeOff() {
  const saved = readJSON(KEY.timeOff, {});
  return {
    dates: Array.isArray(saved.dates) ? saved.dates : [],
    recurringDays: Array.isArray(saved.recurringDays) ? saved.recurringDays : [],
  };
}
function saveTimeOff(timeOff) { writeJSON(KEY.timeOff, timeOff); }
function timeOffForDate(dateKey) {
  const timeOff = getTimeOff();
  const dated = timeOff.dates.find((item) => item.date === dateKey);
  if (dated) return dated;
  const date = dateFromKey(dateKey);
  if (!date) return null;
  const dayKey = DAY_KEYS[(date.getDay() + 6) % 7];
  return timeOff.recurringDays.includes(dayKey)
    ? { recurring: true, dayKey, label: "Folga recorrente" }
    : null;
}
function getWorkHours() { return Number(readJSON(KEY.workHours, 8)) || 8; }
function getGoals() { return readJSON(KEY.monthlyGoals, []); }
function saveGoals(goals) { writeJSON(KEY.monthlyGoals, goals); }

function agendaConflicts(entries, blocks) {
  const timed = entries.filter((entry) => entry.type === "custom" && /^\d{1,2}:\d{2}$/.test(entry.time || ""));
  const conflicts = new Set();
  for (let i = 0; i < timed.length; i += 1) {
    for (let j = i + 1; j < timed.length; j += 1) {
      if (rangesOverlap(timed[i].time, Number(timed[i].duration) || 0, timed[j].time, Number(timed[j].duration) || 0)) {
        conflicts.add(timed[i].id);
        conflicts.add(timed[j].id);
      }
    }
  }
  timed.forEach((entry) => {
    blocks.forEach((block) => {
      const blockDuration = Math.max(0, timeToMinutes(block.end) - timeToMinutes(block.start));
      if (rangesOverlap(entry.time, Number(entry.duration) || 0, block.start, blockDuration)) {
        conflicts.add(entry.id);
      }
    });
  });
  return conflicts;
}

function getRolloverState() { return readJSON(KEY.rollover, {}); }
function saveRolloverState(state) { writeJSON(KEY.rollover, state); }
function markRolloverHandled(yesterdayKey, id) {
  const state = getRolloverState();
  const list = state[yesterdayKey] || [];
  if (!list.includes(id)) list.push(id);
  state[yesterdayKey] = list;
  saveRolloverState(state);
}
function collectPendingFromYesterday() {
  if (!selectedDate) return { key: "", items: [] };
  const date = dateFromKey(selectedDate);
  if (!date) return { key: "", items: [] };
  date.setDate(date.getDate() - 1);
  const yesterdayKey = localDateKey(date);
  const dismissed = getRolloverState()[yesterdayKey] || [];
  const dayCard = $(`.day-card[data-day="${DAY_KEYS[(date.getDay() + 6) % 7]}"]`);
  if (!dayCard) return { key: yesterdayKey, items: [] };
  const items = $$(".slot-check", dayCard)
    .filter((check) => !check.checked)
    .map((check) => ({
      id: check.dataset.slotCheck,
      text: $(".slot-text", check.closest(".schedule-slot"))?.textContent.trim() || "",
    }))
    .filter((item) => item.text && !dismissed.includes(item.id));
  return { key: yesterdayKey, items };
}
function movePendingToToday(item, yesterdayKey) {
  if (!selectedDate) return;
  const taken = new Set((getAgenda()[selectedDate] || []).map((entry) => entry.time));
  let time = "09:00";
  for (let hour = 6; hour <= 22; hour += 1) {
    const candidate = `${String(hour).padStart(2, "0")}:00`;
    if (!taken.has(candidate)) { time = candidate; break; }
  }
  const agenda = getAgenda();
  agenda[selectedDate] = [...(agenda[selectedDate] || []), { id: randomId(), time, text: item.text, duration: 60 }];
  saveAgenda(agenda);
  markRolloverHandled(yesterdayKey, item.id);
  refreshAfterDataChange();
  uiState.showStatus(`“${item.text}” movida para hoje às ${time}.`);
}

function renderAgenda() {
  if (!els.agendaList) return;
  els.agendaList.replaceChildren();
  if (!selectedDate) {
    if (els.agendDateLabel) els.agendDateLabel.textContent = "Selecione uma data no calendário ou clique em um dia.";
    if (els.agendaSummary) {
      els.agendaSummary.textContent = "";
      els.agendaSummary.className = "daily-agenda-summary";
    }
    return;
  }
  const date = new Date(`${selectedDate}T12:00:00`);
  if (els.agendDateLabel) {
    els.agendDateLabel.textContent = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long", day: "2-digit", month: "long",
    }).format(date);
  }

  const off = timeOffForDate(selectedDate);
  const agenda = getAgenda()[selectedDate] || [];
  const blocks = getBlocks()[selectedDate] || [];
  const goals = getGoals().filter((goal) => !goal.done && goal.deadline === selectedDate.slice(0, 7));

  const entries = [
    ...agenda.map((item) => ({ ...item, type: "custom" })),
    ...blocks.map((item) => ({ ...item, type: "blocked" })),
    ...goals.map((goal) => ({ id: goal.id, type: "goal", text: goal.text })),
  ].sort((a, b) => String(a.time || "99:99").localeCompare(String(b.time || "99:99")));

  const total = agenda.reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
  const conflicts = agendaConflicts(entries, blocks);

  if (els.agendaSummary) {
    els.agendaSummary.className = "daily-agenda-summary";
    let summary = `${formatDuration(total)} de compromissos`;
    if (off) summary = `${off.label || "Folga"} · capacidade reduzida · ${summary}`;
    if (conflicts.size) {
      summary += ` · ${conflicts.size} conflito(s) de horário`;
      els.agendaSummary.classList.add("has-conflict");
    } else if (total > getWorkHours() * 60) {
      els.agendaSummary.classList.add("has-overload");
    }
    els.agendaSummary.textContent = summary;
  }

  entries.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "agenda-entry";
    if (entry.type === "blocked") item.classList.add("is-blocked");

    if (entry.time) {
      const time = document.createElement("span");
      time.className = "entry-time";
      time.textContent = entry.type === "blocked" ? `${entry.start}–${entry.end}` : entry.time;
      item.append(time);
    }

    const text = document.createElement("span");
    text.className = "entry-text";
    text.textContent = entry.type === "blocked" ? (entry.label || "Indisponível") : entry.text;
    item.append(text);

    const tag = document.createElement("span");
    tag.className = "entry-tag";
    tag.textContent = entry.type === "custom" ? "Compromisso" : entry.type === "blocked" ? "Bloqueio" : "Meta";
    item.append(tag);

    if (entry.type !== "goal") {
      const actions = document.createElement("span");
      actions.className = "entry-actions";
      if (entry.type === "custom") {
        const edit = document.createElement("button");
        edit.type = "button";
        edit.textContent = "Editar";
        edit.addEventListener("click", () => editAgendaEntry(entry.id));
        actions.append(edit);
      }
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Excluir";
      remove.addEventListener("click", () => (entry.type === "custom" ? removeAgendaEntry(entry.id) : removeBlock(entry.id)));
      actions.append(remove);
      item.append(actions);
    }
    els.agendaList.append(item);
  });

  const pending = collectPendingFromYesterday();
  if (pending.items.length) {
    const divider = document.createElement("li");
    divider.className = "rollover-header";
    divider.textContent = "Pendências de ontem";
    els.agendaList.append(divider);
    pending.items.forEach((item) => {
      const li = document.createElement("li");
      li.className = "agenda-entry is-rollover";
      const badge = document.createElement("span");
      badge.className = "entry-tag rollover-badge";
      badge.textContent = "Ontem";
      const text = document.createElement("span");
      text.className = "entry-text";
      text.textContent = item.text;
      const actions = document.createElement("span");
      actions.className = "entry-actions";
      const move = document.createElement("button");
      move.type = "button";
      move.textContent = "Mover para hoje";
      move.addEventListener("click", () => movePendingToToday(item, pending.key));
      const dismiss = document.createElement("button");
      dismiss.type = "button";
      dismiss.textContent = "Descartar";
      dismiss.addEventListener("click", () => {
        markRolloverHandled(pending.key, item.id);
        renderAgenda();
        uiState.showStatus("Pendência descartada.");
      });
      actions.append(move, dismiss);
      li.append(badge, text, actions);
      els.agendaList.append(li);
    });
  }
}

async function addAgendaEntry() {
  if (!selectedDate) {
    uiState.showStatus("Selecione um dia primeiro.");
    return;
  }
  const values = await modal.open({
    heading: "Novo compromisso",
    fields: [
      { name: "time", label: "Horário", type: "time", required: true },
      { name: "text", label: "Descrição", type: "text", required: true, placeholder: "O que precisa ser feito?" },
      { name: "duration", label: "Duração (minutos)", type: "number", min: 5, step: 5, value: 30 },
    ],
  });
  if (!values) return;
  if (!/^\d{1,2}:\d{2}$/.test(values.time) || !values.text?.trim() || !(Number(values.duration) > 0)) {
    uiState.showStatus("Dados inválidos.");
    return;
  }
  const duration = Number(values.duration);
  const blocks = getBlocks()[selectedDate] || [];
  const blocked = blocks.some((block) =>
    rangesOverlap(values.time, duration, block.start, Math.max(0, timeToMinutes(block.end) - timeToMinutes(block.start))));
  if (blocked) {
    uiState.showStatus("Horário bloqueado nesta data.");
    return;
  }
  const agenda = getAgenda();
  agenda[selectedDate] = [...(agenda[selectedDate] || []), { id: randomId(), time: values.time, text: values.text.trim(), duration }];
  saveAgenda(agenda);
  refreshAfterDataChange();
}

async function editAgendaEntry(id) {
  const agenda = getAgenda();
  const entry = (agenda[selectedDate] || []).find((item) => item.id === id);
  if (!entry) return;
  const values = await modal.open({
    heading: "Editar compromisso",
    fields: [
      { name: "time", label: "Horário", type: "time", required: true, value: entry.time },
      { name: "text", label: "Descrição", type: "text", required: true, value: entry.text },
      { name: "duration", label: "Duração (minutos)", type: "number", min: 5, step: 5, value: entry.duration },
    ],
  });
  if (!values) return;
  Object.assign(entry, { time: values.time, text: values.text.trim(), duration: Number(values.duration) });
  saveAgenda(agenda);
  refreshAfterDataChange();
}

async function removeAgendaEntry(id) {
  const agenda = getAgenda();
  const entry = (agenda[selectedDate] || []).find((item) => item.id === id);
  if (!entry) return;
  if (!await modal.confirm({ heading: "Excluir compromisso", detail: `Excluir “${entry.text}”?` })) return;
  agenda[selectedDate] = (agenda[selectedDate] || []).filter((item) => item.id !== id);
  if (!agenda[selectedDate].length) delete agenda[selectedDate];
  saveAgenda(agenda);
  refreshAfterDataChange();
}

async function addBlock() {
  if (!selectedDate) {
    uiState.showStatus("Selecione um dia primeiro.");
    return;
  }
  const values = await modal.open({
    heading: "Bloquear horário",
    fields: [
      { name: "start", label: "Início do bloqueio", type: "time", required: true },
      { name: "end", label: "Fim do bloqueio", type: "time", required: true },
      { name: "label", label: "Motivo (opcional)", type: "text" },
    ],
  });
  if (!values) return;
  if (!/^\d{1,2}:\d{2}$/.test(values.start) || !/^\d{1,2}:\d{2}$/.test(values.end) || timeToMinutes(values.end) <= timeToMinutes(values.start)) {
    uiState.showStatus("Intervalo inválido.");
    return;
  }
  const blocks = getBlocks();
  blocks[selectedDate] = [...(blocks[selectedDate] || []), { id: randomId(), start: values.start, end: values.end, label: values.label?.trim() || "" }];
  saveBlocks(blocks);
  refreshAfterDataChange();
}

async function removeBlock(id) {
  const blocks = getBlocks();
  const entry = (blocks[selectedDate] || []).find((item) => item.id === id);
  if (!entry) return;
  if (!await modal.confirm({ heading: "Remover bloqueio", detail: `Remover o bloqueio das ${entry.start} às ${entry.end}?`, confirmLabel: "Remover" })) return;
  blocks[selectedDate] = (blocks[selectedDate] || []).filter((item) => item.id !== id);
  if (!blocks[selectedDate].length) delete blocks[selectedDate];
  saveBlocks(blocks);
  refreshAfterDataChange();
}

function refreshAfterDataChange() {
  renderAgenda();
  renderCapacity();
  refreshMetrics();
}

function renderCapacity() {
  if (!els.capacityContent) return;
  const monday = mondayFromWeekValue(currentWeek);
  els.capacityContent.replaceChildren();
  if (!monday) {
    els.capacityContent.textContent = "Escolha uma semana valida.";
    return;
  }
  const values = DAY_KEYS.map((dayKey) => {
    const entries = getScheduleEntries(dayKey);
    const planned = entries.reduce((sum, entry) => sum + entry.duration, 0);
    const handled = entries.filter((entry) => entry.slot.querySelector(".slot-check")?.checked).reduce((sum, entry) => sum + entry.duration, 0);
    return { planned, handled };
  });
  const maxPlanned = Math.max(1, ...values.map((value) => value.planned));
  let totalPlanned = 0;
  let totalDone = 0;
  values.forEach((value, index) => {
    totalPlanned += value.planned;
    totalDone += value.handled;
    const dayKey = DAY_KEYS[index];
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const dateKey = localDateKey(date);
    const row = document.createElement("div");
    row.className = "capacity-row";
    if (value.handled && value.planned && value.handled >= value.planned) row.classList.add("is-complete");
    if (dateKey === selectedDate) row.classList.add("is-selected");
    const label = document.createElement("span");
    label.className = "capacity-day";
    label.textContent = DAY_LABELS[dayKey] + " " + date.getDate();
    const group = document.createElement("div");
    group.className = "capacity-bars";
    const plannedBar = document.createElement("i");
    plannedBar.className = "capacity-bar is-planned";
    plannedBar.style.height = Math.max(2, Math.round((value.planned / maxPlanned) * 100)) + "%";
    plannedBar.title = "Planejado: " + formatDuration(value.planned);
    const doneBar = document.createElement("i");
    doneBar.className = "capacity-bar is-done";
    doneBar.style.height = Math.max(2, Math.round((value.handled / maxPlanned) * 100)) + "%";
    doneBar.title = "Executado: " + formatDuration(value.handled);
    group.append(plannedBar, doneBar);
    row.append(label, group);
    els.capacityContent.append(row);
  });
  const total = document.createElement("p");
  total.className = "capacity-total";
  total.textContent = "Total: " + formatDuration(totalDone) + " executados de " + formatDuration(totalPlanned);
  els.capacityContent.append(total);
}

function getHistory() { return readJSON(KEY.history, []); }

function recordWeekSnapshot() {
  const ratios = $$(".day-card").map((card) => {
    const checks = $$(".slot-check", card);
    return checks.length ? checks.filter((item) => item.checked).length / checks.length : 0;
  });
  const average = ratios.length ? ratios.reduce((sum, value) => sum + value, 0) / ratios.length : 0;
  const history = getHistory().filter((entry) => entry.week !== currentWeek);
  history.push({ week: currentWeek, ratio: Number(average.toFixed(2)), savedAt: new Date().toISOString() });
  history.sort((a, b) => (a.week < b.week ? -1 : 1));
  writeJSON(KEY.history, history);
  renderHistory();
  renderStreak();
}

function renderHistory() {
  if (!els.historyList) return;
  const history = getHistory().slice(-12).reverse();
  els.historyList.replaceChildren();

  const ascending = [...history].reverse();
  const recent = ascending.slice(-4);
  if (recent.length) {
    const chart = document.createElement("li");
    chart.className = "history-sparkline";
    chart.setAttribute("aria-label", "Tendência das últimas quatro semanas");
    recent.forEach((entry) => {
      const cell = document.createElement("span");
      cell.className = "spark-cell";
      const bar = document.createElement("i");
      bar.style.height = `${Math.max(Math.round(entry.ratio * 100), 4)}%`;
      bar.title = `${entry.week}: ${Math.round(entry.ratio * 100)}% concluído`;
      const label = document.createElement("small");
      label.textContent = String(entry.week || "").replace(/^\d{4}-W/, "S");
      cell.append(bar, label);
      chart.append(cell);
    });
    els.historyList.append(chart);
  }

  if (!history.length) {
    const empty = document.createElement("li");
    empty.className = "history-item";
    empty.textContent = "Sem registros ainda.";
    els.historyList.append(empty);
    return;
  }
  history.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "history-item";
    const week = document.createElement("strong");
    week.textContent = entry.week;
    const ratio = document.createElement("span");
    ratio.textContent = `${Math.round(entry.ratio * 100)}% concluído`;
    item.append(week, ratio);
    els.historyList.append(item);
  });
}

function renderStreak() {
  if (!els.streakIndicator) return;
  const history = getHistory();
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].ratio >= 0.8) streak += 1;
    else break;
  }
  els.streakIndicator.textContent = streak
    ? `🔥 ${streak} semana(s) seguida(s) com pelo menos 80% de conclusão.`
    : "Complete 80% de uma semana para iniciar sua sequência.";
}

async function clearHistory() {
  if (!await modal.confirm({ heading: "Limpar histórico", detail: "Todo o histórico de semanas será apagado.", confirmLabel: "Limpar" })) return;
  writeJSON(KEY.history, []);
  renderHistory();
  renderStreak();
}

function goalBadgeInfo(goal) {
  if (!goal.deadline || !/^\d{4}-\d{2}$/.test(goal.deadline)) return { state: "open", label: "sem prazo" };
  const [year, month] = goal.deadline.split("-").map(Number);
  const now = new Date();
  const monthsUntil = (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth());
  if (monthsUntil < 0) return { state: "overdue", label: "atrasada" };
  if (monthsUntil === 0) return { state: "soon", label: "este mês" };
  return { state: "scheduled", label: `em ${monthsUntil} mês(es)` };
}

function renderGoals() {
  if (!els.goalsList) return;
  const goals = getGoals();
  els.goalsList.replaceChildren();
  if (!goals.length) {
    const empty = document.createElement("li");
    empty.className = "goal-item";
    empty.textContent = "Nenhuma meta cadastrada.";
    els.goalsList.append(empty);
    return;
  }
  goals.forEach((goal) => {
    const item = document.createElement("li");
    item.className = "goal-item";
    if (goal.done) item.classList.add("is-done");

    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = Boolean(goal.done);
    check.addEventListener("change", () => {
      goal.done = check.checked;
      saveGoals(getGoals().map((entry) => (entry.id === goal.id ? goal : entry)));
      renderGoals();
    });

    const cat = document.createElement("span");
    const categoryKey = CATEGORY_LABELS[goal.category] ? goal.category : "pessoal";
    cat.className = "goal-cat";
    cat.dataset.category = categoryKey;
    cat.textContent = CATEGORY_LABELS[categoryKey];

    const text = document.createElement("span");
    text.className = "goal-text";
    text.textContent = goal.text;

    const badge = document.createElement("span");
    const info = goalBadgeInfo(goal);
    badge.className = `goal-badge state-${info.state}`;
    badge.textContent = info.label;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "goal-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remover meta ${goal.text}`);
    remove.addEventListener("click", async () => {
      if (!await modal.confirm({ heading: "Remover meta", detail: `Remover “${goal.text}”?`, confirmLabel: "Remover" })) return;
      saveGoals(getGoals().filter((entry) => entry.id !== goal.id));
      renderGoals();
      renderAgenda();
    });

    item.append(check, cat, text, badge, remove);
    els.goalsList.append(item);
  });
}

function renderCalendar() {
  if (!els.calendarTitle || !els.calendarGrid) return;
  const { year, month } = calendarCursor;
  els.calendarTitle.textContent = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
    .format(new Date(year, month, 1));
  els.calendarGrid.replaceChildren();

  WEEKDAY_LETTERS.forEach((letter) => {
    const cell = document.createElement("span");
    cell.className = "calendar-weekday";
    cell.textContent = letter;
    els.calendarGrid.append(cell);
  });

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = localDateKey(new Date());
  const agenda = getAgenda();
  const blocks = getBlocks();
  const timeOff = getTimeOff();
  const goals = getGoals();
  const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(firstDay);

  for (let blank = 0; blank < firstDay.getDay(); blank += 1) {
    const filler = document.createElement("span");
    filler.className = "calendar-day is-outside";
    els.calendarGrid.append(filler);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const dateKey = localDateKey(date);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.textContent = String(day);
    if (dateKey === todayKey) button.classList.add("is-today");
    if (dateKey === selectedDate) button.classList.add("is-selected");

    const dayAgenda = agenda[dateKey] || [];
    const dayBlocks = blocks[dateKey] || [];
    const dayGoals = goals.filter((goal) => goal.deadline === dateKey && !goal.done);
    const isOff = timeOff.dates.some((item) => item.date === dateKey);
    const hasMarker = dayAgenda.length > 0 || dayBlocks.length > 0 || isOff || dayGoals.length > 0;
    if (hasMarker) {
      button.classList.add("has-marker");
      if (dayGoals.length) button.classList.add("has-goal");
      const details = [];
      if (dayAgenda.length) details.push(`${dayAgenda.length} compromisso(s)`);
      if (dayBlocks.length) details.push(`${dayBlocks.length} bloqueio(s)`);
      if (dayGoals.length) details.push(`${dayGoals.length} meta(s)`);
      if (isOff) details.push("folga ou feriado");
      button.title = details.join(" · ");
      button.setAttribute("aria-label", `${day} de ${monthName}: ${details.join(", ")}`);
    }

    button.addEventListener("click", () => setSelectedDate(dateKey));
    els.calendarGrid.append(button);
  }
}

let focusTotalSeconds = 25 * 60;
let focusRemaining = focusTotalSeconds;
let focusInterval = null;

function renderFocusClock() {
  if (!els.focusClock) return;
  const minutes = Math.floor(focusRemaining / 60);
  const seconds = focusRemaining % 60;
  els.focusClock.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
function stopFocusTimer() {
  window.clearInterval(focusInterval);
  focusInterval = null;
}
function setFocusStatus(message) {
  if (els.focusStatus) els.focusStatus.textContent = message;
}
function setFocusDuration(minutes) {
  stopFocusTimer();
  focusTotalSeconds = Math.max(1, Math.round(minutes)) * 60;
  focusRemaining = focusTotalSeconds;
  if (els.focusClock) els.focusClock.classList.remove("is-running");
  renderFocusClock();
  setFocusStatus("");
}

function renderAdherence() {
  const checks = $$(".slot-check");
  const done = checks.filter((item) => item.checked).length;
  const percent = checks.length ? Math.round((done / checks.length) * 100) : 0;
  if (els.adherenceValue) els.adherenceValue.textContent = `${percent}%`;
  const ring = $("#adherence-ring");
  if (ring) {
    ring.style.setProperty("--ring-percent", String(percent));
    ring.setAttribute("aria-valuenow", String(percent));
  }
  if (els.adherenceNote) {
    els.adherenceNote.textContent = percent >= 80
      ? "Excelente ritmo — rotina quase completa."
      : percent > 0
        ? "Continue marcando os blocos concluídos."
        : "Marque os blocos concluídos para acompanhar sua aderência.";
  }
}

function categorizeEntryText(text) {
  const value = String(text || "");
  const matched = CATEGORY_RULES.find((rule) => rule.pattern.test(value));
  return matched ? matched.key : "pessoal";
}

function renderCategoryChart() {
  if (!els.categoryChart) return;
  const monday = mondayFromWeekValue(currentWeek);
  els.categoryChart.replaceChildren();
  if (!monday) return;
  const totals = { trabalho: 0, saude: 0, pessoal: 0 };
  DAY_KEYS.forEach((_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const dateKey = localDateKey(date);
    (getAgenda()[dateKey] || []).forEach((entry) => {
      totals[categorizeEntryText(entry.text)] += Number(entry.duration) || 0;
    });
  });
  const grandTotal = Object.values(totals).reduce((sum, value) => sum + value, 0);
  if (!grandTotal) {
    const empty = document.createElement("p");
    empty.className = "category-empty";
    empty.textContent = "Adicione compromissos na agenda para ver a distribuição de horas.";
    els.categoryChart.append(empty);
    return;
  }
  Object.entries(totals).forEach(([key, minutes]) => {
    const row = document.createElement("div");
    row.className = "category-row";
    row.dataset.category = key;

    const head = document.createElement("div");
    head.className = "category-row-head";
    const name = document.createElement("span");
    name.textContent = CATEGORY_LABELS[key];
    const value = document.createElement("strong");
    value.textContent = formatDuration(minutes);
    head.append(name, value);

    const track = document.createElement("div");
    track.className = "category-track";
    const fill = document.createElement("span");
    fill.style.width = `${Math.round((minutes / grandTotal) * 100)}%`;
    track.append(fill);

    row.append(head, track);
    els.categoryChart.append(row);
  });
}

function refreshMetrics() {
  renderAdherence();
  renderCategoryChart();
}

const QUICK_PRESETS = {
  foco: {
    manha: ["Trabalho profundo — projeto principal", "Trabalho profundo — continuação"],
    tarde: ["Reuniões operacionais", "Execução e follow-ups"],
    noite: ["Planejamento do próximo dia", "Encerramento e organização"],
  },
  reunioes: {
    manha: ["Preparação de reuniões", "Reuniões em bloco"],
    tarde: ["Reuniões em bloco", "Notas e encaminhamentos"],
    noite: ["Follow-ups leves", "Organização da agenda"],
  },
  leve: {
    manha: ["Tarefas administrativas", "E-mails e comunicações"],
    tarde: ["Trabalho colaborativo", "Pausa estratégica"],
    noite: ["Leitura profissional leve", "Encerramento tranquilo"],
  },
};

async function applyQuickFill() {
  const presetKey = $("#quick-fill-preset")?.value;
  const preset = QUICK_PRESETS[presetKey];
  const dayKey = els.grid?.dataset.mobileDay || DAY_KEYS[(new Date().getDay() + 6) % 7];
  if (!preset || !dayKey) return;
  if (!await modal.confirm({ heading: "Preenchimento rápido", detail: `Substituir os campos de ${DAY_LABELS[dayKey]}?`, confirmLabel: "Substituir" })) return;
  PERIODS.forEach((period) => {
    for (let slot = 1; slot <= 2; slot += 1) {
      const field = $(`[data-editable="${dayKey}-${period.key}-${slot}"]`);
      if (field) field.textContent = preset[period.key][slot - 1];
    }
  });
  persistPlanner();
  uiState.showStatus(`Preset aplicado a ${DAY_LABELS[dayKey]} ✓`);
}

function getTemplates() { return readJSON(KEY.templates, []); }

function renderTemplateSelect() {
  if (!els.templateSelect) return;
  const templates = getTemplates();
  els.templateSelect.replaceChildren(new Option("Modelos…", ""), ...templates.map((tpl) => new Option(tpl.name, tpl.id)));
}

function renderTemplatesList() {
  const list = $("#templates-list");
  if (!list) return;
  const templates = getTemplates();
  list.replaceChildren();
  if (!templates.length) {
    const empty = document.createElement("li");
    empty.className = "templates-empty";
    empty.textContent = "Nenhum modelo salvo ainda. Configure sua semana e clique em “Salvar semana como modelo”.";
    list.append(empty);
    return;
  }
  templates.forEach((tpl) => {
    const item = document.createElement("li");
    item.className = "template-item";
    const name = document.createElement("span");
    name.className = "template-name";
    name.textContent = tpl.name;
    const meta = document.createElement("small");
    meta.className = "template-meta";
    meta.textContent = tpl.week || "";
    const actions = document.createElement("span");
    actions.className = "template-actions";
    const apply = document.createElement("button");
    apply.type = "button";
    apply.textContent = "Aplicar";
    apply.addEventListener("click", () => applyTemplate(tpl.id));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Excluir";
    remove.addEventListener("click", () => deleteTemplate(tpl.id));
    actions.append(apply, remove);
    item.append(name, meta, actions);
    list.append(item);
  });
}

async function saveTemplate() {
  const values = await modal.open({
    heading: "Salvar modelo",
    fields: [{ name: "name", label: "Nome do modelo", type: "text", required: true }],
  });
  if (!values?.name?.trim()) return;
  const templates = getTemplates();
  templates.push({
    id: randomId(),
    name: values.name.trim(),
    week: currentWeek,
    fields: uiState.getFieldValues(),
    checks: plannerDoc.checks,
    durations: getDurations(),
  });
  writeJSON(KEY.templates, templates);
  renderTemplateSelect();
  renderTemplatesList();
  uiState.showStatus("Modelo salvo ✓");
}

async function applyTemplate(templateId = els.templateSelect?.value) {
  const template = getTemplates().find((tpl) => tpl.id === templateId);
  if (!template) {
    uiState.showStatus("Selecione um modelo.");
    return;
  }
  if (!await modal.confirm({ heading: "Aplicar modelo", detail: `“${template.name}” substituirá os campos atuais.`, confirmLabel: "Aplicar" })) return;
  uiState.applyFieldValues(template.fields || {});
  plannerDoc.checks = { ...(template.checks || {}) };
  $$(".slot-check").forEach((item) => { item.checked = Boolean(plannerDoc.checks[item.dataset.slotCheck]); });
  writeJSON(KEY.durations, template.durations || {});
  applyDurations(template.durations || {});
  syncDoneClasses();
  persistPlanner();
  uiState.showStatus("Modelo aplicado ✓");
}

async function deleteTemplate(templateId = els.templateSelect?.value) {
  const template = getTemplates().find((tpl) => tpl.id === templateId);
  if (!template) {
    uiState.showStatus("Selecione um modelo.");
    return;
  }
  if (!await modal.confirm({ heading: "Excluir modelo", detail: `Excluir “${template.name}”?` })) return;
  writeJSON(KEY.templates, getTemplates().filter((tpl) => tpl.id !== templateId));
  renderTemplateSelect();
  renderTemplatesList();
  uiState.showStatus("Modelo excluído ✓");
}

const backupController = createBackupController({
  storage: {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
    removeItem: (key) => localStorage.removeItem(key),
  },
  app: APP_NAME,
  version: APP_VERSION,
  storageKeys: BACKUP_STORAGE_KEYS,
  collectSnapshot: () => ({ planner: safeParse(readText(KEY.planner, "{}")) }),
  restoreSnapshot: (snapshot) => ({
    planner: JSON.stringify(snapshot && typeof snapshot === "object" ? snapshot.planner ?? snapshot : {}),
  }),
  field: els.backupField,
  download(filename, content) {
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename || `backup-${APP_NAME}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },
  status: (message) => { if (els.backupStatus) els.backupStatus.textContent = message; },
});

async function copyBackup() {
  try {
    await backupController.copy();
    uiState.showStatus("Backup copiado ✓");
  } catch (error) {
    if (els.backupStatus) els.backupStatus.textContent = `Falha ao copiar: ${error.message}`;
  }
}

function downloadBackup() {
  backupController.exportFile(KEY.backupConsolidated);
}

async function restoreBackup() {
  try {
    const payload = JSON.parse(els.backupField.value);
    await backupController.restore(payload, KEY.backupConsolidated);
    reloadFromStorage();
    if (els.backupStatus) els.backupStatus.textContent = "Backup restaurado ✓";
  } catch {
    if (els.backupStatus) els.backupStatus.textContent = "Cole um backup JSON válido para restaurar.";
  }
}

function reloadFromStorage() {
  plannerDoc = loadPlanner();
  applyStoredValues();
  refreshDayProgress();
  renderAgenda();
  renderCapacity();
  refreshMetrics();
  renderGoals();
  renderCalendar();
  renderHistory();
  renderStreak();
}

function bindEvents() {
  els.tabButtons.forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });

  if (els.weekPicker) {
    els.weekPicker.addEventListener("change", () => {
      currentWeek = els.weekPicker.value || weekValueForDate(new Date());
      writeText(KEY.week, currentWeek);
      renderWeekMeta();
      renderCapacity();
      refreshMetrics();
    });
  }

  const prevBtn = $("#week-prev");
  if (prevBtn) prevBtn.addEventListener("click", () => shiftWeek(-1));

  const nextBtn = $("#week-next");
  if (nextBtn) nextBtn.addEventListener("click", () => shiftWeek(1));

  if (els.grid) {
    els.grid.addEventListener("click", (event) => {
      const card = event.target.closest(".day-card");
      if (!card) return;
      if (event.target.closest("input, button, [contenteditable]")) return;
      selectDay(card.dataset.day);
    });
  }

  document.addEventListener("input", (event) => {
    if (event.target.matches?.("[data-editable]")) {
      syncEmptySlots();
      debouncedPersist();
    }
  });

  document.addEventListener("focusout", (event) => {
    if (event.target.matches?.("[data-editable]")) syncEmptySlots();
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches?.("[data-slot-check], [data-checklist], [data-priority]")) {
      if (event.target.matches?.("[data-slot-check]")) {
        uiState.toggleDoneClass(event.target, event.target.checked);
        if (event.target.checked && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
          try { navigator.vibrate(12); } catch {}
        }
      } else {
        syncDoneClasses();
      }
      persistPlanner();
    }
  });

  document.addEventListener("paste", (event) => {
    const target = event.target.closest?.("[contenteditable]");
    if (!target) return;
    event.preventDefault();
    const text = (event.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, text);
  });

  document.addEventListener("click", (event) => {
    const chip = event.target.closest?.(".duration-chip");
    if (chip) {
      editDuration(chip);
      return;
    }
    const add = event.target.closest?.(".period-add");
    if (!add) return;
    const period = add.closest(".day-period");
    const target = $(".schedule-slot.is-empty .slot-text", period) || $(".schedule-slot .slot-text", period);
    if (!target) return;
    target.closest(".schedule-slot").classList.remove("is-empty");
    period.classList.remove("is-full");
    target.focus();
  });

  const printBtn = $("#print-now");
  if (printBtn) printBtn.addEventListener("click", () => window.print());

  const tplSave = $("#template-save");
  if (tplSave) tplSave.addEventListener("click", saveTemplate);

  const agendaAdd = $("#agenda-add");
  if (agendaAdd) agendaAdd.addEventListener("click", addAgendaEntry);

  const agendaBlock = $("#agenda-block");
  if (agendaBlock) agendaBlock.addEventListener("click", addBlock);

  const quickFillBtn = $("#quick-fill-apply");
  if (quickFillBtn) quickFillBtn.addEventListener("click", applyQuickFill);

  const histClear = $("#history-clear");
  if (histClear) histClear.addEventListener("click", clearHistory);

  const goalForm = $("#goal-form");
  if (goalForm) {
    goalForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = $("#goal-text")?.value.trim() || "";
      const deadline = $("#goal-deadline")?.value;
      const categoryValue = $("#goal-category")?.value;
      const category = ["trabalho", "saude", "pessoal"].includes(categoryValue) ? categoryValue : "pessoal";
      if (!text) return;
      const goals = getGoals();
      goals.push({
        id: randomId(),
        text,
        deadline: /^\d{4}-\d{2}$/.test(deadline || "") ? deadline : null,
        category,
        done: false,
        createdAt: new Date().toISOString(),
      });
      saveGoals(goals);
      renderGoals();
      event.target.reset();
    });
  }

  $$(".priority-move").forEach((button) => {
    button.addEventListener("click", () => {
      const order = ["p1", "p2", "p3"];
      const index = order.indexOf(button.dataset.target);
      const swapWith = button.dataset.priorityMove === "up" ? index - 1 : index + 1;
      if (index < 0 || swapWith < 0 || swapWith >= order.length) return;
      swapPriorities(order[index], order[swapWith]);
    });
  });

  const calPrev = $("#calendar-prev");
  if (calPrev) {
    calPrev.addEventListener("click", () => {
      calendarCursor.month -= 1;
      if (calendarCursor.month < 0) { calendarCursor.month = 11; calendarCursor.year -= 1; }
      renderCalendar();
    });
  }

  const calNext = $("#calendar-next");
  if (calNext) {
    calNext.addEventListener("click", () => {
      calendarCursor.month += 1;
      if (calendarCursor.month > 11) { calendarCursor.month = 0; calendarCursor.year += 1; }
      renderCalendar();
    });
  }

  const profileName = $("#profile-name");
  if (profileName) {
    profileName.addEventListener("input", (event) => {
      const profile = getProfile();
      profile.name = event.target.value.trim();
      saveProfile(profile);
      renderProfile();
    });
  }

  const profileEmail = $("#profile-email");
  if (profileEmail) {
    profileEmail.addEventListener("change", (event) => {
      const profile = getProfile();
      profile.email = event.target.value.trim();
      saveProfile(profile);
      renderProfile();
    });
  }

  const profileTz = $("#profile-timezone");
  if (profileTz) {
    profileTz.addEventListener("change", (event) => {
      const profile = getProfile();
      profile.timezone = event.target.value;
      saveProfile(profile);
      renderProfile();
      importHolidays();
      renderCalendar();
      renderCapacity();
    });
  }

  const profileFormat = $("#profile-week-format");
  if (profileFormat) {
    profileFormat.addEventListener("change", (event) => {
      const profile = getProfile();
      profile.weekFormat = event.target.value;
      saveProfile(profile);
      renderProfile();
    });
  }

  const holidaySync = $("#holiday-sync");
  if (holidaySync) {
    holidaySync.addEventListener("click", () => {
      importHolidays();
      renderCalendar();
      renderCapacity();
    });
  }

  const avatarBtn = $("#profile-avatar-button");
  if (avatarBtn) avatarBtn.addEventListener("click", () => $("#profile-photo-input")?.click());

  const photoInput = $("#profile-photo-input");
  if (photoInput) {
    photoInput.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      await applyProfilePhoto(file);
    });
  }

  const photoRemove = $("#profile-photo-remove");
  if (photoRemove) {
    photoRemove.addEventListener("click", () => {
      const profile = getProfile();
      delete profile.photo;
      saveProfile(profile);
      renderProfile();
      uiState.showStatus("Foto removida ✓");
    });
  }

  $$(".theme-option").forEach((button) => {
    button.addEventListener("click", () => {
      const prefs = getPrefs();
      prefs.theme = button.dataset.themeOption;
      savePrefs(prefs);
      applyTheme(prefs.theme);
      uiState.showStatus(`Tema ${button.textContent.trim()} aplicado ✓`);
    });
  });

  const prefTheme = $("#pref-theme");
  if (prefTheme) {
    prefTheme.addEventListener("change", (event) => {
      const prefs = getPrefs();
      prefs.theme = event.target.value;
      savePrefs(prefs);
      applyTheme(prefs.theme);
    });
  }

  const prefHideEmpty = $("#pref-hide-empty");
  if (prefHideEmpty) {
    prefHideEmpty.addEventListener("change", (event) => {
      const prefs = getPrefs();
      prefs.hideEmpty = event.target.checked;
      savePrefs(prefs);
      syncEmptySlots();
    });
  }

  const prefDayStart = $("#pref-day-start");
  if (prefDayStart) {
    prefDayStart.addEventListener("change", (event) => {
      const prefs = getPrefs();
      prefs.dayStart = event.target.value;
      savePrefs(prefs);
      uiState.showStatus("Início do dia atualizado ✓");
    });
  }

  $$(".focus-chip[data-focus-minutes]").forEach((chip) => {
    chip.addEventListener("click", () => {
      setFocusDuration(Number(chip.dataset.focusMinutes));
      $$(".focus-chip").forEach((item) => item.classList.remove("is-active"));
      chip.classList.add("is-active");
    });
  });

  const focusCustom = $("#focus-custom");
  if (focusCustom) {
    focusCustom.addEventListener("click", async () => {
      const values = await modal.open({
        heading: "Ciclo personalizado",
        fields: [
          { name: "minutes", label: "Minutos de foco", type: "number", min: 1, max: 240, step: 1, value: Math.round(focusTotalSeconds / 60) },
        ],
      });
      if (!values) return;
      const minutes = Math.round(Number(values.minutes));
      if (!(minutes > 0)) return;
      setFocusDuration(minutes);
      $$(".focus-chip[data-focus-minutes]").forEach((chip) => chip.classList.remove("is-active"));
      uiState.showStatus(`Ciclo de foco ajustado para ${minutes} min ✓`);
    });
  }

  const focusStart = $("#focus-start");
  if (focusStart) {
    focusStart.addEventListener("click", () => {
      if (focusInterval) return;
      focusInterval = window.setInterval(() => {
        focusRemaining -= 1;
        renderFocusClock();
        if (focusRemaining <= 0) {
          stopFocusTimer();
          focusRemaining = focusTotalSeconds;
          renderFocusClock();
          els.focusClock.classList.remove("is-running");
          setFocusStatus("Ciclo concluído 🎉 Faça uma pausa breve.");
          uiState.showStatus("Ciclo de foco concluído 🎉");
        }
      }, 1000);
      els.focusClock.classList.add("is-running");
      setFocusStatus("Em foco — evite trocas de contexto.");
    });
  }

  const focusPause = $("#focus-pause");
  if (focusPause) {
    focusPause.addEventListener("click", () => {
      stopFocusTimer();
      els.focusClock.classList.remove("is-running");
      setFocusStatus(`Pausado em ${els.focusClock.textContent}.`);
    });
  }

  const focusReset = $("#focus-reset");
  if (focusReset) {
    focusReset.addEventListener("click", () => {
      stopFocusTimer();
      focusRemaining = focusTotalSeconds;
      renderFocusClock();
      els.focusClock.classList.remove("is-running");
      setFocusStatus("");
    });
  }

  const backupCopy = $("#backup-copy");
  if (backupCopy) backupCopy.addEventListener("click", copyBackup);

  const backupDl = $("#backup-download");
  if (backupDl) backupDl.addEventListener("click", downloadBackup);

  const backupRes = $("#backup-restore");
  if (backupRes) backupRes.addEventListener("click", restoreBackup);
}

function init() {
  if (els.weekPicker) els.weekPicker.value = currentWeek;
  applyStoredValues();
  refreshDayProgress();
  markTodayCard();
  buildMobileTabs();
  renderWeekMeta();
  renderTemplateSelect();
  renderTemplatesList();
  importHolidays();
  renderAgenda();
  renderCapacity();
  refreshMetrics();
  renderHistory();
  renderStreak();
  renderGoals();
  renderCalendar();
  renderFocusClock();

  const profile = getProfile();
  const nameInput = $("#profile-name");
  if (nameInput) nameInput.value = profile.name;

  const emailInput = $("#profile-email");
  if (emailInput) emailInput.value = profile.email || "";

  const tzInput = $("#profile-timezone");
  if (tzInput) tzInput.value = profile.timezone;

  const formatInput = $("#profile-week-format");
  if (formatInput) formatInput.value = profile.weekFormat;

  const prefs = getPrefs();
  const prefTheme = $("#pref-theme");
  if (prefTheme) prefTheme.value = prefs.theme;

  const hideEmptyInput = $("#pref-hide-empty");
  if (hideEmptyInput) hideEmptyInput.checked = prefs.hideEmpty;

  const dayStartInput = $("#pref-day-start");
  if (dayStartInput) dayStartInput.value = prefs.dayStart;

  applyTheme(prefs.theme);
  renderProfile();

  bindEvents();
  activateTab(readText(KEY.activeTab, "agenda") || "agenda", { persist: false });
}

init();