export function createGoalDateTools({ days, getGoals, saveGoals, alertElement }) {
  const localDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const dateFromKey = (dateKey) => { const [year, month, day] = String(dateKey).split("-").map(Number); return new Date(year, Math.max(0, month - 1), day || 1); };
  const dateWithAddedMonths = (dateValue, offset) => {
    const base = new Date(`${dateValue}T12:00:00`); const targetMonth = base.getMonth() + offset; const targetYear = base.getFullYear() + Math.floor(targetMonth / 12); const month = ((targetMonth % 12) + 12) % 12; const lastDay = new Date(targetYear, month + 1, 0).getDate();
    return localDateKey(new Date(targetYear, month, Math.min(base.getDate(), lastDay)));
  };
  const reminderDaysFor = (goal) => Array.isArray(goal.reminderDays) && goal.reminderDays.length ? goal.reminderDays : days.map((day) => day.key);
  const shouldShowReminderOnDay = (goal, dayKey) => reminderDaysFor(goal).includes(dayKey);
  const formatDate = (dateValue) => dateValue ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(dateFromKey(dateValue)) : "Sem prazo";
  const deadlineInfo = (goal) => {
    if (!goal.deadline) return { state: "open", days: null };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const deadline = dateFromKey(goal.deadline); deadline.setHours(0, 0, 0, 0);
    const daysUntil = Math.round((deadline - today) / 86400000);
    if (daysUntil < 0) return { state: "overdue", days: daysUntil };
    if (daysUntil <= 3) return { state: "soon", days: daysUntil };
    return { state: "scheduled", days: daysUntil };
  };
  const materializeRecurringGoals = () => {
    const goals = getGoals(); const additions = [];
    goals.filter((goal) => goal.recurring && goal.deadline && !goal.isRecurrenceCopy).forEach((goal) => {
      const recurrenceId = goal.recurrenceId || goal.id; const baseDate = new Date(`${goal.deadline}T12:00:00`); const now = new Date(); const monthDistance = (now.getFullYear() - baseDate.getFullYear()) * 12 + now.getMonth() - baseDate.getMonth(); const firstOffset = Math.max(1, monthDistance - 1); const lastOffset = Math.max(3, monthDistance + 3);
      for (let offset = firstOffset; offset <= lastOffset; offset += 1) {
        const deadline = dateWithAddedMonths(goal.deadline, offset); const exists = goals.some((item) => (item.recurrenceId || item.id) === recurrenceId && item.deadline === deadline);
        if (!exists) additions.push({ ...goal, id: `${Date.now()}-${Math.random().toString(16).slice(2)}-${offset}`, recurrenceId, isRecurrenceCopy: true, deadline, done: false, createdAt: new Date().toISOString() });
      }
    });
    if (additions.length) saveGoals([...goals, ...additions]);
    return additions.length ? [...goals, ...additions] : goals;
  };
  const updateGoalAlerts = (goals = getGoals()) => {
    const attention = goals.filter((goal) => !goal.done && ["soon", "overdue"].includes(deadlineInfo(goal).state));
    if (!attention.length) { alertElement.hidden = true; alertElement.textContent = ""; return; }
    const overdue = attention.filter((goal) => deadlineInfo(goal).state === "overdue").length;
    alertElement.hidden = false;
    alertElement.textContent = overdue ? `${overdue} meta(s) mensal(is) vencida(s) requer(em) atenção.` : `${attention.length} meta(s) mensal(is) vence(m) nos próximos 3 dias.`;
  };
  const weekStart = (dateValue) => { const date = new Date(dateValue); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return date; };
  const weekKey = (dateValue = new Date()) => { const monday = weekStart(dateValue); return localDateKey(monday); };
  const calculateStreak = (history) => {
    const completeWeeks = history.filter((entry) => entry.total > 0 && entry.completed >= entry.total).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (!completeWeeks.length) return 0;
    let streak = 1; let previousWeek = weekStart(completeWeeks[0].createdAt);
    for (let index = 1; index < completeWeeks.length; index += 1) { const candidateWeek = weekStart(completeWeeks[index].createdAt); if (Math.round((previousWeek - candidateWeek) / 604800000) !== 1) break; streak += 1; previousWeek = candidateWeek; }
    return streak;
  };
  return { localDateKey, dateFromKey, dateWithAddedMonths, materializeRecurringGoals, reminderDaysFor, shouldShowReminderOnDay, formatDate, deadlineInfo, updateGoalAlerts, weekStart, weekKey, calculateStreak };
}
