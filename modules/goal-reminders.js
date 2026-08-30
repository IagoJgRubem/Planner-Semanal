export function createGoalRemindersController({ root = document, categoryChart, days, categoryLabels, getGoals, shouldShowReminderOnDay, slotContentForTime, normalizeCategory, deadlineInfo, formatDate }) {
  const updateGoalReminders = (goals = getGoals()) => {
    const activeGoals = goals.filter((goal) => !goal.done && goal.text?.trim()).sort((first, second) => (first.deadline || "9999-12-31").localeCompare(second.deadline || "9999-12-31"));
      root.querySelectorAll(".schedule-slot").forEach((slot) => { slot.classList.remove("has-goal-reminder", "reminder-trabalho", "reminder-pessoal", "reminder-saude", "goal-open", "goal-soon", "goal-overdue", "goal-scheduled"); slot.removeAttribute("data-reminder"); });
    days.forEach((day) => {
      const goal = activeGoals.find((item) => shouldShowReminderOnDay(item, day.key));
      if (!goal) return;
      const slot = slotContentForTime(day.key, `${(goal.reminderTime || "08:00").slice(0, 2)}:00`)?.closest(".schedule-slot");
      if (!slot) return;
      const category = normalizeCategory(goal.category); const deadline = deadlineInfo(goal); const reminderPrefix = goal.reminderTime ? `${goal.reminderTime} · ` : "";
      slot.classList.add("has-goal-reminder", `reminder-${category}`, `goal-${deadline.state}`);
      slot.dataset.reminder = goal.deadline ? `${reminderPrefix}${goal.text} · ${formatDate(goal.deadline)}` : `${reminderPrefix}${goal.text}`;
    });
  };
  const renderCategoryChart = (goals = getGoals()) => {
    categoryChart.replaceChildren();
    if (!goals.length) { const empty = document.createElement("p"); empty.className = "chart-empty"; empty.textContent = "As metas mensais aparecerão aqui por categoria."; categoryChart.append(empty); return; }
    Object.entries(categoryLabels).forEach(([category, label]) => {
      const items = goals.filter((goal) => normalizeCategory(goal.category) === category); const completed = items.filter((goal) => goal.done).length; const total = items.length;
      const item = document.createElement("div"); item.className = "chart-item"; item.dataset.category = category;
      const head = document.createElement("div"); head.className = "chart-item-head"; const name = document.createElement("span"); name.textContent = label; const count = document.createElement("strong"); count.textContent = `${completed}/${total}`; head.append(name, count);
      const track = document.createElement("div"); track.className = "chart-track"; const fill = document.createElement("i"); fill.style.width = `${total ? (completed / total) * 100 : 0}%`; track.append(fill); item.append(head, track); categoryChart.append(item);
    });
  };
  return { updateGoalReminders, renderCategoryChart };
}
