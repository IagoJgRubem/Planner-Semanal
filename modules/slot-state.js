export function createSlotStateController({ root = document, durationsStorageKey, slotMarksStorageKey, queueBackup, onDurationsSaved, onSlotMarksSaved }) {
  const allEditables = () => [...root.querySelectorAll("[data-editable]")];
  const allSlotMarks = () => [...root.querySelectorAll("[data-slot-check]")];
  const allDurationFields = () => [...root.querySelectorAll("[data-duration]")];
  const getBlockDurations = () => { try { const saved = JSON.parse(localStorage.getItem(durationsStorageKey) || "{}"); return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {}; } catch { localStorage.removeItem(durationsStorageKey); return {}; } };
  const getBlockDuration = (id) => { const visible = root.querySelector(`[data-duration="${id}"]`)?.innerText; const parsed = Number.parseInt(String(visible || "").replace(/\D/g, ""), 10); if (Number.isFinite(parsed) && parsed > 0) return parsed; const stored = Number(getBlockDurations()[id] || 60); return Number.isFinite(stored) && stored > 0 ? stored : 60; };
  const saveBlockDurations = () => { const durations = {}; allDurationFields().forEach((field) => { const parsed = Number.parseInt(field.innerText.replace(/\D/g, ""), 10); const duration = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 720) : 60; durations[field.dataset.duration] = duration; field.textContent = `${duration}m`; }); localStorage.setItem(durationsStorageKey, JSON.stringify(durations)); queueBackup(); onDurationsSaved(); };
  const getSlotMarkValues = () => Object.fromEntries(allSlotMarks().map((item) => [item.dataset.slotCheck, item.checked]));
  const applySlotMarkValues = (values) => allSlotMarks().forEach((item) => { item.checked = Boolean(values[item.dataset.slotCheck]); item.closest(".schedule-slot")?.classList.toggle("is-marked", item.checked); });
  const saveSlotMarks = () => { localStorage.setItem(slotMarksStorageKey, JSON.stringify(getSlotMarkValues())); queueBackup(); onSlotMarksSaved(); };
  return { allEditables, allSlotMarks, allDurationFields, getBlockDurations, getBlockDuration, saveBlockDurations, getSlotMarkValues, applySlotMarkValues, saveSlotMarks };
}
