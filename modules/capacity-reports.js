export function createCapacityReports({ elements, getSelectedDate, getCalendarCursor, weekStart, getDailyBlocks, getDailyAgenda, getTimeOff, getHalfDays, getWorkHours, localDateKey, dayKeyFromDate, timeOffForDate, dailyCapacity, getScheduleEntries, workDuration, timeToMinutes, formatDuration }) {
  const { capacityContent, monthlyReportContent } = elements;

  function renderWeeklyCapacity() {
    const selectedDate = getSelectedDate();
    const reference = selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date();
    const monday = weekStart(reference);
    const blocks = getDailyBlocks();
    const agenda = getDailyAgenda();
    const timeOff = getTimeOff();
    const halfDays = getHalfDays();
    const hours = getWorkHours();
    let blockedMinutes = 0;
    let customMinutes = 0;
    let totalCapacity = 0;
    let scheduleMinutes = 0;
    for (let offset = 0; offset < 7; offset += 1) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + offset);
      const key = localDateKey(date);
      const unavailable = timeOffForDate(key, timeOff);
      totalCapacity += dailyCapacity(key, hours, timeOff, halfDays);
      if (!unavailable) scheduleMinutes += getScheduleEntries(dayKeyFromDate(key)).reduce((sum, entry) => sum + entry.duration, 0);
      blockedMinutes += (blocks[key] || []).reduce((sum, block) => sum + Number(block.duration || 0), 0);
      customMinutes += (agenda[key] || []).reduce((sum, entry) => sum + Number(entry.duration || 60), 0);
    }
    const available = Math.max(totalCapacity - blockedMinutes, 0);
    const planned = scheduleMinutes + customMinutes;
    const percentage = available ? Math.min((planned / available) * 100, 100) : 100;
    capacityContent.replaceChildren();
    const text = document.createElement("p");
    text.textContent = `${formatDuration(planned)} planejadas de ${formatDuration(available)} disponíveis nesta semana.`;
    const track = document.createElement("div");
    track.className = "capacity-track";
    const fill = document.createElement("i");
    fill.style.width = `${percentage}%`;
    track.append(fill);
    const note = document.createElement("span");
    note.textContent = planned > available ? "Capacidade excedida: revise blocos ou prioridades." : `${formatDuration(Math.max(available - planned, 0))} ainda disponíveis.`;
    capacityContent.append(text, track, note);
  }

  function renderMonthlyReport() {
    const cursor = getCalendarCursor();
    const reportMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const daysInMonth = new Date(reportMonth.getFullYear(), reportMonth.getMonth() + 1, 0).getDate();
    const blocks = getDailyBlocks();
    const agenda = getDailyAgenda();
    const timeOff = getTimeOff();
    const hours = getWorkHours();
    const halfDays = getHalfDays();
    let workMinutes = 0;
    let breakMinutes = 0;
    let blockedMinutes = 0;
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(reportMonth.getFullYear(), reportMonth.getMonth(), day);
      const dateKey = localDateKey(date);
      const dayKey = dayKeyFromDate(dateKey);
      const unavailable = timeOffForDate(dateKey, timeOff);
      const baseCapacity = workDuration(dayKey, hours);
      const availableCapacity = dailyCapacity(dateKey, hours, timeOff, halfDays);
      const slots = getScheduleEntries(dayKey);
      if (!unavailable) {
        workMinutes += slots.filter((slot) => slot.base.includes("slot--work")).reduce((sum, slot) => sum + slot.duration, 0);
        workMinutes += (agenda[dateKey] || []).reduce((sum, item) => sum + Number(item.duration || 60), 0);
      }
      blockedMinutes += Math.max(baseCapacity - availableCapacity, 0);
      const occupied = slots.filter((slot) => /^\d{2}:\d{2}$/.test(slot.time)).map((slot) => timeToMinutes(slot.time)).sort((a, b) => a - b);
      breakMinutes += occupied.filter((time, index) => index < occupied.length - 1 && time + 60 === occupied[index + 1]).length * 10;
      blockedMinutes += (blocks[dateKey] || []).reduce((sum, block) => sum + Number(block.duration || 0), 0);
    }
    const data = [
      { key: "work", label: "Trabalho", minutes: workMinutes },
      { key: "break", label: "Pausas sugeridas", minutes: breakMinutes },
      { key: "blocked", label: "Bloqueios", minutes: blockedMinutes },
    ];
    const total = Math.max(data.reduce((sum, item) => sum + item.minutes, 0), 1);
    monthlyReportContent.replaceChildren();
    const month = document.createElement("p");
    month.className = "monthly-report-month";
    month.textContent = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(reportMonth);
    const chart = document.createElement("div");
    chart.className = "monthly-report-chart";
    data.forEach((item) => {
      const segment = document.createElement("i");
      segment.dataset.type = item.key;
      segment.style.width = `${(item.minutes / total) * 100}%`;
      chart.append(segment);
    });
    const legend = document.createElement("div");
    legend.className = "monthly-report-legend";
    data.forEach((item) => {
      const row = document.createElement("span");
      row.dataset.type = item.key;
      row.textContent = `${item.label}: ${formatDuration(item.minutes)}`;
      legend.append(row);
    });
    monthlyReportContent.append(month, chart, legend);
  }

  return { renderWeeklyCapacity, renderMonthlyReport };
}
