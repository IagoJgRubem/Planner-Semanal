export function createMetricsController({ elements, days, categoryLabels, scheduleRoot = document, getScheduleEntries, getBlockDuration, getMonthlyActivity, getRitualDates, getCalendarCursor, formatDuration }) {
  const { adherenceChart, sundaySummary, monthlyConsistency, weeklyLoad } = elements;

  function renderAdherence() {
    adherenceChart.replaceChildren();
    const dayScores = days.map((day) => {
      const marks = [...scheduleRoot.querySelectorAll(`.schedule-slot[data-day="${day.key}"]:not(.is-continuation) [data-slot-check]`)];
      const completed = marks.filter((mark) => mark.checked).length;
      return { ...day, total: marks.length, completed, percent: marks.length ? Math.round((completed / marks.length) * 100) : 0 };
    });
    dayScores.forEach((day) => {
      const item = document.createElement("div");
      item.className = "adherence-day";
      const label = document.createElement("span");
      label.textContent = day.label.slice(0, 3);
      const bar = document.createElement("i");
      bar.style.height = `${Math.max(day.percent, 4)}%`;
      bar.title = `${day.percent}% dos blocos marcáveis concluídos`;
      const value = document.createElement("b");
      value.textContent = `${day.percent}%`;
      item.append(label, bar, value);
      adherenceChart.append(item);
    });
    const studyMinutes = [...scheduleRoot.querySelectorAll('.schedule-slot.slot--study:not(.is-continuation) [data-slot-check]:checked')].reduce((sum, mark) => sum + getBlockDuration(mark.dataset.slotCheck), 0);
    const ritualMarks = [...scheduleRoot.querySelectorAll('[data-slot-check$="-22:00"]')];
    const ritualCompleted = ritualMarks.filter((mark) => mark.checked).length;
    sundaySummary.textContent = `Fechamento de domingo · ${formatDuration(studyMinutes)} de estudo marcado · ritual 5S em ${ritualCompleted}/${ritualMarks.length || 5} noite(s).`;
    const cursor = getCalendarCursor();
    const monthPrefix = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const activities = getMonthlyActivity().filter((item) => item.date.startsWith(monthPrefix));
    const studyActivities = activities.filter((item) => item.kind === "study");
    const studyDays = new Set(studyActivities.map((item) => item.date)).size;
    const studyMinutesMonth = studyActivities.reduce((sum, item) => sum + item.minutes, 0);
    const ritualDays = new Set(getRitualDates().filter((date) => date.startsWith(monthPrefix))).size;
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === cursor.getFullYear() && now.getMonth() === cursor.getMonth();
    const daysElapsed = isCurrentMonth ? now.getDate() : new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const businessDaysElapsed = Array.from({ length: daysElapsed }, (_, index) => new Date(cursor.getFullYear(), cursor.getMonth(), index + 1)).filter((date) => date.getDay() !== 0 && date.getDay() !== 6).length;
    monthlyConsistency.innerHTML = `<span><b>${formatDuration(studyMinutesMonth)}</b> estudo no mês</span><span><b>${studyActivities.length}</b> sessão(ões)</span><span><b>${businessDaysElapsed ? Math.round((studyDays / businessDaysElapsed) * 100) : 0}%</b> dias úteis com estudo</span><span><b>${daysElapsed ? Math.round((ritualDays / daysElapsed) * 100) : 0}%</b> ritual 5S</span>`;
  }

  function renderWeeklyLoad() {
    const counts = { trabalho: 0, estudos: 0, pessoal: 0, saude: 0 };
    days.forEach((day) => getScheduleEntries(day.key).forEach((entry) => {
      if (entry.base.includes("slot--work")) counts.trabalho += entry.duration;
      if (entry.base.includes("slot--study")) counts.estudos += entry.duration;
      if (entry.base.includes("slot--personal")) counts.pessoal += entry.duration;
    }));
    const max = Math.max(...Object.values(counts), 1);
    weeklyLoad.replaceChildren();
    Object.entries(categoryLabels).forEach(([category, label]) => {
      const item = document.createElement("div");
      item.className = "weekly-load-item";
      item.dataset.category = category;
      const head = document.createElement("div");
      head.className = "weekly-load-head";
      const name = document.createElement("span");
      name.textContent = label;
      const count = document.createElement("strong");
      count.textContent = formatDuration(counts[category]);
      head.append(name, count);
      const track = document.createElement("div");
      track.className = "weekly-load-track";
      const fill = document.createElement("i");
      fill.style.width = `${(counts[category] / max) * 100}%`;
      track.append(fill);
      item.append(head, track);
      weeklyLoad.append(item);
    });
  }

  return { renderAdherence, renderWeeklyLoad };
}
