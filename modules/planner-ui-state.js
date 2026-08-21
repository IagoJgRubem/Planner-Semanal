export function createPlannerUiState({ root = document, prioritySummary, saveStatus, allEditables, allChecklistItems }) {
  const allPriorityItems = () => [...root.querySelectorAll("[data-priority]")];
  const getFieldValues = () => Object.fromEntries(allEditables().map((element) => [element.dataset.editable, element.innerText.replace(/\n/g, " ").trim()]));
  const getChecklistValues = () => Object.fromEntries(allChecklistItems().map((item) => [item.dataset.checklist, item.checked]));
  const getPriorityValues = () => Object.fromEntries(allPriorityItems().map((item) => [item.dataset.priority, item.checked]));
  const applyFieldValues = (values) => allEditables().forEach((element) => { if (Object.prototype.hasOwnProperty.call(values, element.dataset.editable)) element.textContent = values[element.dataset.editable]; });
  const applyChecklistValues = (values) => allChecklistItems().forEach((item) => { item.checked = Boolean(values[item.dataset.checklist]); });
  const updatePrioritySummary = () => {
    const priorities = allPriorityItems();
    const completed = priorities.filter((item) => item.checked).length;
    priorities.forEach((item) => {
      root.querySelector(`[data-priority-toggle="${item.dataset.priority}"]`)?.setAttribute("aria-pressed", String(item.checked));
      item.closest(".priority-item")?.classList.toggle("is-complete", item.checked);
    });
    prioritySummary.textContent = `${completed} de ${priorities.length} prioridades concluídas`;
  };
  const applyPriorityValues = (values) => { allPriorityItems().forEach((item) => { item.checked = Boolean(values[item.dataset.priority]); }); updatePrioritySummary(); };
  const showStatus = (message) => { saveStatus.textContent = message; window.clearTimeout(saveStatus.timeoutId); saveStatus.timeoutId = window.setTimeout(() => { saveStatus.textContent = ""; }, 2200); };
  return { allPriorityItems, getFieldValues, getChecklistValues, getPriorityValues, applyFieldValues, applyChecklistValues, applyPriorityValues, updatePrioritySummary, showStatus };
}
