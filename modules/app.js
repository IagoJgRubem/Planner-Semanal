import { createAudioNoteStore } from "./audio-store.js";
import { createBackupController } from "./backup-controller.js";
import * as calendar from "./calendar-utils.js";
import { createCapacityReports } from "./capacity-reports.js";
import { createDailyAgendaController } from "./daily-agenda.js";
import { createGoalsCalendarController } from "./goals-calendar.js";
import { buildPlannerSvg, buildRoutineIcs, downloadFile } from "./file-export.js";
import { closePrintPreview as closePreview, openPrintPreview as openPreview } from "./print-preview.js";
import { applyQuickFillPreset } from "./quick-fill.js";
import { createFocusController } from "./focus-timer.js";
import { activatePlannerEditing } from "./editable-content.js";
import { createPlannerRepositories } from "./planner-repositories.js";
import { createPlannerUiState } from "./planner-ui-state.js";
import { createGoalDateTools } from "./goal-date-tools.js";
import { createTemplatesHistoryController } from "./templates-history.js";
import { createScheduleGridController } from "./schedule-grid.js";
import { createPlannerNavigation } from "./planner-navigation.js";
import { createGoalRemindersController } from "./goal-reminders.js";
import { createSlotStateController } from "./slot-state.js";
import { createPlannerPreferences } from "./planner-preferences.js";
import { createFormDialog } from "./form-dialog.js";
import { getPlannerElements, startPlanner } from "./app-shell.js";
import { storageKeys, categoryLabels, quickFillPresets } from "./app-config.js";
import { days, times, defaults } from "./default-schedule.js";
import { createMetricsController } from "./metrics.js";
import { createJSONStore } from "./storage.js";

const { schedule: storageKey, checklist: checklistStorageKey, priorities: priorityStorageKey, templates: templatesStorageKey, history: historyStorageKey, monthlyGoals: monthlyGoalsStorageKey, dailyAgenda: dailyAgendaStorageKey, dailyBlocks: dailyBlocksStorageKey, workHours: workHoursStorageKey, timeOff: timeOffStorageKey, halfDays: halfDayStorageKey, slotMarks: slotMarksStorageKey, ritualStreak: ritualStreakStorageKey, theme: themeStorageKey, durations: durationsStorageKey, bottlenecks: bottleneckStorageKey, odanote: odanoteStorageKey, badDay: badDayStorageKey, editLock: editLockStorageKey, eink: einkStorageKey, holidayImport: holidayImportStorageKey, localAlerts: localAlertsStorageKey, activity: activityStorageKey, weekPicker: weekPickerStorageKey, consolidatedBackup: consolidatedBackupStorageKey } = storageKeys;
const plannerStorage = createJSONStore();
const audioStore = createAudioNoteStore();
const plannerElements = getPlannerElements(document);
const plannerRoot = document.querySelector(".planner-page");
const {
  plannerDialogElement, plannerDialogTitle, plannerDialogDescription, plannerDialogForm, plannerDialogFields, plannerDialogSubmit, plannerDialogCancel,
  grid, saveStatus, prioritySummary, weekPicker, weekRangeDisplay, templateSelect, templateCategory, categoryFilter, templateCategoryBadge, loadTemplateButton, saveTemplateButton, duplicateTemplateButton, renameTemplateButton, deleteTemplateButton, exportTemplatesButton, importTemplatesButton, templateFileInput, archiveWeekButton,
  historyList, streakIndicator, goalCategory, goalDeadline, goalReminderTime, goalRecurring, addGoalButton, monthlyGoalsList, categoryChart, weeklyLoad, exportDataCsvButton, calendarLabel, monthlyCalendar, calendarPreviousButton, calendarNextButton, dailyAgendaDate, dailyAgendaSummary, dailyAgendaList, blockDailyTimeButton, addDailyItemButton,
  capacityContent, workHoursContent, timeOffDate, timeOffLabel, addTimeOffButton, recurringTimeOffDay, addRecurringTimeOffButton, importNationalHolidaysButton, timeOffList, halfDayDate, halfDayLabel, addHalfDayButton, halfDayList, monthlyReportContent, annualPreviousButton, annualNextButton, annualLabel, annualSummary, annualMonths, clearPlannerButton, secondaryTools, mobileDayTabs, livePlanningStatus,
  quickPrintButton, quickFillSelection, mobileQuickFillSelection, quickFillButtons, exportIcsButton, toggleThemeButton, enterFocusButton, clearMarksButton, focusOverlay, focusActiveBlock, focusClock, focusStartButton, focusResetButton, focusExitButton, dayProgressFill, dayProgressLabel, toggleBadDayButton, toggleEditLockButton, toggleEinkButton, toggleLocalAlertsButton, exportMarkdownButton, exportBackupButton, importBackupButton, exportPlannerSvgButton, backupFileInput, backupPayloadField, copyBackupButton, restoreBackupTextButton,
  printPreview, printPreviewSheet, printPreviewCloseButton, printPreviewConfirmButton, printMarkMode, adherenceChart, sundaySummary, monthlyConsistency, bottleneckList, odanoteSubject, odanoteText, addOdanoteButton, odanoteList, audioNoteStatus, recordAudioNoteButton, playAudioNoteButton, deleteAudioNoteButton,
} = plannerElements;
const plannerDialog = createFormDialog({
  element: plannerDialogElement, title: plannerDialogTitle, description: plannerDialogDescription, form: plannerDialogForm, fields: plannerDialogFields, submitButton: plannerDialogSubmit, cancelButton: plannerDialogCancel,
});
let calendarCursor = new Date();
calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
let selectedCalendarDate = "";
let annualCursor = calendarCursor.getFullYear();
let selectedMobileDay = days[(new Date().getDay() + 6) % 7].key;
let mediaRecorder = null;
let audioChunks = [];
let audioNoteUrl = "";
let audioRecordingTimeoutId = null;
let feedbackAudioContext = null;
let selectedQuickSlot = null;
let scheduleGridController = null;

function buildSchedule() {
  return scheduleGridController.build();
}

function getScheduleEntries(dayKey) {
  return scheduleGridController.getScheduleEntries(dayKey);
}

function slotContentForTime(dayKey, time) {
  return scheduleGridController.slotContentForTime(dayKey, time);
}

function refreshContinuousBlocks() {
  return scheduleGridController.refreshContinuousBlocks();
}

function allChecklistItems() {
  return [...plannerRoot.querySelectorAll("[data-checklist]")];
}

function feedbackCheck() {
  if (navigator.vibrate) navigator.vibrate(15);
  playFeedbackTone({ frequency: 170, duration: 0.08, volume: 0.025, type: "square" });
}

function getFeedbackAudioContext() {
  if (feedbackAudioContext?.state !== "closed") return feedbackAudioContext;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  feedbackAudioContext = new AudioContext();
  return feedbackAudioContext;
}

function playFeedbackTone({ frequency, duration, volume, type = "sine" }) {
  try {
    const context = getFeedbackAudioContext();
    const schedule = () => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
    };
    if (context.state === "suspended") context.resume().then(schedule).catch(() => {});
    else schedule();
  } catch { /* Feedback visual continua disponível sem áudio. */ }
}

