export function applyQuickFillPreset({ selectedSlot, preset, times, getSlot, getDurations, persistDurations, ensureMark, syncStatus }) {
  const dayKey = selectedSlot.dataset.day;
  const startIndex = times.indexOf(selectedSlot.dataset.time);
  const appliedSpan = Math.min(preset.span, times.length - startIndex);
  const durations = getDurations();
  for (let offset = 0; offset < appliedSpan; offset += 1) {
    const time = times[startIndex + offset];
    const slot = getSlot(dayKey, time);
    if (!slot) continue;
    const content = slot.querySelector(".slot-content");
    const id = `${dayKey}-${time}`;
    slot.dataset.baseClass = `schedule-slot slot--${preset.type}`;
    slot.className = slot.dataset.baseClass;
    slot.dataset.span = "1";
    slot.style.gridRow = String(times.indexOf(time) + 2);
    content.textContent = preset.label;
    durations[id] = offset === 0 ? (preset.type === "work" ? appliedSpan * 60 : preset.duration) : 60;
    const durationField = slot.querySelector("[data-duration]");
    if (durationField) durationField.textContent = `${durations[id]}m`;
    ensureMark(slot, preset.label, preset.type);
    syncStatus(slot, preset.label, preset.type);
  }
  persistDurations(durations);
  return { dayKey, startIndex, appliedSpan };
}
