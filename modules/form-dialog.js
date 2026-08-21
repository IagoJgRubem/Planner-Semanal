export function createFormDialog({ element, title, description, form, fields, submitButton, cancelButton }) {
  let resolvePending = null;

  function close(value = null) {
    if (element.open) element.close();
    const resolve = resolvePending;
    resolvePending = null;
    resolve?.(value);
  }

  function buildField(definition) {
    const wrapper = document.createElement("label");
    wrapper.className = `planner-dialog-field${definition.type === "checkbox" ? " is-checkbox" : ""}`;
    const input = document.createElement("input");
    input.name = definition.name;
    input.type = definition.type || "text";
    input.value = definition.value ?? "";
    input.required = Boolean(definition.required);
    if (definition.min) input.min = definition.min;
    if (definition.max) input.max = definition.max;
    if (definition.step) input.step = definition.step;
    if (definition.placeholder) input.placeholder = definition.placeholder;
    if (definition.type === "checkbox") {
      input.checked = Boolean(definition.checked);
      wrapper.append(input, document.createTextNode(` ${definition.label}`));
      return wrapper;
    }
    const caption = document.createElement("span");
    caption.textContent = definition.label;
    wrapper.append(caption, input);
    return wrapper;
  }

  function open({ heading, detail = "", submitLabel = "Salvar", fields: definitions = [] }) {
    if (resolvePending) close();
    title.textContent = heading;
    description.textContent = detail;
    fields.replaceChildren(...definitions.map(buildField));
    submitButton.textContent = submitLabel;
    cancelButton.textContent = "Cancelar";
    element.showModal();
    window.setTimeout(() => fields.querySelector("input:not([type=checkbox])")?.focus(), 0);
    return new Promise((resolve) => { resolvePending = resolve; });
  }

  function confirm({ heading, detail, confirmLabel = "Excluir" }) {
    return open({ heading, detail, submitLabel: confirmLabel, fields: [] }).then(Boolean);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    fields.querySelectorAll('input[type="checkbox"]').forEach((input) => { values[input.name] = input.checked; });
    close(values);
  });
  cancelButton.addEventListener("click", () => close());
  element.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  element.addEventListener("click", (event) => { if (event.target === element) close(); });

  return { open, confirm, close };
}