const { allEditables, allSlotMarks, allDurationFields, getBlockDurations, getBlockDuration, saveBlockDurations, getSlotMarkValues, applySlotMarkValues, saveSlotMarks } = createSlotStateController({
  root: plannerRoot,
  durationsStorageKey, slotMarksStorageKey,
  queueBackup: () => queueConsolidatedBackup(),
  onDurationsSaved: () => { refreshContinuousBlocks(); updateGoalReminders(); renderWeeklyLoad(); renderWeeklyCapacity(); renderAdherence(); showStatus("Duração do bloco atualizada."); },
  onSlotMarksSaved: () => { updateRitualStreak(); updateRewardStates(); renderAdherence(); },
});

const metricsController = createMetricsController({ elements: { adherenceChart, sundaySummary, monthlyConsistency, weeklyLoad }, days, categoryLabels, scheduleRoot: grid, getScheduleEntries, getBlockDuration, getMonthlyActivity, getRitualDates, getCalendarCursor: () => calendarCursor, formatDuration });
const renderAdherence = metricsController.renderAdherence;
const renderWeeklyLoad = metricsController.renderWeeklyLoad;

function getMonthlyActivity() {
  try {
    const saved = JSON.parse(localStorage.getItem(activityStorageKey) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    localStorage.removeItem(activityStorageKey);
    return [];
  }
}

function recordMonthlyActivity(mark) {
  const slot = mark.closest(".schedule-slot");
  if (!slot || !mark.checked || !slot.dataset.baseClass.includes("slot--study")) return;
  const date = localDateKey(new Date());
  const id = `${date}-${mark.dataset.slotCheck}`;
  const items = getMonthlyActivity();
  if (items.some((item) => item.id === id)) return;
  items.push({ id, date, kind: "study", minutes: getBlockDuration(mark.dataset.slotCheck) });
  localStorage.setItem(activityStorageKey, JSON.stringify(items));
  queueConsolidatedBackup();
}

function getBottlenecks() {
  try {
    const saved = JSON.parse(localStorage.getItem(bottleneckStorageKey) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    localStorage.removeItem(bottleneckStorageKey);
    return [];
  }
}

function saveBottlenecks(items) {
  localStorage.setItem(bottleneckStorageKey, JSON.stringify(items));
  queueConsolidatedBackup();
}

function renderBottlenecks() {
  bottleneckList.replaceChildren();
  const items = getBottlenecks();
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "bottleneck-empty";
    empty.textContent = "Registre um desvio para orientar a próxima melhoria Kaizen.";
    bottleneckList.append(empty);
    return;
  }
  items.slice().reverse().forEach((item) => {
    const row = document.createElement("div");
    row.className = "bottleneck-item";
    const label = document.createElement("span");
    label.textContent = item.label;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Excluir";
    remove.addEventListener("click", () => {
      saveBottlenecks(getBottlenecks().filter((entry) => entry.id !== item.id));
      renderBottlenecks();
    });
    row.append(label, remove);
    bottleneckList.append(row);
  });
}

function addBottleneck(label) {
  const items = getBottlenecks();
  items.push({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, label, date: new Date().toISOString() });
  saveBottlenecks(items);
  renderBottlenecks();
  showStatus("Gargalo registrado para a revisão semanal.");
}

function getOdanote() {
  try {
    const saved = JSON.parse(localStorage.getItem(odanoteStorageKey) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    localStorage.removeItem(odanoteStorageKey);
    return [];
  }
}

function saveOdanote(items) {
  localStorage.setItem(odanoteStorageKey, JSON.stringify(items));
  queueConsolidatedBackup();
}

function renderOdanote() {
  odanoteList.replaceChildren();
  const items = getOdanote();
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "odanote-empty";
    empty.textContent = "Nenhum erro registrado. Use esta lista para a revisão de sábado.";
    odanoteList.append(empty);
    return;
  }
  items.slice().reverse().forEach((item) => {
    const row = document.createElement("div");
    row.className = "odanote-item";
    const subject = document.createElement("b");
    subject.textContent = item.subject;
    const text = document.createElement("span");
    text.textContent = item.text;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Excluir";
    remove.addEventListener("click", () => {
      saveOdanote(getOdanote().filter((entry) => entry.id !== item.id));
      renderOdanote();
    });
    row.append(subject, text, remove);
    odanoteList.append(row);
  });
}

function addOdanote() {
  const subject = odanoteSubject.value.trim();
  const text = odanoteText.value.trim();
  if (!subject || !text) {
    showStatus("Informe a matéria e o erro ou dúvida a revisar.");
    return;
  }
  saveOdanote([...getOdanote(), { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, subject, text, createdAt: new Date().toISOString() }]);
  odanoteSubject.value = "";
  odanoteText.value = "";
  renderOdanote();
  showStatus("Erro adicionado ao Odanote.");
}

function audioDatabase() {
  return audioStore;
}

async function saveAudioNote(blob) {
  await audioDatabase().save("morning-summary", blob);
  queueConsolidatedBackup();
}

async function loadAudioNote() {
  try {
    const blob = await audioDatabase().load("morning-summary");
    if (!(blob instanceof Blob)) return;
    audioNoteUrl = URL.createObjectURL(blob);
    playAudioNoteButton.disabled = false;
    deleteAudioNoteButton.disabled = false;
    recordAudioNoteButton.textContent = "Gravar novo resumo";
    audioNoteStatus.textContent = "Resumo salvo localmente e disponível para a próxima manhã.";
  } catch {
    audioNoteStatus.textContent = "O navegador não conseguiu acessar o áudio salvo.";
  }
}

async function removeAudioNote() {
  await audioDatabase().remove("morning-summary");
  queueConsolidatedBackup();
}

async function toggleAudioNote() {
  if (mediaRecorder?.state === "recording") {
    mediaRecorder.stop();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    audioNoteStatus.textContent = "Gravação de áudio não é compatível com este navegador.";
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.addEventListener("dataavailable", (event) => { if (event.data.size) audioChunks.push(event.data); });
    mediaRecorder.addEventListener("stop", async () => {
      window.clearTimeout(audioRecordingTimeoutId);
      if (audioNoteUrl) URL.revokeObjectURL(audioNoteUrl);
      const blob = new Blob(audioChunks, { type: "audio/webm" });
      audioNoteUrl = URL.createObjectURL(blob);
      stream.getTracks().forEach((track) => track.stop());
      recordAudioNoteButton.textContent = "Gravar novo resumo";
      playAudioNoteButton.disabled = false;
      deleteAudioNoteButton.disabled = false;
      await saveAudioNote(blob);
      audioNoteStatus.textContent = "Resumo gravado e salvo localmente para a próxima manhã.";
    });
    mediaRecorder.start();
    recordAudioNoteButton.textContent = "Parar gravação";
    audioNoteStatus.textContent = "Gravando resumo… limite de 2 minutos.";
    audioRecordingTimeoutId = window.setTimeout(() => {
      if (mediaRecorder?.state === "recording") mediaRecorder.stop();
    }, 120000);
  } catch {
    audioNoteStatus.textContent = "Não foi possível acessar o microfone.";
  }
}

function playAudioNote() {
  if (!audioNoteUrl) return;
  new Audio(audioNoteUrl).play().catch(() => { audioNoteStatus.textContent = "O navegador bloqueou a reprodução automática. Tente novamente."; });
}

async function deleteAudioNote() {
  if (audioNoteUrl) URL.revokeObjectURL(audioNoteUrl);
  audioNoteUrl = "";
  await removeAudioNote();
  playAudioNoteButton.disabled = true;
  deleteAudioNoteButton.disabled = true;
  recordAudioNoteButton.textContent = "Gravar resumo";
  audioNoteStatus.textContent = "Resumo removido desta sessão.";
}

function getRitualDates() {
  try {
    const dates = JSON.parse(localStorage.getItem(ritualStreakStorageKey) || "[]");
    return Array.isArray(dates) ? dates : [];
  } catch {
    localStorage.removeItem(ritualStreakStorageKey);
    return [];
  }
}

function updateRitualStreak() {
  const today = new Date();
  const todayDayKey = days[(today.getDay() + 6) % 7].key;
  const ritual = document.querySelector(`[data-slot-check="${todayDayKey}-22:00"]`);
  const todayKey = localDateKey(today);
  const dates = new Set(getRitualDates());
  if (ritual?.checked) dates.add(todayKey);
  else dates.delete(todayKey);
  const savedDates = [...dates].sort();
  localStorage.setItem(ritualStreakStorageKey, JSON.stringify(savedDates));
  let streak = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  while (dates.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  document.documentElement.dataset.ritualStreak = String(streak);
  return streak;
}

function applyTheme(theme) {
  const resolvedTheme = theme === "system" ? "" : theme;
  if (resolvedTheme) document.documentElement.dataset.theme = resolvedTheme;
  else document.documentElement.removeAttribute("data-theme");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolvedTheme === "dark" ? "#0b0f19" : "#fffefa");
  toggleThemeButton.setAttribute("aria-pressed", String(resolvedTheme === "dark"));
  toggleThemeButton.textContent = resolvedTheme === "dark" ? "Claro" : "Tema";
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(themeStorageKey, nextTheme);
  queueConsolidatedBackup();
  applyTheme(nextTheme);
}

const { allPriorityItems, getFieldValues, getChecklistValues, getPriorityValues, applyFieldValues, applyChecklistValues, applyPriorityValues, updatePrioritySummary, showStatus } = createPlannerUiState({ root: plannerRoot, prioritySummary, saveStatus, allEditables, allChecklistItems });

function loadPlanner() {
  applyFieldValues(plannerStorage.read(storageKey, {}));
  applyChecklistValues(plannerStorage.read(checklistStorageKey, {}));
  applyPriorityValues(plannerStorage.read(priorityStorageKey, {}));
}

function savePlanner() {
  refreshContinuousBlocks();
  plannerStorage.write(storageKey, getFieldValues());
  plannerStorage.write(checklistStorageKey, getChecklistValues());
  plannerStorage.write(priorityStorageKey, getPriorityValues());
  queueConsolidatedBackup();
  updateGoalReminders();
  renderWeeklyLoad();
  renderWeeklyCapacity();
  updatePrioritySummary();
  showStatus("Alterações salvas neste navegador.");
}

const { normalizeCategory, getTemplates, saveTemplates, getHistory, saveHistory, getMonthlyGoals, saveMonthlyGoals, getDailyAgenda, saveDailyAgenda, getDailyBlocks, saveDailyBlocks, getTimeOff, saveTimeOff, timeOffForDate } = createPlannerRepositories({
  storage: plannerStorage,
  keys: { templates: templatesStorageKey, history: historyStorageKey, monthlyGoals: monthlyGoalsStorageKey, dailyAgenda: dailyAgendaStorageKey, dailyBlocks: dailyBlocksStorageKey, timeOff: timeOffStorageKey },
  queueBackup: () => queueConsolidatedBackup(), categoryLabels, dayKeyFromDate,
});

function renderTimeOff() {
  const timeOff = getTimeOff();
  timeOffList.replaceChildren();
  const entries = [
    ...timeOff.dates.map((item) => ({ ...item, type: "date" })),
    ...timeOff.recurringDays.map((dayKey) => ({ dayKey, type: "recurring", label: `Folga recorrente · ${days.find((day) => day.key === dayKey)?.label || dayKey}` })),
  ];
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "time-off-empty";
    empty.textContent = "Nenhum feriado ou dia de folga cadastrado.";
    timeOffList.append(empty);
    return;
  }
  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "time-off-item";
    const text = document.createElement("span");
    text.textContent = entry.type === "date" ? `${formatDate(entry.date)} · ${entry.label || "Folga"}` : entry.label;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Excluir";
    remove.addEventListener("click", () => {
      const updated = getTimeOff();
      if (entry.type === "date") updated.dates = updated.dates.filter((item) => item.id !== entry.id);
      else updated.recurringDays = updated.recurringDays.filter((dayKey) => dayKey !== entry.dayKey);
      saveTimeOff(updated);
      renderTimeOff();
      refreshAvailabilityViews();
      showStatus("Indisponibilidade removida.");
    });
    row.append(text, remove);
    timeOffList.append(row);
  });
}

