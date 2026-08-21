export function createGoalsCalendarController({ elements, modal, days, categoryLabels, getGoals, saveGoals, materializeGoals, updateGoalReminders, renderCategoryChart, updateGoalAlerts, getCalendarCursor, getAnnualCursor, getSelectedDate, setSelectedDate, selectCalendarDate, getTimeOff, getHalfDays, timeOffForDate, halfDayForDate, dailyCapacity, getWorkHours, workDuration, dayKeyFromDate, localDateKey, normalizeCategory, reminderDaysFor, deadlineInfo, status, formatDate, formatDuration }) {
  const { monthlyGoalsList, calendarLabel, monthlyCalendar, annualLabel, annualMonths, annualSummary } = elements;

  function renderCalendar(goals = getGoals()) {
    const cursor = getCalendarCursor();
    calendarLabel.textContent = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(cursor);
    monthlyCalendar.replaceChildren();
    const timeOff = getTimeOff();
    const halfDays = getHalfDays();
    const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const firstWeekday = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const todayKey = localDateKey(new Date());
    const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    for (let index = 0; index < totalCells; index += 1) {
      const cell = document.createElement("div");
      cell.className = "calendar-day";
      const dayNumber = index - firstWeekday + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) { cell.classList.add("is-empty"); monthlyCalendar.append(cell); continue; }
      const date = new Date(cursor.getFullYear(), cursor.getMonth(), dayNumber);
      const dateKey = localDateKey(date);
      if (dateKey === todayKey) cell.classList.add("is-today");
      if (dateKey === getSelectedDate()) cell.classList.add("is-selected");
      if (timeOffForDate(dateKey, timeOff)) cell.classList.add("is-time-off");
      else if (halfDayForDate(dateKey, halfDays)) cell.classList.add("is-half-day");
      cell.addEventListener("click", () => selectCalendarDate(dateKey));
      const number = document.createElement("span");
      number.className = "calendar-date";
      number.textContent = dayNumber;
      cell.append(number);
      goals.filter((goal) => goal.deadline === dateKey).forEach((goal) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `calendar-goal ${normalizeCategory(goal.category)} ${goal.done ? "is-done" : ""}`;
        chip.textContent = goal.text;
        chip.title = goal.done ? "Reabrir meta" : "Concluir meta";
        chip.addEventListener("click", (event) => {
          event.stopPropagation();
          saveGoals(getGoals().map((item) => item.id === goal.id ? { ...item, done: !item.done } : item));
          setSelectedDate(dateKey);
          renderMonthlyGoals();
          status(goal.done ? "Meta reaberta no calendário." : "Meta concluída no calendário.");
        });
        cell.append(chip);
      });
      monthlyCalendar.append(cell);
    }
  }

  function renderMonthlyGoals() {
    const goals = materializeGoals();
    updateGoalReminders(goals);
    renderCategoryChart(goals);
    updateGoalAlerts(goals);
    renderCalendar(goals);
    monthlyGoalsList.replaceChildren();
    if (!goals.length) {
      const empty = document.createElement("p");
      empty.className = "goals-empty";
      empty.textContent = "Adicione uma meta mensal e escolha a categoria que melhor orienta sua execução.";
      monthlyGoalsList.append(empty);
      return;
    }
    goals.forEach((goal) => {
      const item = document.createElement("article");
      item.className = "monthly-goal";
      const category = normalizeCategory(goal.category);
      const badge = document.createElement("span");
      badge.className = "category-badge";
      badge.dataset.category = category;
      badge.textContent = categoryLabels[category];
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = Boolean(goal.done);
      check.setAttribute("aria-label", `Concluir meta ${goal.text}`);
      const text = document.createElement("span");
      text.className = "monthly-goal-text";
      text.contentEditable = "true";
      text.textContent = goal.text;
      const deadline = document.createElement("input");
      deadline.type = "date";
      deadline.className = `goal-deadline ${deadlineInfo(goal).state}`;
      deadline.value = goal.deadline || "";
      deadline.setAttribute("aria-label", `Prazo da meta ${goal.text}`);
      const reminderTime = document.createElement("input");
      reminderTime.type = "time";
      reminderTime.className = "goal-reminder-time";
      reminderTime.value = goal.reminderTime || "08:00";
      reminderTime.setAttribute("aria-label", `Horário do lembrete da meta ${goal.text}`);
      const recurring = document.createElement("label");
      recurring.className = "goal-recurrence";
      const recurringCheck = document.createElement("input");
      recurringCheck.type = "checkbox";
      recurringCheck.checked = Boolean(goal.recurring);
      recurring.append(recurringCheck, document.createTextNode(" Recorrente"));
      const reminderDays = document.createElement("div");
      reminderDays.className = "goal-reminder-days";
      days.forEach((day) => {
        const dayLabel = document.createElement("label");
        const dayCheck = document.createElement("input");
        dayCheck.type = "checkbox";
        dayCheck.checked = reminderDaysFor(goal).includes(day.key);
        dayCheck.dataset.day = day.key;
        dayCheck.setAttribute("aria-label", `Exibir lembrete de ${goal.text} na ${day.label}`);
        dayLabel.append(dayCheck, document.createTextNode(day.label.slice(0, 3)));
        dayCheck.addEventListener("change", () => {
          const current = [...reminderDays.querySelectorAll("input:checked")].map((input) => input.dataset.day);
          saveGoals(getGoals().map((item) => item.id === goal.id ? { ...item, reminderDays: current } : item));
          renderMonthlyGoals();
        });
        reminderDays.append(dayLabel);
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Excluir";
      check.addEventListener("change", () => { saveGoals(getGoals().map((item) => item.id === goal.id ? { ...item, done: check.checked } : item)); renderMonthlyGoals(); });
      text.addEventListener("input", () => saveGoals(getGoals().map((item) => item.id === goal.id ? { ...item, text: text.innerText.replace(/\n/g, " ").trim() } : item)));
      text.addEventListener("keydown", (event) => { if (event.key === "Enter") event.preventDefault(); });
      deadline.addEventListener("change", () => { saveGoals(getGoals().map((item) => item.id === goal.id ? { ...item, deadline: deadline.value } : item)); renderMonthlyGoals(); });
      reminderTime.addEventListener("change", () => { saveGoals(getGoals().map((item) => item.id === goal.id ? { ...item, reminderTime: reminderTime.value } : item)); renderMonthlyGoals(); });
      recurringCheck.addEventListener("change", () => {
        if (recurringCheck.checked && !deadline.value) { recurringCheck.checked = false; status("Defina um prazo para ativar a recorrência mensal."); return; }
        saveGoals(getGoals().map((item) => item.id === goal.id ? { ...item, recurring: recurringCheck.checked, recurrenceId: item.recurrenceId || item.id } : item));
        renderMonthlyGoals();
      });
      remove.addEventListener("click", async () => {
        if (await modal.confirm({ heading: "Excluir meta", detail: `Excluir “${goal.text}”?`, confirmLabel: "Excluir" })) {
          saveGoals(getGoals().filter((item) => item.id !== goal.id));
          renderMonthlyGoals();
        }
      });
      item.append(badge, check, text, deadline, reminderTime, recurring, remove, reminderDays);
      monthlyGoalsList.append(item);
    });
  }

  function renderAnnualAvailability() {
    const annualCursor = getAnnualCursor();
    const hours = getWorkHours();
    const timeOff = getTimeOff();
    const halfDays = getHalfDays();
    const todayKey = localDateKey(new Date());
    let availableMinutes = 0;
    let timeOffCount = 0;
    let halfDayCount = 0;
    let noWorkCount = 0;
    annualLabel.textContent = annualCursor;
    annualMonths.replaceChildren();
    for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
      const monthDate = new Date(annualCursor, monthIndex, 1);
      const month = document.createElement("section");
      month.className = "annual-month";
      const heading = document.createElement("h3");
      heading.textContent = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(monthDate);
      const weekdays = document.createElement("div");
      weekdays.className = "annual-weekdays";
      ["S", "T", "Q", "Q", "S", "S", "D"].forEach((label) => { const weekday = document.createElement("span"); weekday.textContent = label; weekdays.append(weekday); });
      const grid = document.createElement("div");
      grid.className = "annual-calendar";
      const firstWeekday = (monthDate.getDay() + 6) % 7;
      const daysInMonth = new Date(annualCursor, monthIndex + 1, 0).getDate();
      for (let blank = 0; blank < firstWeekday; blank += 1) { const empty = document.createElement("span"); empty.className = "annual-day is-empty"; grid.append(empty); }
      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(annualCursor, monthIndex, day);
        const dateKey = localDateKey(date);
        const baseCapacity = workDuration(dayKeyFromDate(dateKey), hours);
        const unavailable = timeOffForDate(dateKey, timeOff);
        const halfDay = !unavailable && halfDayForDate(dateKey, halfDays);
        const capacity = dailyCapacity(dateKey, hours, timeOff, halfDays);
        const state = unavailable ? "time-off" : halfDay ? "half-day" : capacity ? "available" : "no-work";
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = `annual-day is-${state}`;
        if (dateKey === todayKey) cell.classList.add("is-today");
        if (dateKey === getSelectedDate()) cell.classList.add("is-selected");
        const number = document.createElement("span");
        number.className = "annual-date";
        number.textContent = day;
        const capacityText = document.createElement("span");
        capacityText.className = "annual-capacity";
        capacityText.textContent = capacity ? formatDuration(capacity) : "";
        cell.title = unavailable ? `${formatDate(dateKey)} · ${unavailable.label || "Folga recorrente"}` : halfDay ? `${formatDate(dateKey)} · ${halfDay.label || "Meia jornada"} · ${formatDuration(capacity)} disponíveis` : capacity ? `${formatDate(dateKey)} · ${formatDuration(capacity)} disponíveis` : `${formatDate(dateKey)} · Sem jornada padrão`;
        cell.setAttribute("aria-label", cell.title);
        cell.addEventListener("click", () => selectCalendarDate(dateKey));
        cell.append(number, capacityText);
        grid.append(cell);
        availableMinutes += capacity;
        if (unavailable) timeOffCount += 1;
        else if (halfDay) halfDayCount += 1;
        else if (!baseCapacity) noWorkCount += 1;
      }
      month.append(heading, weekdays, grid);
      annualMonths.append(month);
    }
    annualSummary.textContent = `${formatDuration(availableMinutes)} disponíveis · ${timeOffCount} feriado(s) ou folga(s) · ${halfDayCount} meia(s) jornada(s) · ${noWorkCount} dia(s) sem jornada padrão.`;
  }

  return { renderMonthlyGoals, renderCalendar, renderAnnualAvailability };
}
