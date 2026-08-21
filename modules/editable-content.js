export function activatePlannerEditing({ root = document, allEditables, allChecklistItems, allPriorityItems, allSlotMarks, allDurationFields, savePlanner, feedbackCheck, recordMonthlyActivity, saveSlotMarks, updateLivePlanningStatus, status, saveBlockDurations }) {
  allEditables().forEach((element) => {
    element.addEventListener("input", savePlanner);
    element.addEventListener("paste", (event) => {
      event.preventDefault();
      const text = event.clipboardData.getData("text/plain").replace(/\s*\n\s*/g, " ");
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      selection.deleteFromDocument();
      const range = selection.getRangeAt(0);
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
    element.addEventListener("keydown", (event) => { if (event.key === "Enter") event.preventDefault(); if (event.key === "Escape") element.blur(); });
  });
  allChecklistItems().forEach((item) => item.addEventListener("change", savePlanner));
  allPriorityItems().forEach((item) => item.addEventListener("change", savePlanner));
  allSlotMarks().forEach((item) => item.addEventListener("change", () => {
    item.closest(".schedule-slot")?.classList.toggle("is-marked", item.checked);
    feedbackCheck(); recordMonthlyActivity(item); saveSlotMarks(); updateLivePlanningStatus(); status("Marcação salva neste navegador.");
  }));
  allDurationFields().forEach((field) => {
    field.addEventListener("blur", saveBlockDurations);
    field.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); field.blur(); } });
  });
  root.querySelectorAll("[data-priority-toggle]").forEach((mark) => mark.addEventListener("click", () => {
    const item = root.querySelector(`[data-priority="${mark.dataset.priorityToggle}"]`);
    if (!item) return;
    item.checked = !item.checked;
    savePlanner();
  }));
}