function addTimeOff() {
  if (!timeOffDate.value) {
    showStatus("Escolha uma data para cadastrar o feriado ou a folga.");
    return;
  }
  const timeOff = getTimeOff();
  if (timeOff.dates.some((item) => item.date === timeOffDate.value)) {
    showStatus("Já existe uma indisponibilidade cadastrada nessa data.");
    return;
  }
  timeOff.dates.push({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, date: timeOffDate.value, label: timeOffLabel.value.trim() || "Feriado / folga" });
  saveTimeOff(timeOff);
  saveHalfDays(getHalfDays().filter((item) => item.date !== timeOffDate.value));
  timeOffDate.value = "";
  timeOffLabel.value = "";
  renderTimeOff();
  renderHalfDays();
  refreshAvailabilityViews();
  showStatus("Feriado ou folga adicionada.");
}

function addRecurringTimeOff() {
  const dayKey = recurringTimeOffDay.value;
  const timeOff = getTimeOff();
  if (timeOff.recurringDays.includes(dayKey)) {
    showStatus("Esse dia já está definido como folga recorrente.");
    return;
  }
  timeOff.recurringDays.push(dayKey);
  saveTimeOff(timeOff);
  renderTimeOff();
  refreshAvailabilityViews();
  showStatus("Folga recorrente adicionada.");
}

