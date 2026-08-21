export function bootstrapPlanner({ actions, elements, storage, dayKeys, getSelectedMobileDay, onCalendarShift, onAnnualShift, onQuickSlotSelect, onToggleBadDay, onToggleEditLock, onToggleEink, onToggleLocalAlerts }) {
  const {
    buildSchedule, initializeWeekPicker, renderMobileDayTabs, selectMobileDay, renderWeeklyLoad, activateEditing,
    loadPlanner, refreshContinuousBlocks, applySlotMarkValues, applyTheme, applyBadDayMode, applyEditLock,
    applyEinkMode, applyLocalAlerts, renderTemplateOptions, renderHistory, renderMonthlyGoals, renderDailyAgenda,
    renderWeeklyCapacity, renderWorkHours, renderTimeOff, renderHalfDays, renderMonthlyReport,
    renderAnnualAvailability, updateRewardStates, renderAdherence, renderBottlenecks, renderOdanote,
  loadAudioNote, updateLivePlanningStatus, updateDayProgress, queueConsolidatedBackup, runLocalAlerts,
    saveTemplate, loadTemplate, duplicateTemplate, renameTemplate, deleteTemplate, exportTemplates, importTemplates,
    updateTemplateBadge, archiveWeek, addMonthlyGoal, addTimeOff, addRecurringTimeOff, importNationalHolidays,
    addHalfDay, blockDailyTime, addDailyAgendaItem, exportAllDataCsv, clearPlanner, applyQuickFill,
    openPrintPreview, exportRoutineIcs, toggleTheme, enterFocusMode, clearMarks, startFocusTimer,
    resetFocusTimer, exitFocusMode, exportMarkdown, exportBackup, importBackup, copyBackup,
    restoreBackupText, closePrintPreview, printFromPreview, exportPlannerSvg, addBottleneck,
    addOdanote, toggleAudioNote, playAudioNote, deleteAudioNote,
  } = actions;
  const {
    secondaryTools, saveTemplateButton, loadTemplateButton, duplicateTemplateButton, renameTemplateButton,
    deleteTemplateButton, exportTemplatesButton, importTemplatesButton, templateFileInput, categoryFilter,
    templateSelect, archiveWeekButton, addGoalButton, addTimeOffButton, addRecurringTimeOffButton,
    importNationalHolidaysButton, addHalfDayButton, blockDailyTimeButton, addDailyItemButton,
    exportDataCsvButton, calendarPreviousButton, calendarNextButton, annualPreviousButton, annualNextButton,
    clearPlannerButton, grid, quickFillButtons, quickPrintButton, exportIcsButton, toggleThemeButton,
    enterFocusButton, clearMarksButton, focusStartButton, focusResetButton, focusExitButton,
    toggleBadDayButton, toggleEditLockButton, toggleEinkButton, toggleLocalAlertsButton,
    exportMarkdownButton, exportBackupButton, importBackupButton, backupFileInput, copyBackupButton,
    restoreBackupTextButton, printPreviewCloseButton, printPreviewConfirmButton, printMarkMode,
    printPreview, exportPlannerSvgButton, addOdanoteButton, recordAudioNoteButton, playAudioNoteButton,
    deleteAudioNoteButton, focusOverlay,
  } = elements;

  buildSchedule();
  initializeWeekPicker();
  renderMobileDayTabs();
  selectMobileDay(getSelectedMobileDay());
  renderWeeklyLoad();
  activateEditing();
  loadPlanner();
  refreshContinuousBlocks();
  renderWeeklyLoad();
  try {
    applySlotMarkValues(JSON.parse(storage.getItem(storage.keys.slotMarks) || "{}"));
  } catch {
    storage.removeItem(storage.keys.slotMarks);
  }
  applyTheme(storage.getItem(storage.keys.theme) || "system");
  applyBadDayMode(storage.getItem(storage.keys.badDay) === "true");
  applyEditLock(storage.getItem(storage.keys.editLock) === "true");
  applyEinkMode(storage.getItem(storage.keys.eink) === "true");
  applyLocalAlerts(storage.getItem(storage.keys.localAlerts) === "true");
  [renderTemplateOptions, renderHistory, renderMonthlyGoals, renderDailyAgenda, renderWeeklyCapacity, renderWorkHours,
    renderTimeOff, renderHalfDays, renderMonthlyReport, renderAnnualAvailability, updateRewardStates, renderAdherence,
    renderBottlenecks, renderOdanote, loadAudioNote, updateLivePlanningStatus, updateDayProgress, queueConsolidatedBackup,
    runLocalAlerts].forEach((task) => task());
  window.setInterval(updateLivePlanningStatus, 60 * 1000);
  window.setInterval(updateDayProgress, 60 * 1000);
  window.setInterval(runLocalAlerts, 60 * 1000);
  if (window.location.hash === "#acompanhamento" || new URLSearchParams(window.location.search).has("acompanhamento")) secondaryTools.open = true;

  const mobileToolsDialog = document.querySelector("#mobile-tools-dialog");
  const mobileMenuOpenButton = document.querySelector("#mobile-menu-open");
  const mobileMenuCloseButton = document.querySelector("#mobile-menu-close");
  const mobileToolsSlot = document.querySelector("#mobile-tools-slot");
  const plannerToolbar = document.querySelector(".planner-toolbar");
  const routineTools = document.querySelector(".routine-tools");
  const utilityTools = document.querySelector(".utility-tools");
  const mobileLayout = window.matchMedia("(max-width: 640px)");
  const syncMobileToolPlacement = () => {
    if (!mobileToolsSlot || !plannerToolbar || !routineTools || !utilityTools) return;
    (mobileLayout.matches ? mobileToolsSlot : plannerToolbar).append(routineTools, utilityTools);
  };
  syncMobileToolPlacement();
  mobileLayout.addEventListener("change", syncMobileToolPlacement);
  mobileMenuOpenButton?.addEventListener("click", () => mobileToolsDialog?.showModal());
  mobileMenuCloseButton?.addEventListener("click", () => mobileToolsDialog?.close());
  mobileToolsDialog?.addEventListener("click", (event) => { if (event.target === mobileToolsDialog) mobileToolsDialog.close(); });

  saveTemplateButton.addEventListener("click", saveTemplate);
  loadTemplateButton.addEventListener("click", loadTemplate);
  duplicateTemplateButton.addEventListener("click", duplicateTemplate);
  renameTemplateButton.addEventListener("click", renameTemplate);
  deleteTemplateButton.addEventListener("click", deleteTemplate);
  exportTemplatesButton.addEventListener("click", exportTemplates);
  importTemplatesButton.addEventListener("click", () => templateFileInput.click());
  templateFileInput.addEventListener("change", importTemplates);
  categoryFilter.addEventListener("change", renderTemplateOptions);
  templateSelect.addEventListener("change", updateTemplateBadge);
  archiveWeekButton.addEventListener("click", () => archiveWeek(true));
  addGoalButton.addEventListener("click", addMonthlyGoal);
  addTimeOffButton.addEventListener("click", addTimeOff);
  addRecurringTimeOffButton.addEventListener("click", addRecurringTimeOff);
  importNationalHolidaysButton.addEventListener("click", importNationalHolidays);
  addHalfDayButton.addEventListener("click", addHalfDay);
  blockDailyTimeButton.addEventListener("click", blockDailyTime);
  addDailyItemButton.addEventListener("click", addDailyAgendaItem);
  exportDataCsvButton.addEventListener("click", exportAllDataCsv);
  calendarPreviousButton.addEventListener("click", () => onCalendarShift(-1));
  calendarNextButton.addEventListener("click", () => onCalendarShift(1));
  annualPreviousButton.addEventListener("click", () => onAnnualShift(-1));
  annualNextButton.addEventListener("click", () => onAnnualShift(1));
  clearPlannerButton.addEventListener("click", clearPlanner);
  grid.addEventListener("click", (event) => {
    if (event.target.closest(".slot-check, [data-duration]")) return;
    const slot = event.target.closest(".schedule-slot:not(.is-continuation)");
    if (slot) onQuickSlotSelect(slot);
  });
  quickFillButtons.forEach((button) => button.addEventListener("click", () => applyQuickFill(button.dataset.quickFill)));
  document.querySelectorAll("[data-mobile-quick-fill]").forEach((button) => button.addEventListener("click", () => applyQuickFill(button.dataset.mobileQuickFill)));
  document.querySelectorAll("[data-mobile-proxy]").forEach((button) => button.addEventListener("click", () => document.querySelector(button.dataset.mobileProxy)?.click()));
  quickPrintButton.addEventListener("click", openPrintPreview);
  exportIcsButton.addEventListener("click", exportRoutineIcs);
  toggleThemeButton.addEventListener("click", toggleTheme);
  enterFocusButton.addEventListener("click", enterFocusMode);
  clearMarksButton.addEventListener("click", clearMarks);
  focusStartButton.addEventListener("click", startFocusTimer);
  focusResetButton.addEventListener("click", resetFocusTimer);
  focusExitButton.addEventListener("click", exitFocusMode);
  toggleBadDayButton.addEventListener("click", onToggleBadDay);
  toggleEditLockButton.addEventListener("click", onToggleEditLock);
  toggleEinkButton.addEventListener("click", onToggleEink);
  toggleLocalAlertsButton.addEventListener("click", onToggleLocalAlerts);
  exportMarkdownButton.addEventListener("click", exportMarkdown);
  exportBackupButton.addEventListener("click", exportBackup);
  importBackupButton.addEventListener("click", () => backupFileInput.click());
  backupFileInput.addEventListener("change", importBackup);
  copyBackupButton.addEventListener("click", copyBackup);
  restoreBackupTextButton.addEventListener("click", restoreBackupText);
  printPreviewCloseButton.addEventListener("click", closePrintPreview);
  printPreviewConfirmButton.addEventListener("click", printFromPreview);
  printMarkMode.addEventListener("change", () => { if (!printPreview.hidden) openPrintPreview(); });
  window.addEventListener("afterprint", () => { if (!printPreview.hidden) closePrintPreview(); });
  exportPlannerSvgButton.addEventListener("click", exportPlannerSvg);
  document.querySelectorAll("[data-bottleneck]").forEach((button) => button.addEventListener("click", () => addBottleneck(button.dataset.bottleneck)));
  addOdanoteButton.addEventListener("click", addOdanote);
  recordAudioNoteButton.addEventListener("click", toggleAudioNote);
  playAudioNoteButton.addEventListener("click", playAudioNote);
  deleteAudioNoteButton.addEventListener("click", deleteAudioNote);
  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const typing = target?.matches?.("input, select, textarea") || target?.isContentEditable;
    if (event.key === "Escape" && !focusOverlay.hidden) { event.preventDefault(); exitFocusMode(); return; }
    if (event.key === "Escape" && !printPreview.hidden) { event.preventDefault(); closePrintPreview(); return; }
    if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.toLowerCase() === "p") { event.preventDefault(); openPrintPreview(); }
    else if (event.key.toLowerCase() === "t") { event.preventDefault(); toggleTheme(); }
    else if (/^[1-7]$/.test(event.key)) {
      event.preventDefault();
      selectMobileDay(dayKeys[Number(event.key) - 1]);
      document.querySelector(".schedule-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./planner-service-worker.js").catch(() => {}));
}
