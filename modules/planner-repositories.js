export function createPlannerRepositories({ storage, keys, queueBackup, categoryLabels, dayKeyFromDate }) {
  const save = (key, value) => { storage.write(key, value); queueBackup(); };
  const normalizeCategory = (category) => Object.prototype.hasOwnProperty.call(categoryLabels, category) ? category : "pessoal";
  const getTimeOff = () => {
    const saved = storage.read(keys.timeOff, {});
    return { dates: Array.isArray(saved.dates) ? saved.dates : [], recurringDays: Array.isArray(saved.recurringDays) ? saved.recurringDays : [] };
  };
  const timeOffForDate = (dateKey, timeOff = getTimeOff()) => {
    const dated = timeOff.dates.find((item) => item.date === dateKey);
    if (dated) return dated;
    const dayKey = dayKeyFromDate(dateKey);
    return timeOff.recurringDays.includes(dayKey) ? { recurring: true, dayKey, label: "Folga recorrente" } : null;
  };
  return {
    normalizeCategory,
    getTemplates: () => storage.read(keys.templates, []), saveTemplates: (templates) => save(keys.templates, templates),
    getHistory: () => storage.read(keys.history, []), saveHistory: (history) => save(keys.history, history.slice(0, 12)),
    getMonthlyGoals: () => storage.read(keys.monthlyGoals, []), saveMonthlyGoals: (goals) => save(keys.monthlyGoals, goals),
    getDailyAgenda: () => storage.read(keys.dailyAgenda, {}), saveDailyAgenda: (agenda) => save(keys.dailyAgenda, agenda),
    getDailyBlocks: () => storage.read(keys.dailyBlocks, {}), saveDailyBlocks: (blocks) => save(keys.dailyBlocks, blocks),
    getTimeOff, saveTimeOff: (timeOff) => save(keys.timeOff, timeOff), timeOffForDate,
  };
}