async function importNationalHolidays() {
  const year = annualCursor || new Date().getFullYear();
  importNationalHolidaysButton.disabled = true;
  importNationalHolidaysButton.textContent = "Importando…";
  try {
    const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/BR`);
    if (!response.ok) throw new Error("Fonte indisponível");
    const holidays = await response.json();
    const timeOff = getTimeOff();
    const knownDates = new Set(timeOff.dates.map((item) => item.date));
    const imported = holidays.filter((holiday) => holiday.global && !knownDates.has(holiday.date));
    imported.forEach((holiday) => timeOff.dates.push({
      id: `national-${year}-${holiday.date}`,
      date: holiday.date,
      label: `Feriado nacional · ${holiday.localName}`,
      source: "national",
    }));
    saveTimeOff(timeOff);
    localStorage.setItem(holidayImportStorageKey, JSON.stringify({ year, importedAt: new Date().toISOString(), count: imported.length }));
    renderTimeOff();
    refreshAvailabilityViews();
    showStatus(imported.length ? `${imported.length} feriado(s) nacional(is) importado(s) para ${year}.` : `Os feriados nacionais de ${year} já estavam cadastrados.`);
  } catch {
    showStatus("Não foi possível importar os feriados agora. Verifique sua conexão e tente novamente.");
  } finally {
    importNationalHolidaysButton.disabled = false;
    importNationalHolidaysButton.textContent = "Importar feriados nacionais";
  }
}

function getHalfDays() {
  try {
    const saved = JSON.parse(localStorage.getItem(halfDayStorageKey) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    localStorage.removeItem(halfDayStorageKey);
    return [];
  }
}

function saveHalfDays(halfDays) {
  localStorage.setItem(halfDayStorageKey, JSON.stringify(halfDays));
  queueConsolidatedBackup();
}

function halfDayForDate(dateKey, halfDays = getHalfDays()) {
  return halfDays.find((item) => item.date === dateKey) || null;
}

function formatDuration(minutes) {
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}

function dailyCapacity(dateKey, hours = getWorkHours(), timeOff = getTimeOff(), halfDays = getHalfDays()) {
  if (timeOffForDate(dateKey, timeOff)) return 0;
  const baseDuration = workDuration(dayKeyFromDate(dateKey), hours);
  return halfDayForDate(dateKey, halfDays) ? Math.round(baseDuration / 2) : baseDuration;
}

function refreshAvailabilityViews() {
  renderCalendar();
  renderWeeklyCapacity();
  renderMonthlyReport();
  renderAnnualAvailability();
  if (selectedCalendarDate) renderDailyAgenda();
}

function renderHalfDays() {
  const halfDays = getHalfDays();
  halfDayList.replaceChildren();
  if (!halfDays.length) {
    const empty = document.createElement("p");
    empty.className = "half-day-empty";
    empty.textContent = "Nenhuma meia jornada cadastrada.";
    halfDayList.append(empty);
    return;
  }
  halfDays
    .slice()
    .sort((first, second) => first.date.localeCompare(second.date))
    .forEach((entry) => {
      const row = document.createElement("div");
      row.className = "half-day-item";
      const text = document.createElement("span");
      text.textContent = `${formatDate(entry.date)} · ${entry.label || "Meia jornada"} · 50% da jornada`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Excluir";
      remove.addEventListener("click", () => {
        saveHalfDays(getHalfDays().filter((item) => item.id !== entry.id));
        renderHalfDays();
        refreshAvailabilityViews();
        showStatus("Meia jornada removida.");
      });
      row.append(text, remove);
      halfDayList.append(row);
    });
}

function addHalfDay() {
  if (!halfDayDate.value) {
    showStatus("Escolha uma data para cadastrar a meia jornada.");
    return;
  }
  const timeOff = getTimeOff();
  if (timeOffForDate(halfDayDate.value, timeOff)) {
    showStatus("Essa data já está definida como feriado ou folga integral.");
    return;
  }
  if (!workDuration(dayKeyFromDate(halfDayDate.value))) {
    showStatus("Essa data não possui jornada padrão ativa para reduzir pela metade.");
    return;
  }
  const halfDays = getHalfDays();
  if (halfDays.some((item) => item.date === halfDayDate.value)) {
    showStatus("Já existe uma meia jornada cadastrada nessa data.");
    return;
  }
  halfDays.push({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, date: halfDayDate.value, label: halfDayLabel.value.trim() || "Meia jornada" });
  saveHalfDays(halfDays);
  halfDayDate.value = "";
  halfDayLabel.value = "";
  renderHalfDays();
  refreshAvailabilityViews();
  showStatus("Meia jornada adicionada com capacidade proporcional.");
}

function defaultWorkHours() {
  return {
    mon: { enabled: true, start: "09:00", end: "17:00" },
    tue: { enabled: true, start: "09:00", end: "17:00" },
    wed: { enabled: true, start: "09:00", end: "17:00" },
    thu: { enabled: true, start: "09:00", end: "17:00" },
    fri: { enabled: true, start: "09:00", end: "17:00" },
    sat: { enabled: false, start: "09:00", end: "13:00" },
    sun: { enabled: false, start: "09:00", end: "13:00" },
  };
}

function getWorkHours() {
  return { ...defaultWorkHours(), ...plannerStorage.read(workHoursStorageKey, {}) };
}

function saveWorkHours(hours) {
  plannerStorage.write(workHoursStorageKey, hours);
  queueConsolidatedBackup();
}

function workDuration(dayKey, hours = getWorkHours()) {
  const day = hours[dayKey];
  return day?.enabled ? Math.max(timeToMinutes(day.end) - timeToMinutes(day.start), 0) : 0;
}

function renderWorkHours() {
  const hours = getWorkHours();
  workHoursContent.replaceChildren();
  days.forEach((day) => {
    const row = document.createElement("div");
    row.className = "work-hours-row";
    const label = document.createElement("label");
    const enabled = document.createElement("input");
    enabled.type = "checkbox";
    enabled.checked = Boolean(hours[day.key]?.enabled);
    label.append(enabled, document.createTextNode(day.label.slice(0, 3)));
    const start = document.createElement("input");
    start.type = "time";
    start.value = hours[day.key]?.start || "09:00";
    const end = document.createElement("input");
    end.type = "time";
    end.value = hours[day.key]?.end || "17:00";
    const update = () => {
      const updated = getWorkHours();
      updated[day.key] = { enabled: enabled.checked, start: start.value, end: end.value };
      saveWorkHours(updated);
      refreshAvailabilityViews();
    };
    enabled.addEventListener("change", update);
    start.addEventListener("change", update);
    end.addEventListener("change", update);
    row.append(label, start, end);
    workHoursContent.append(row);
  });
}

function rangesOverlap(firstTime, firstDuration, secondTime, secondDuration) {
  return calendar.rangesOverlap(firstTime, firstDuration, secondTime, secondDuration);
}

function isTimeBlocked(dateKey, time, duration, ignoreId = "") {
  return (getDailyBlocks()[dateKey] || []).some((block) => block.id !== ignoreId && rangesOverlap(time, duration, block.time, block.duration));
}

const { localDateKey, dateFromKey, dateWithAddedMonths, materializeRecurringGoals, reminderDaysFor, shouldShowReminderOnDay, formatDate, deadlineInfo, updateGoalAlerts, weekStart, weekKey, calculateStreak } = createGoalDateTools({ days, getGoals: getMonthlyGoals, saveGoals: saveMonthlyGoals, alertElement: document.querySelector("#deadline-alert") });

const { updateGoalReminders, renderCategoryChart } = createGoalRemindersController({
  categoryChart, days, categoryLabels, getGoals: getMonthlyGoals, shouldShowReminderOnDay,
  slotContentForTime, normalizeCategory, deadlineInfo, formatDate,
});

const capacityReports = createCapacityReports({
  elements: { capacityContent, monthlyReportContent },
  getSelectedDate: () => selectedCalendarDate,
  getCalendarCursor: () => calendarCursor,
  weekStart,
  getDailyBlocks,
  getDailyAgenda,
  getTimeOff,
  getHalfDays,
  getWorkHours,
  localDateKey,
  dayKeyFromDate,
  timeOffForDate,
  dailyCapacity,
  getScheduleEntries,
  workDuration,
  timeToMinutes,
  formatDuration,
});
const { renderWeeklyCapacity, renderMonthlyReport } = capacityReports;

const { updateTemplateBadge, renderTemplateOptions, renderHistory } = createTemplatesHistoryController({
  elements: { templateSelect, templateCategoryBadge, categoryFilter, historyList, streakIndicator },
  getTemplates, normalizeCategory, categoryLabels, getHistory, calculateStreak,
  onEditHistory: editHistoryEntry, onDeleteHistory: deleteHistoryEntry,
});

function editHistoryEntry(id) {
  const history = getHistory();
  const entry = history.find((item) => item.id === id);
  if (!entry) return;
  const label = window.prompt("Identificação da semana:", entry.label);
  if (!label || !label.trim()) return;
  const completed = window.prompt(`Prioridades concluídas (0 a ${entry.total}):`, entry.completed);
  if (completed === null) return;
  const safeCompleted = Math.max(0, Math.min(entry.total, Number.parseInt(completed, 10) || 0));
  entry.label = label.trim();
  entry.completed = safeCompleted;
  saveHistory(history);
  renderHistory();
  showStatus("Registro do histórico atualizado.");
}

function deleteHistoryEntry(id) {
  const entry = getHistory().find((item) => item.id === id);
  if (!entry || !window.confirm(`Excluir o registro “${entry.label}”?`)) return;
  saveHistory(getHistory().filter((item) => item.id !== id));
  renderHistory();
  showStatus("Registro do histórico excluído.");
}

const goalsCalendarController = createGoalsCalendarController({
  elements: { monthlyGoalsList, calendarLabel, monthlyCalendar, annualLabel, annualMonths, annualSummary },
  modal: plannerDialog,
  days,
  categoryLabels,
  getGoals: getMonthlyGoals,
  saveGoals: saveMonthlyGoals,
  materializeGoals: materializeRecurringGoals,
  updateGoalReminders,
  renderCategoryChart,
  updateGoalAlerts,
  getCalendarCursor: () => calendarCursor,
  getAnnualCursor: () => annualCursor,
  getSelectedDate: () => selectedCalendarDate,
  setSelectedDate: (dateKey) => { selectedCalendarDate = dateKey; },
  selectCalendarDate,
  getTimeOff,
  getHalfDays,
  timeOffForDate,
  halfDayForDate,
  dailyCapacity,
  getWorkHours,
  workDuration,
  dayKeyFromDate,
  localDateKey,
  normalizeCategory,
  reminderDaysFor,
  deadlineInfo,
  status: showStatus,
  formatDate,
  formatDuration,
});
const { renderMonthlyGoals, renderCalendar, renderAnnualAvailability } = goalsCalendarController;

function dayKeyFromDate(dateKey) {
  const date = dateFromKey(dateKey);
  return days[(date.getDay() + 6) % 7].key;
}

function timeToMinutes(time) {
  return calendar.timeToMinutes(time);
}

const dailyAgendaController = createDailyAgendaController({
  elements: { list: dailyAgendaList, dateLabel: dailyAgendaDate, summary: dailyAgendaSummary, blockButton: blockDailyTimeButton, addButton: addDailyItemButton },
  modal: plannerDialog,
  getSelectedDate: () => selectedCalendarDate,
  dayKeyFromDate,
  getScheduleEntries,
  getMonthlyGoals,
  getAgenda: getDailyAgenda,
  getBlocks: getDailyBlocks,
  saveAgenda: saveDailyAgenda,
  saveBlocks: saveDailyBlocks,
  dailyCapacity,
  timeOffForDate,
  formatDuration,
  renderWeeklyCapacity,
  isTimeBlocked,
  status: showStatus,
});

const {
  render: renderDailyAgenda,
  add: addDailyAgendaItem,
  block: blockDailyTime,
  editBlock: editDailyBlock,
  removeBlock: deleteDailyBlock,
  edit: editDailyAgendaItem,
  remove: deleteDailyAgendaItem,
  move: moveDailyAgendaItem,
} = dailyAgendaController;

function selectCalendarDate(dateKey) {
  selectedCalendarDate = dateKey;
  const selectedDate = new Date(`${dateKey}T12:00:00`);
  calendarCursor = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  annualCursor = selectedDate.getFullYear();
  renderCalendar();
  renderDailyAgenda();
  renderAnnualAvailability();
}

async function addMonthlyGoal() {
  const values = await plannerDialog.open({
    heading: "Adicionar meta mensal",
    detail: "Defina a meta, a categoria e, se desejar, um prazo com lembrete.",
    submitLabel: "Adicionar meta",
    fields: [
      { name: "text", label: "Meta", type: "text", placeholder: "Ex.: concluir dois capítulos", required: true },
      { name: "deadline", label: "Prazo", type: "date", value: goalDeadline.value || "" },
      { name: "reminderTime", label: "Horário do lembrete", type: "time", value: goalReminderTime.value || "08:00" },
      { name: "recurring", label: "Repetir mensalmente", type: "checkbox", checked: goalRecurring.checked },
    ],
  });
  if (!values?.text?.trim()) return;
  if (values.recurring && !values.deadline) {
    showStatus("Escolha um prazo antes de repetir uma meta mensalmente.");
    return;
  }
  const goals = getMonthlyGoals();
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  goals.push({
    id,
    category: normalizeCategory(goalCategory.value),
    text: values.text.trim(),
    done: false,
    deadline: values.deadline || "",
    reminderTime: values.reminderTime || "08:00",
    recurring: Boolean(values.recurring),
    recurrenceId: id,
    reminderDays: days.map((day) => day.key),
    createdAt: new Date().toISOString(),
  });
  saveMonthlyGoals(goals);
  goalDeadline.value = "";
  goalReminderTime.value = "08:00";
  goalRecurring.checked = false;
  renderMonthlyGoals();
  showStatus("Meta mensal adicionada.");
}

function csvValue(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportAllDataCsv() {
  const rows = [["Tipo", "Identificação", "Categoria", "Item", "Concluídas", "Total", "Prazo", "Data de registro"]];
  getHistory().forEach((entry) => {
    const items = Array.isArray(entry.priorities) ? entry.priorities.map((priority) => priority.text).filter(Boolean).join(" | ") : "";
    rows.push(["Semana", entry.label, "Prioridades", items, entry.completed, entry.total, "", entry.createdAt]);
  });
  getMonthlyGoals().forEach((goal) => {
    rows.push(["Meta mensal", "", categoryLabels[normalizeCategory(goal.category)], goal.text, goal.done ? 1 : 0, 1, goal.deadline || "", goal.createdAt]);
  });
  const csv = `\uFEFF${rows.map((row) => row.map(csvValue).join(";")).join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "historico-e-metas-planner-semanal.csv";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showStatus("Histórico e metas exportados em CSV.");
}

function archiveWeek(showNotice = true) {
  const priorities = [1, 2, 3, 4, 5].map((number) => ({
    text: document.querySelector(`[data-editable="priority-${number}"]`).innerText.trim(),
    done: Boolean(document.querySelector(`[data-priority="priority-${number}"]`).checked),
  }));
  if (!priorities.some((priority) => priority.text || priority.done)) {
    if (showNotice) showStatus("Adicione prioridades antes de registrar esta semana.");
    return false;
  }
  const month = document.querySelector('[data-editable="month"]').innerText.trim();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    week: weekKey(),
    label: month || new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
    createdAt: new Date().toISOString(),
    completed: priorities.filter((priority) => priority.done).length,
    total: priorities.length,
    priorities,
  };
  saveHistory([entry, ...getHistory().filter((item) => item.week !== entry.week)]);
  renderHistory();
  if (showNotice) showStatus("Semana registrada no histórico local.");
  return true;
}

function saveTemplate() {
  const name = window.prompt("Nome deste modelo de rotina:");
  if (!name || !name.trim()) return;
  const templates = getTemplates();
  const template = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: name.trim(),
    category: normalizeCategory(templateCategory.value),
    fields: getFieldValues(),
    checklist: getChecklistValues(),
    priorities: getPriorityValues(),
  };
  templates.push(template);
  saveTemplates(templates);
  renderTemplateOptions(template.id);
  showStatus("Modelo de rotina salvo neste navegador.");
}

