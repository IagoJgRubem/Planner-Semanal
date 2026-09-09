
import { createJSONStore, PLANNER_STORAGE_KEYS } from "./storage.js";
import { localDateKey, formatDuration } from "./calendar-utils.js";
const MONTH_NAMES = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

function monthLength(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function dayLabel(date) {
  const day = date.getDate();
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(date);
  return `${weekday}, dia ${day}`;
}
function buildReport(target, agenda, blocks, timeOff, cursor) {
  const daysInMonth = monthLength(cursor.year, cursor.month);
  const days = [];
  let totalFocused = 0;
  let totalBlocked = 0;
  let focusDays = 0;

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(cursor.year, cursor.month, day);
    const dateKey = localDateKey(date);
    const dayAgenda = agenda[dateKey] || [];
    const dayBlocks = blocks[dateKey] || [];
    const focused = dayAgenda.reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
    const blocked = dayBlocks.reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
    const isOff = timeOff.dates.some((item) => item.date === dateKey);
    totalFocused += focused;
    totalBlocked += blocked;
    if (focused > 0) focusDays += 1;
    days.push({ date, dateKey, focused, blocked, isOff });
  }

  days.sort((a, b) => b.focused - a.focused);
  const top3 = days.filter((day) => day.focused > 0).slice(0, 3);
  target.replaceChildren();

  const summary = document.createElement("p");
  summary.className = "monthly-focus-summary";
  summary.textContent = `${MONTH_NAMES.format(new Date(cursor.year, cursor.month, 1))}: ${formatDuration(totalFocused)} de foco em ${focusDays} dia(s) · ${formatDuration(totalBlocked)} bloqueados.`;
  const hint = document.createElement("span");
  hint.className = "monthly-focus-hint";
  hint.textContent = "Foco = compromissos na agenda. Bloqueios não contam como foco.";
  summary.appendChild(document.createElement("br"));
  summary.appendChild(hint);
  target.appendChild(summary);

  const list = document.createElement("ol");
  list.className = "monthly-focus-list";
  if (top3.length === 0) {
    const empty = document.createElement("li");
    empty.className = "monthly-focus-empty";
    empty.textContent = "Nenhum compromisso neste mês ainda.";
    list.appendChild(empty);
  } else {
    top3.forEach((day) => {
      const item = document.createElement("li");
      item.textContent = `${dayLabel(day.date)}: ${formatDuration(day.focused)}${day.isOff ? " · folga" : ""}`;
      list.appendChild(item);
    });
  }
  target.appendChild(list);
}
export function createMonthlyFocusReport({ root, store }) {
  const agenda = store.read(PLANNER_STORAGE_KEYS.dailyAgenda, {});
  const blocks = store.read(PLANNER_STORAGE_KEYS.dailyBlocks, {});
  const timeOff = store.read(PLANNER_STORAGE_KEYS.timeOff, { dates: [], recurringDays: [] });
  let cursor = { year: new Date().getFullYear(), month: new Date().getMonth() };
  let card = null;

  function ensureHost() {
    if (card) return card;
    const panel = document.querySelector("#panel-tracking");
    if (!panel) return null;
    const host = panel.querySelector(".monthly-focus");
    if (host) { card = host; return card; }

    card = document.createElement("section");
    card.className = "panel-card monthly-focus";
    card.setAttribute("aria-label", "Relatório mensal de foco");
    const header = document.createElement("header");
    header.className = "calendar-header monthly-focus-header";
    const prev = document.createElement("button");
    prev.type = "button";
    prev.className = "monthly-focus-prev";
    prev.setAttribute("aria-label", "Mês anterior");
    prev.textContent = "‹";
    prev.addEventListener("click", () => {
      cursor.month -= 1;
      if (cursor.month < 0) { cursor.month = 11; cursor.year -= 1; }
      card.rerender();
    });
    const title = document.createElement("h2");
    title.className = "monthly-focus-title";
    const next = document.createElement("button");
    next.type = "button";
    next.className = "monthly-focus-next";
    next.setAttribute("aria-label", "Próximo mês");
    next.textContent = "›";
    next.addEventListener("click", () => {
      cursor.month += 1;
      if (cursor.month > 11) { cursor.month = 0; cursor.year += 1; }
      card.rerender();
    });
    header.appendChild(prev);
    header.appendChild(title);
    header.appendChild(next);
    const body = document.createElement("div");
    body.className = "monthly-focus-body";
    card.appendChild(header);
    card.appendChild(body);
    card.rerender = () => {
      title.textContent = MONTH_NAMES.format(new Date(cursor.year, cursor.month, 1)).replace(/^\w/, (char) => char.toUpperCase());
      buildReport(body, agenda, blocks, timeOff, cursor);
    };
    card.rerender();
    const column = panel.querySelector(".tracking-column:last-of-type");
    if (column) column.appendChild(card);
    return card;
  }

  function render(newCursor) {
    if (newCursor) cursor = newCursor;
    ensureHost();
    if (card && card.rerender) card.rerender();
  }

  return { render };
}
