export function startPlanner(configuration) {
  // Mantido por compatibilidade de API: a composição atual é autônoma em
  // modules/app.js, que consome getPlannerElements diretamente.
  return configuration;
}

export function getPlannerElements(root = document) {
  const one = (selector) => root.querySelector(selector);
  const all = (selector) => [...root.querySelectorAll(selector)];
  return {
    saveStatus: one(".save-status"),
    tabButtons: all(".tab-button"),
    panels: { agenda: one("#panel-agenda"), tracking: one("#panel-tracking"), settings: one("#panel-settings") },
    weekPicker: one("#week-picker"),
    printWeekRange: one("#print-week-range"),
    weekMetaTitle: one("#week-meta-title"),
    weekMetaRange: one("#week-meta-range"),
    mobileTabs: one("#mobile-day-tabs"),
    grid: one("#schedule-grid"),
    templateSelect: one("#template-select"),
    prioritySummary: one("#priority-summary"),
    agendaList: one("#agenda-list"),
    agendDateLabel: one("#agenda-date-label"),
    agendaSummary: one("#agenda-summary"),
    capacityContent: one("#capacity-content"),
    streakIndicator: one("#streak-indicator"),
    adherenceValue: one("#adherence-value"),
    adherenceFill: one("#adherence-fill"),
    adherenceBar: one(".adherence-bar"),
    adherenceNote: one("#adherence-note"),
    categoryChart: one("#category-chart"),
    goalsList: one("#monthly-goals-list"),
    calendarTitle: one("#calendar-title"),
    calendarGrid: one("#monthly-calendar"),
    historyList: one("#history-list"),
    profileAvatar: one("#profile-avatar"),
    profileSummary: one("#profile-summary"),
    backupField: one("#backup-field"),
    backupStatus: one("#backup-status"),
    focusClock: one("#focus-clock"),
    focusStatus: one("#focus-status"),
    dialogElement: one("#planner-dialog"),
    dialogTitle: one("#dialog-title"),
    dialogDescription: one("#dialog-detail"),
    dialogForm: one(".dialog-form"),
    dialogFields: one("#dialog-fields"),
    dialogSubmit: one("#dialog-submit"),
    dialogCancel: one("#dialog-cancel"),
  };
}