function loadTemplate() {
  const template = getTemplates().find((item) => item.id === templateSelect.value);
  if (!template) {
    showStatus("Escolha um modelo salvo para carregar.");
    return;
  }
  applyFieldValues(template.fields || {});
  applyChecklistValues(template.checklist || {});
  applyPriorityValues(template.priorities || {});
  templateCategory.value = normalizeCategory(template.category);
  savePlanner();
  showStatus(`Modelo “${template.name}” carregado.`);
}

function renameTemplate() {
  const templates = getTemplates();
  const index = templates.findIndex((item) => item.id === templateSelect.value);
  if (index < 0) {
    showStatus("Escolha um modelo salvo para renomear.");
    return;
  }
  const name = window.prompt("Novo nome do modelo:", templates[index].name);
  if (!name || !name.trim()) return;
  templates[index].name = name.trim();
  saveTemplates(templates);
  renderTemplateOptions(templates[index].id);
  showStatus("Modelo de rotina renomeado.");
}

function duplicateTemplate() {
  const source = getTemplates().find((item) => item.id === templateSelect.value);
  if (!source) {
    showStatus("Escolha um modelo salvo para duplicar.");
    return;
  }
  const name = window.prompt("Nome da nova variação:", `Cópia de ${source.name}`);
  if (!name || !name.trim()) return;
  const copy = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: name.trim(),
    category: normalizeCategory(source.category),
    fields: { ...(source.fields || {}) },
    checklist: { ...(source.checklist || {}) },
    priorities: { ...(source.priorities || {}) },
  };
  const templates = [...getTemplates(), copy];
  saveTemplates(templates);
  categoryFilter.value = "all";
  renderTemplateOptions(copy.id);
  showStatus("Nova variação de modelo criada.");
}

