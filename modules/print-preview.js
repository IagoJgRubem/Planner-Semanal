export function openPrintPreview({ source, sheet, dialog, closeButton, markMode }) {
  const previewPage = source.cloneNode(true);
  previewPage.classList.add("print-preview-document");
  const previewGrid = previewPage.querySelector(".schedule-grid");
  const dayOrder = [...previewPage.querySelectorAll(".day-heading")].map((heading) => heading.dataset.day);
  previewGrid?.removeAttribute("data-mobile-day");
  previewPage.querySelectorAll(".day-heading").forEach((heading, index) => {
    heading.style.setProperty("display", "flex", "important");
    heading.style.setProperty("grid-column", String(index + 2), "important");
  });
  previewPage.querySelectorAll(".schedule-slot").forEach((slot) => {
    const column = dayOrder.indexOf(slot.dataset.day) + 2;
    if (column > 1) slot.style.setProperty("grid-column", String(column), "important");
    if (slot.classList.contains("is-continuation")) {
      slot.style.setProperty("display", "none", "important");
      return;
    }
    slot.style.setProperty("display", "flex", "important");
  });
  previewPage.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
  previewPage.querySelector(".planner-toolbar")?.remove();
  previewPage.querySelector(".quick-fill-bar")?.remove();
  previewPage.querySelector(".save-status")?.remove();
  previewPage.querySelector(".secondary-tools")?.remove();
  previewPage.querySelectorAll(".slot-check").forEach((mark) => {
    const checked = mark.querySelector("input")?.checked;
    mark.replaceChildren(Object.assign(document.createElement("span"), { className: "print-mark-box", textContent: markMode === "record" && checked ? "✓" : "" }));
  });
  sheet.replaceChildren(previewPage);
  dialog.hidden = false;
  dialog.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-print-preview-open");
  closeButton.focus();
}

export function closePrintPreview({ dialog, returnFocus }) {
  dialog.hidden = true;
  dialog.setAttribute("aria-hidden", "true");
  document.body.classList.remove("is-print-preview-open");
  returnFocus?.focus();
}
