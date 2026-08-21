import { timeToMinutes } from "./calendar-utils.js";

export function createDailyAgendaController({ elements, modal, getSelectedDate, dayKeyFromDate, getScheduleEntries, getMonthlyGoals, getAgenda, getBlocks, saveAgenda, saveBlocks, dailyCapacity, timeOffForDate, formatDuration, renderWeeklyCapacity, isTimeBlocked, status }) {
  const { list, dateLabel, summary, blockButton, addButton } = elements;
  const validTime = (value) => /^\d{1,2}:\d{2}$/.test(value || "");
  const validDuration = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
  const entryId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function analyzeEntries(entries) {
    const timed = entries.filter((entry) => entry.type !== "blocked" && validTime(entry.time) && Number(entry.duration || 0) > 0)
      .map((entry) => ({ ...entry, start: timeToMinutes(entry.time), end: timeToMinutes(entry.time) + Number(entry.duration || 0) }));
    const conflicts = new Set();
    timed.forEach((entry, index) => timed.slice(index + 1).forEach((other) => {
      if (entry.start < other.end && other.start < entry.end) { if (entry.id) conflicts.add(entry.id); if (other.id) conflicts.add(other.id); }
    }));
    const consecutive = timed.slice().sort((first, second) => first.start - second.start)
      .filter((entry, index, items) => index < items.length - 1 && entry.end === items[index + 1].start).length;
    return { total: timed.reduce((sum, entry) => sum + Number(entry.duration || 0), 0), conflicts, consecutive };
  }

  function move(id, targetTime) {
    const date = getSelectedDate(); const agenda = getAgenda(); const entry = (agenda[date] || []).find((item) => item.id === id);
    if (!entry || entry.time === targetTime) return;
    if (isTimeBlocked(date, targetTime, entry.duration || 60)) return status("Esse período está bloqueado e não aceita o compromisso.");
    agenda[date] = (agenda[date] || []).map((item) => item.id === id ? { ...item, time: targetTime } : item);
    saveAgenda(agenda); render(); status(`Compromisso movido para ${targetTime}.`);
  }

  function agendaEntry(time, text, type = "schedule", actions = null, duration = 0, conflicted = false) {
    const entry = document.createElement("div"); entry.className = `daily-agenda-entry ${type}${conflicted ? " is-conflict" : ""}`; entry.dataset.time = time;
    const entryTime = document.createElement("strong"); entryTime.textContent = duration ? `${time} · ${duration}m` : time;
    const entryText = document.createElement("span"); entryText.textContent = text; entry.append(entryTime, entryText);
    if (actions) {
      if (actions.draggable !== false) { entry.draggable = true; entry.dataset.entryId = actions.id; entry.addEventListener("dragstart", (event) => { event.dataTransfer.setData("text/plain", actions.id); entry.classList.add("is-dragging"); }); entry.addEventListener("dragend", () => entry.classList.remove("is-dragging")); }
      const actionsElement = document.createElement("div"); actionsElement.className = "daily-agenda-actions";
      const edit = document.createElement("button"); edit.type = "button"; edit.textContent = "Editar"; edit.addEventListener("click", actions.edit);
      const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Excluir"; remove.addEventListener("click", actions.remove);
      actionsElement.append(edit, remove); entry.append(actionsElement);
    }
    entry.addEventListener("dragover", (event) => { event.preventDefault(); entry.classList.add("is-drop-target"); });
    entry.addEventListener("dragleave", () => entry.classList.remove("is-drop-target"));
    entry.addEventListener("drop", (event) => { event.preventDefault(); entry.classList.remove("is-drop-target"); const id = event.dataTransfer.getData("text/plain"); if (id && validTime(time)) move(id, time); });
    return entry;
  }

  function render() {
    const date = getSelectedDate(); list.replaceChildren();
    if (!date) { dateLabel.textContent = "Selecione uma data no calendário."; summary.textContent = ""; summary.className = "daily-agenda-summary"; blockButton.disabled = true; addButton.disabled = true; renderWeeklyCapacity(); return; }
    const selectedDate = new Date(`${date}T12:00:00`); dateLabel.textContent = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(selectedDate); blockButton.disabled = false; addButton.disabled = false;
    const scheduleEntries = getScheduleEntries(dayKeyFromDate(date)); const dueGoals = getMonthlyGoals().filter((goal) => goal.deadline === date && !goal.done);
    const entries = [...scheduleEntries.map((entry) => ({ ...entry, type: "schedule" })), ...dueGoals.map((goal) => ({ time: "Meta", text: goal.text, type: "goal", duration: 0 })), ...(getAgenda()[date] || []).map((entry) => ({ ...entry, duration: entry.duration || 60, type: "custom" })), ...(getBlocks()[date] || []).map((block) => ({ ...block, text: "Horário indisponível", type: "blocked" }))].sort((first, second) => first.time.localeCompare(second.time));
    const analysis = analyzeEntries(entries); const hours = Math.floor(analysis.total / 60); const minutes = analysis.total % 60; const capacity = dailyCapacity(date); const unavailable = timeOffForDate(date); const overloaded = capacity ? analysis.total > capacity : analysis.total > 0;
    summary.className = `daily-agenda-summary${analysis.conflicts.size ? " has-conflict" : overloaded ? " is-overloaded" : ""}`;
    summary.textContent = unavailable ? `${unavailable.label || "Folga"}: capacidade diária indisponível.` : analysis.conflicts.size ? `${analysis.conflicts.size} compromisso(s) em conflito · carga prevista ${hours}h${String(minutes).padStart(2, "0")}.` : overloaded ? `Carga prevista ${hours}h${String(minutes).padStart(2, "0")}: acima da capacidade diária de ${formatDuration(capacity)}.` : analysis.consecutive ? `Carga prevista ${hours}h${String(minutes).padStart(2, "0")} de ${formatDuration(capacity)}. Sugestão: inclua 10 min de pausa entre ${analysis.consecutive} sequência(s) de tarefas.` : `Carga prevista ${hours}h${String(minutes).padStart(2, "0")} de ${formatDuration(capacity)}. Arraste compromissos para outro horário.`;
    entries.forEach((entry) => { const actions = entry.type === "custom" ? { id: entry.id, edit: () => edit(entry.id), remove: () => remove(entry.id) } : entry.type === "blocked" ? { id: entry.id, draggable: false, edit: () => editBlock(entry.id), remove: () => removeBlock(entry.id) } : null; list.append(agendaEntry(entry.time, entry.text, entry.type, actions, entry.duration || 0, analysis.conflicts.has(entry.id))); });
    if (!list.children.length) { const empty = document.createElement("p"); empty.className = "daily-agenda-empty"; empty.textContent = "Não há compromissos ou metas para esta data."; list.append(empty); } renderWeeklyCapacity();
  }

  async function agendaForm({ heading, submitLabel, entry = {} }) {
    return modal.open({ heading, submitLabel, fields: [{ name: "time", label: "Horário", type: "time", value: entry.time || "09:00", required: true }, { name: "text", label: "Compromisso", type: "text", value: entry.text || "", placeholder: "Descreva a atividade", required: true }, { name: "duration", label: "Duração estimada (minutos)", type: "number", value: entry.duration || 60, min: 5, step: 5, required: true }] });
  }

  async function add() {
    const date = getSelectedDate(); if (!date) return; const values = await agendaForm({ heading: "Adicionar compromisso", submitLabel: "Adicionar" }); if (!values) return;
    if (!validTime(values.time) || !values.text?.trim() || !validDuration(values.duration)) return status("Informe horário, compromisso e duração válidos.");
    const duration = Number(values.duration); if (isTimeBlocked(date, values.time, duration)) return status("Esse período está bloqueado e não aceita novos compromissos.");
    const agenda = getAgenda(); agenda[date] = [...(agenda[date] || []), { id: entryId(), time: values.time, text: values.text.trim(), duration }]; saveAgenda(agenda); render(); status("Compromisso adicionado à agenda diária.");
  }

  async function blockForm({ heading, submitLabel, entry = {} }) {
    return modal.open({ heading, submitLabel, fields: [{ name: "time", label: "Início do bloqueio", type: "time", value: entry.time || "12:00", required: true }, { name: "duration", label: "Duração do bloqueio (minutos)", type: "number", value: entry.duration || 60, min: 5, step: 5, required: true }] });
  }

  async function block() {
    const date = getSelectedDate(); if (!date) return; const values = await blockForm({ heading: "Bloquear horário", submitLabel: "Bloquear" }); if (!values) return;
    if (!validTime(values.time) || !validDuration(values.duration)) return status("Informe horário e duração válidos.");
    const duration = Number(values.duration); const blocks = getBlocks(); if (isTimeBlocked(date, values.time, duration)) return status("Já existe um bloqueio que ocupa esse período.");
    blocks[date] = [...(blocks[date] || []), { id: entryId(), time: values.time, duration }]; saveBlocks(blocks); render(); status("Horário bloqueado na agenda diária.");
  }

  async function edit(id) {
    const date = getSelectedDate(); const agenda = getAgenda(); const entry = (agenda[date] || []).find((item) => item.id === id); if (!entry) return;
    const values = await agendaForm({ heading: "Editar compromisso", submitLabel: "Salvar", entry }); if (!values) return;
    if (!validTime(values.time) || !values.text?.trim() || !validDuration(values.duration)) return status("Informe horário, compromisso e duração válidos.");
    agenda[date] = agenda[date].map((item) => item.id === id ? { ...item, time: values.time, text: values.text.trim(), duration: Number(values.duration) } : item); saveAgenda(agenda); render(); status("Compromisso atualizado.");
  }

  async function remove(id) {
    const date = getSelectedDate(); const agenda = getAgenda(); const entry = (agenda[date] || []).find((item) => item.id === id); if (!entry) return;
    if (!await modal.confirm({ heading: "Excluir compromisso", detail: `Excluir “${entry.text}”?`, confirmLabel: "Excluir" })) return;
    agenda[date] = (agenda[date] || []).filter((item) => item.id !== id); if (!agenda[date].length) delete agenda[date]; saveAgenda(agenda); render(); status("Compromisso excluído.");
  }

  async function editBlock(id) {
    const date = getSelectedDate(); const blocks = getBlocks(); const entry = (blocks[date] || []).find((item) => item.id === id); if (!entry) return;
    const values = await blockForm({ heading: "Editar bloqueio", submitLabel: "Salvar", entry }); if (!values) return;
    if (!validTime(values.time) || !validDuration(values.duration)) return status("Informe horário e duração válidos.");
    blocks[date] = blocks[date].map((item) => item.id === id ? { ...item, time: values.time, duration: Number(values.duration) } : item); saveBlocks(blocks); render(); status("Bloqueio de horário atualizado.");
  }

  async function removeBlock(id) {
    const date = getSelectedDate(); const blocks = getBlocks(); const entry = (blocks[date] || []).find((item) => item.id === id); if (!entry) return;
    if (!await modal.confirm({ heading: "Remover bloqueio", detail: `Remover o bloqueio iniciado às ${entry.time}?`, confirmLabel: "Remover" })) return;
    blocks[date] = (blocks[date] || []).filter((item) => item.id !== id); if (!blocks[date].length) delete blocks[date]; saveBlocks(blocks); render(); status("Bloqueio de horário removido.");
  }

  return { render, add, block, edit, remove, editBlock, removeBlock, move };
}