function deleteTemplate() {
  const templates = getTemplates();
  const template = templates.find((item) => item.id === templateSelect.value);
  if (!template) {
    showStatus("Escolha um modelo salvo para excluir.");
    return;
  }
  if (!window.confirm(`Excluir o modelo “${template.name}”?`)) return;
  saveTemplates(templates.filter((item) => item.id !== template.id));
  renderTemplateOptions();
  showStatus("Modelo de rotina excluído.");
}

function exportTemplates() {
  const payload = {
    app: "planner-semanal",
    version: 1,
    exportedAt: new Date().toISOString(),
    templates: getTemplates(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "modelos-planner-semanal.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showStatus("Modelos exportados em arquivo JSON.");
}

function isValidTemplate(item) {
  return item && typeof item.name === "string" && item.name.trim() && typeof item.fields === "object" && !Array.isArray(item.fields);
}

async function importTemplates(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 1024 * 1024) {
    showStatus("O arquivo deve ter no máximo 1 MB.");
    event.target.value = "";
    return;
  }
  try {
    const imported = JSON.parse(await file.text());
    const incoming = Array.isArray(imported) ? imported : imported.templates;
    if (!Array.isArray(incoming)) throw new Error("Estrutura inválida");
    const validTemplates = incoming.filter(isValidTemplate).map((template) => ({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: template.name.trim(),
      category: normalizeCategory(template.category),
      fields: template.fields,
      checklist: template.checklist && typeof template.checklist === "object" ? template.checklist : {},
      priorities: template.priorities && typeof template.priorities === "object" ? template.priorities : {},
    }));
    if (!validTemplates.length) throw new Error("Nenhum modelo válido");
    const templates = [...getTemplates(), ...validTemplates];
    saveTemplates(templates);
    renderTemplateOptions(validTemplates.at(-1).id);
    showStatus(`${validTemplates.length} modelo(s) importado(s).`);
  } catch {
    showStatus("Não foi possível importar este arquivo de modelos.");
  } finally {
    event.target.value = "";
  }
}

function clearPlanner() {
  if (!window.confirm("Limpar todos os campos e iniciar uma nova semana?")) return;
  archiveWeek(false);
  allEditables().forEach((element) => { element.textContent = ""; });
  applyChecklistValues({});
  applyPriorityValues({});
  savePlanner();
  templateSelect.value = "";
  showStatus("Nova semana iniciada. Todos os campos foram limpos.");
}

function exportMarkdown() {
  const week = weekRangeDisplay.textContent.trim() || "Semana atual";
  const lines = [`# Planner Operacional Semanal`, ``, `**Período:** ${week}`, ``, `## Prioridades`];
  allPriorityItems().forEach((item, index) => {
    const text = document.querySelector(`[data-editable="priority-${index + 1}"]`)?.innerText.trim() || "";
    lines.push(`- [${item.checked ? "x" : " "}] ${text || `Prioridade ${index + 1}`}`);
  });
  days.forEach((day) => {
    lines.push(``, `## ${day.label}`);
    getScheduleEntries(day.key).forEach((entry) => {
      const checked = entry.slot.querySelector("[data-slot-check]")?.checked;
      lines.push(`- [${checked ? "x" : " "}] ${entry.time} · ${entry.text} · ${entry.duration} min`);
    });
  });
  lines.push(``, `## Revisão`, getFieldValues()["weekly-focus"] || "", ``, `## Gargalos`, ...getBottlenecks().map((item) => `- ${item.label}`), ``, `## Odanote`, ...getOdanote().map((item) => `- **${item.subject}:** ${item.text}`));
  downloadFile(lines.join("\n"), "planner-semanal.md", "text/markdown;charset=utf-8");
  showStatus("Resumo da semana exportado em Markdown.");
}

const backupController = createBackupController({
  storage: localStorage,
  app: "planner-operacional-semanal",
  version: 3,
  storageKeys: [storageKey, checklistStorageKey, priorityStorageKey, templatesStorageKey, historyStorageKey, monthlyGoalsStorageKey, dailyAgendaStorageKey, dailyBlocksStorageKey, workHoursStorageKey, timeOffStorageKey, halfDayStorageKey, slotMarksStorageKey, ritualStreakStorageKey, durationsStorageKey, bottleneckStorageKey, odanoteStorageKey, badDayStorageKey, editLockStorageKey, einkStorageKey, themeStorageKey, holidayImportStorageKey, localAlertsStorageKey, activityStorageKey, weekPickerStorageKey],
  collectSnapshot: () => ({ week: { value: weekPicker.value, display: weekRangeDisplay.textContent }, planner: { fields: getFieldValues(), checklist: getChecklistValues(), priorities: getPriorityValues(), slotMarks: getSlotMarkValues(), durations: getBlockDurations() }, models: getTemplates(), history: getHistory(), monthlyGoals: getMonthlyGoals(), dailyAgenda: getDailyAgenda(), blockedTimes: getDailyBlocks(), workHours: getWorkHours(), timeOff: getTimeOff(), halfDays: getHalfDays(), settings: { theme: localStorage.getItem(themeStorageKey) || "system", localAlerts: localStorage.getItem(localAlertsStorageKey) === "true" } }),
  restoreSnapshot: (snapshot) => ({ [storageKey]: JSON.stringify(snapshot.planner.fields || {}), [checklistStorageKey]: JSON.stringify(snapshot.planner.checklist || {}), [priorityStorageKey]: JSON.stringify(snapshot.planner.priorities || {}), [slotMarksStorageKey]: JSON.stringify(snapshot.planner.slotMarks || {}), [durationsStorageKey]: JSON.stringify(snapshot.planner.durations || {}), [templatesStorageKey]: JSON.stringify(snapshot.models || []), [historyStorageKey]: JSON.stringify(snapshot.history || []), [monthlyGoalsStorageKey]: JSON.stringify(snapshot.monthlyGoals || []), [dailyAgendaStorageKey]: JSON.stringify(snapshot.dailyAgenda || {}), [dailyBlocksStorageKey]: JSON.stringify(snapshot.blockedTimes || {}), [workHoursStorageKey]: JSON.stringify(snapshot.workHours || {}), [timeOffStorageKey]: JSON.stringify(snapshot.timeOff || []), [halfDayStorageKey]: JSON.stringify(snapshot.halfDays || []), [weekPickerStorageKey]: snapshot.week?.value || weekValueForDate(), [themeStorageKey]: snapshot.settings?.theme || "system", [localAlertsStorageKey]: String(Boolean(snapshot.settings?.localAlerts)) }),
  field: backupPayloadField,
  download: downloadFile,
  status: showStatus,
});
const backupPayloadForExport = backupController.payload;
const queueConsolidatedBackup = () => backupController.queueSync(consolidatedBackupStorageKey);
scheduleGridController = createScheduleGridController({
  root: grid, grid, days, times, defaults, timeToMinutes, getBlockDurations, getBlockDuration,
  durationsStorageKey, queueBackup: queueConsolidatedBackup,
});
const restoreBackupPayload = (payload) => backupController.restore(payload, consolidatedBackupStorageKey);
const exportBackup = () => backupController.exportFile(consolidatedBackupStorageKey);
const copyBackup = backupController.copy;
const importBackup = (event) => backupController.importFile(event, consolidatedBackupStorageKey);
const restoreBackupText = () => backupController.restoreText(consolidatedBackupStorageKey);

function exportPlannerSvg() {
  const svg = buildPlannerSvg({ days, times, entriesForDay: getScheduleEntries });
  downloadFile(svg, "planner-semanal.svg", "image/svg+xml;charset=utf-8");
  showStatus("Imagem SVG do planner exportada.");
}

function updateDayProgress() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const percent = Math.min(100, Math.max(0, (minutes / 1440) * 100));
  dayProgressFill.style.width = `${percent}%`;
  dayProgressLabel.textContent = `${Math.round(percent)}% do dia transcorrido`;
}

