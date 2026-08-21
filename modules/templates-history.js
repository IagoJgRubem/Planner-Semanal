export function createTemplatesHistoryController({ elements, getTemplates, normalizeCategory, categoryLabels, getHistory, calculateStreak, onEditHistory, onDeleteHistory }) {
  const { templateSelect, templateCategoryBadge, categoryFilter, historyList, streakIndicator } = elements;
  const updateTemplateBadge = () => {
    const template = getTemplates().find((item) => item.id === templateSelect.value);
    const category = template ? normalizeCategory(template.category) : "all";
    templateCategoryBadge.dataset.category = category;
    templateCategoryBadge.textContent = category === "all" ? "Todas" : categoryLabels[category];
  };
  const renderTemplateOptions = (selectedId = "") => {
    const filter = categoryFilter.value;
    const templates = getTemplates().filter((template) => filter === "all" || normalizeCategory(template.category) === filter);
    templateSelect.innerHTML = '<option value="">Carregar modelo salvo</option>';
    templates.forEach((template) => {
      const option = document.createElement("option");
      option.value = template.id;
      option.textContent = `${template.name} · ${categoryLabels[normalizeCategory(template.category)]}`;
      option.selected = template.id === selectedId;
      templateSelect.append(option);
    });
    updateTemplateBadge();
  };
  const renderHistory = () => {
    const history = getHistory();
    historyList.replaceChildren();
    const streak = calculateStreak(history);
    streakIndicator.textContent = `Sequência atual: ${streak} ${streak === 1 ? "semana" : "semanas"}`;
    if (!history.length) {
      const empty = document.createElement("p");
      empty.className = "history-empty";
      empty.textContent = "Registre a semana para acompanhar suas prioridades concluídas aqui.";
      historyList.append(empty);
      return;
    }
    history.forEach((entry) => {
      const card = document.createElement("article"); card.className = "history-entry";
      const label = document.createElement("strong"); label.textContent = entry.label;
      const count = document.createElement("span"); count.textContent = `${entry.completed} de ${entry.total} concluídas`;
      const progress = document.createElement("span"); progress.className = "history-progress";
      const fill = document.createElement("i"); fill.style.width = `${entry.total ? (entry.completed / entry.total) * 100 : 0}%`; progress.append(fill);
      const actions = document.createElement("div"); actions.className = "history-actions";
      const edit = document.createElement("button"); edit.type = "button"; edit.textContent = "Editar"; edit.addEventListener("click", () => onEditHistory(entry.id));
      const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Excluir"; remove.addEventListener("click", () => onDeleteHistory(entry.id));
      actions.append(edit, remove); card.append(label, count, progress, actions); historyList.append(card);
    });
  };
  return { updateTemplateBadge, renderTemplateOptions, renderHistory };
}