function escapeIcsText(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function formatIcsDate(date, time) {
  const [hours, minutes] = String(time).split(":").map(Number);
  const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours || 0, minutes || 0);
  return `${eventDate.getFullYear()}${String(eventDate.getMonth() + 1).padStart(2, "0")}${String(eventDate.getDate()).padStart(2, "0")}T${String(eventDate.getHours()).padStart(2, "0")}${String(eventDate.getMinutes()).padStart(2, "0")}00`;
}

function exportRoutineIcs() {
  const monday = mondayFromWeekValue(weekPicker.value) || weekStart(new Date());
  const content = buildRoutineIcs({ monday, days, entriesForDay: getScheduleEntries });
  downloadFile(content, "rotina-semanal.ics", "text/calendar;charset=utf-8");
  showStatus("Arquivo .ics gerado para importar no calendário.");
}

const { updateRewardStates, applyBadDayMode, applyEditLock, applyEinkMode, applyLocalAlerts, runLocalAlerts } = createPlannerPreferences({
  keys: { badDay: badDayStorageKey, editLock: editLockStorageKey, eink: einkStorageKey, localAlerts: localAlertsStorageKey },
  elements: { badDayButton: toggleBadDayButton, editLockButton: toggleEditLockButton, einkButton: toggleEinkButton, localAlertsButton: toggleLocalAlertsButton },
  days, toDateKey: localDateKey, timeToMinutes, allEditables, allDurationFields,
  queueBackup: queueConsolidatedBackup, status: showStatus,
});

const { initializeWeekPicker, renderMobileDayTabs, selectMobileDay, getCurrentBlock, updateLivePlanningStatus } = createPlannerNavigation({
  elements: { weekPicker, weekRangeDisplay, mobileDayTabs, grid, livePlanningStatus },
  calendar, days, weekPickerStorageKey, getEntries: getScheduleEntries,
  getSelectedMobileDay: () => selectedMobileDay,
  setSelectedMobileDay: (dayKey) => { selectedMobileDay = dayKey; },
  updateRitualStreak,
  onWeekChange: () => { queueConsolidatedBackup(); showStatus("Semana atualizada."); },
});

const focusController = createFocusController({ elements: { overlay: focusOverlay, activeBlock: focusActiveBlock, clock: focusClock, startButton: focusStartButton, enterButton: enterFocusButton }, getCurrentBlock, playChime: () => playFeedbackTone({ frequency: 660, duration: 0.6, volume: 0.05 }), status: showStatus });
const startFocusTimer = focusController.start;
const enterFocusMode = focusController.enter;
const exitFocusMode = focusController.exit;
const resetFocusTimer = focusController.reset;

function updateQuickFillSelection() {
  document.querySelectorAll(".schedule-slot.is-quick-selected").forEach((slot) => slot.classList.remove("is-quick-selected"));
  if (!selectedQuickSlot || selectedQuickSlot.classList.contains("is-continuation")) {
    [quickFillSelection, mobileQuickFillSelection].filter(Boolean).forEach((element) => { element.textContent = "Selecione um bloco da grade."; });
    return;
  }
  selectedQuickSlot.classList.add("is-quick-selected");
  const day = days.find((item) => item.key === selectedQuickSlot.dataset.day);
  [quickFillSelection, mobileQuickFillSelection].filter(Boolean).forEach((element) => { element.textContent = `${day?.label || "Dia"}, ${selectedQuickSlot.dataset.time}`; });
}

function ensureQuickFillMark(slot, text, type) {
  const existing = slot.querySelector(".slot-check");
  const supportsMark = type === "work" || (type === "study" && ["06:00", "07:00", "08:00"].includes(slot.dataset.time)) || text.includes("Ritual 5S");
  if (!supportsMark) {
    existing?.remove();
    return;
  }
  if (existing) return;
  const day = days.find((item) => item.key === slot.dataset.day);
  const mark = document.createElement("label");
  mark.className = "slot-check";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.dataset.slotCheck = `${slot.dataset.day}-${slot.dataset.time}`;
  input.setAttribute("aria-label", `Concluir ${text} em ${day?.label || "dia"}`);
  input.addEventListener("change", () => {
    input.closest(".schedule-slot")?.classList.toggle("is-marked", input.checked);
    feedbackCheck();
    recordMonthlyActivity(input);
    saveSlotMarks();
    updateLivePlanningStatus();
    showStatus("Marcação salva neste navegador.");
  });
  mark.append(input);
  slot.append(mark);
}

function syncQuickFillStatus(slot, text, type) {
  slot.querySelector(".slot-status")?.remove();
  const id = `${slot.dataset.day}-${slot.dataset.time}`;
  const status = type === "study" && slot.dataset.time === "06:00"
    ? "Foco"
    : type === "work" && slot.dataset.day === "mon" && slot.dataset.time === "13:00"
      ? "Trabalho"
      : id === "wed-22:00" && /ritual 5s/i.test(text)
        ? "Recuperação"
        : "";
  if (!status || !text) return;
  const badge = document.createElement("span");
  badge.className = `slot-status slot-status--${type}`;
  badge.textContent = status;
  slot.append(badge);
}

function applyQuickFill(presetKey) {
  if (!selectedQuickSlot) {
    showStatus("Selecione primeiro um bloco da grade.");
    return;
  }
  const preset = quickFillPresets[presetKey];
  if (!preset) return;
  refreshContinuousBlocks();
  const result = applyQuickFillPreset({
    selectedSlot: selectedQuickSlot,
    preset,
    times,
    getSlot: (dayKey, time) => document.querySelector(`[data-editable="slot-${dayKey}-${time}"]`)?.closest(".schedule-slot"),
    getDurations: getBlockDurations,
    persistDurations: (durations) => plannerStorage.write(durationsStorageKey, durations),
    ensureMark: ensureQuickFillMark,
    syncStatus: syncQuickFillStatus,
  });
  savePlanner();
  updateRewardStates();
  renderAdherence();
  updateLivePlanningStatus();
  selectedQuickSlot = document.querySelector(`[data-editable="slot-${result.dayKey}-${times[result.startIndex]}"]`)?.closest(".schedule-slot") || null;
  updateQuickFillSelection();
  showStatus(`${preset.label} aplicado${preset.type === "work" && result.appliedSpan < preset.span ? ` por ${result.appliedSpan}h` : ""}.`);
}

function applyPreviewMarks(previewPage) {
  const mode = printMarkMode.value;
  previewPage.querySelectorAll(".slot-check").forEach((mark) => {
    const checked = mark.querySelector("input")?.checked;
    mark.replaceChildren(Object.assign(document.createElement("span"), { className: "print-mark-box", textContent: mode === "record" && checked ? "✓" : "" }));
  });
}

function openPrintPreview() {
  openPreview({ source: document.querySelector(".planner-page"), sheet: printPreviewSheet, dialog: printPreview, closeButton: printPreviewCloseButton, markMode: printMarkMode.value });
}

function closePrintPreview() {
  closePreview({ dialog: printPreview, returnFocus: quickPrintButton });
}

function printFromPreview() {
  document.body.dataset.printMarkMode = printMarkMode.value;
  window.print();
}

function clearMarks() {
  if (!window.confirm("Limpar as marcações do checklist, prioridades e blocos concluídos?")) return;
  applyChecklistValues({});
  applyPriorityValues({});
  applySlotMarkValues({});
  savePlanner();
  saveSlotMarks();
  showStatus("Marcações limpas. A rotina e as anotações foram preservadas.");
}

const activateEditing = () => activatePlannerEditing({ allEditables, allChecklistItems, allPriorityItems, allSlotMarks, allDurationFields, savePlanner, feedbackCheck, recordMonthlyActivity, saveSlotMarks, updateLivePlanningStatus, status: showStatus, saveBlockDurations });

startPlanner({
  actions: { buildSchedule, initializeWeekPicker, renderMobileDayTabs, selectMobileDay, renderWeeklyLoad, activateEditing, loadPlanner, refreshContinuousBlocks, applySlotMarkValues, applyTheme, applyBadDayMode, applyEditLock, applyEinkMode, applyLocalAlerts, renderTemplateOptions, renderHistory, renderMonthlyGoals, renderDailyAgenda, renderWeeklyCapacity, renderWorkHours, renderTimeOff, renderHalfDays, renderMonthlyReport, renderAnnualAvailability, updateRewardStates, renderAdherence, renderBottlenecks, renderOdanote, loadAudioNote, updateLivePlanningStatus, updateDayProgress, queueConsolidatedBackup, runLocalAlerts, saveTemplate, loadTemplate, duplicateTemplate, renameTemplate, deleteTemplate, exportTemplates, importTemplates, updateTemplateBadge, archiveWeek, addMonthlyGoal, addTimeOff, addRecurringTimeOff, importNationalHolidays, addHalfDay, blockDailyTime, addDailyAgendaItem, exportAllDataCsv, clearPlanner, applyQuickFill, openPrintPreview, exportRoutineIcs, toggleTheme, enterFocusMode, clearMarks, startFocusTimer, resetFocusTimer, exitFocusMode, exportMarkdown, exportBackup, importBackup, copyBackup, restoreBackupText, closePrintPreview, printFromPreview, exportPlannerSvg, addBottleneck, addOdanote, toggleAudioNote, playAudioNote, deleteAudioNote },
  elements: { secondaryTools, saveTemplateButton, loadTemplateButton, duplicateTemplateButton, renameTemplateButton, deleteTemplateButton, exportTemplatesButton, importTemplatesButton, templateFileInput, categoryFilter, templateSelect, archiveWeekButton, addGoalButton, addTimeOffButton, addRecurringTimeOffButton, importNationalHolidaysButton, addHalfDayButton, blockDailyTimeButton, addDailyItemButton, exportDataCsvButton, calendarPreviousButton, calendarNextButton, annualPreviousButton, annualNextButton, clearPlannerButton, grid, quickFillButtons, quickPrintButton, exportIcsButton, toggleThemeButton, enterFocusButton, clearMarksButton, focusStartButton, focusResetButton, focusExitButton, toggleBadDayButton, toggleEditLockButton, toggleEinkButton, toggleLocalAlertsButton, exportMarkdownButton, exportBackupButton, importBackupButton, backupFileInput, copyBackupButton, restoreBackupTextButton, printPreviewCloseButton, printPreviewConfirmButton, printMarkMode, printPreview, exportPlannerSvgButton, addOdanoteButton, recordAudioNoteButton, playAudioNoteButton, deleteAudioNoteButton, focusOverlay },
  storage: { getItem: (key) => localStorage.getItem(key), removeItem: (key) => localStorage.removeItem(key), keys: { slotMarks: slotMarksStorageKey, theme: themeStorageKey, badDay: badDayStorageKey, editLock: editLockStorageKey, eink: einkStorageKey, localAlerts: localAlertsStorageKey } },
  dayKeys: days.map((day) => day.key),
  getSelectedMobileDay: () => selectedMobileDay,
  onCalendarShift: (offset) => { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + offset, 1); renderCalendar(); renderMonthlyReport(); },
  onAnnualShift: (offset) => { annualCursor += offset; renderAnnualAvailability(); },
  onQuickSlotSelect: (slot) => { selectedQuickSlot = slot; updateQuickFillSelection(); },
  onToggleBadDay: () => applyBadDayMode(!document.body.classList.contains("is-bad-day")),
  onToggleEditLock: () => applyEditLock(!document.body.classList.contains("is-edit-locked")),
  onToggleEink: () => applyEinkMode(!document.body.classList.contains("is-eink")),
  onToggleLocalAlerts: () => applyLocalAlerts(localStorage.getItem(localAlertsStorageKey) !== "true"),
});
