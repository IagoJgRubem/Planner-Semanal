export function createBackupController({ storage, app, version, storageKeys, collectSnapshot, restoreSnapshot, field, download, status }) {
  let timerId = null;

  function payload() {
    return {
      app,
      version,
      exportedAt: new Date().toISOString(),
      snapshot: collectSnapshot(),
      data: Object.fromEntries(storageKeys.map((key) => [key, storage.getItem(key)])),
    };
  }

  function serialize() {
    return JSON.stringify(payload(), null, 2);
  }

  function queueSync(consolidatedKey) {
    window.clearTimeout(timerId);
    timerId = window.setTimeout(() => {
      const value = serialize();
      storage.setItem(consolidatedKey, value);
      if (document.activeElement !== field) field.value = value;
    }, 120);
  }

  async function restore(payloadValue, consolidatedKey) {
    if (payloadValue?.app !== app) throw new Error("Estrutura inválida");
    if (payloadValue.data && typeof payloadValue.data === "object") {
      Object.entries(payloadValue.data).forEach(([key, value]) => {
        if (typeof value === "string") storage.setItem(key, value);
        else if (value === null) storage.removeItem(key);
      });
    } else if (payloadValue.snapshot?.planner) {
      Object.entries(restoreSnapshot(payloadValue.snapshot)).forEach(([key, value]) => storage.setItem(key, value));
    } else {
      throw new Error("Estrutura inválida");
    }
    storage.setItem(consolidatedKey, JSON.stringify(payloadValue));
  }

  function exportFile(consolidatedKey) {
    const value = serialize();
    field.value = value;
    storage.setItem(consolidatedKey, value);
    download(value, "backup-planner-semanal.json", "application/json;charset=utf-8");
    status("Backup local exportado em JSON.");
  }

  async function copy() {
    const value = serialize();
    field.value = value;
    try {
      await new Promise((resolve, reject) => {
        const timeoutId = window.setTimeout(() => reject(new Error("Clipboard indisponível")), 900);
        navigator.clipboard?.writeText(value).then(
          () => { window.clearTimeout(timeoutId); resolve(); },
          (error) => { window.clearTimeout(timeoutId); reject(error); },
        );
      });
      status("Backup consolidado copiado.");
    } catch {
      field.focus();
      field.select();
      document.execCommand("copy");
      status("Backup selecionado para cópia.");
    }
  }

  async function importFile(event, consolidatedKey) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await restore(JSON.parse(await file.text()), consolidatedKey);
      window.location.reload();
    } catch {
      status("Não foi possível restaurar este backup.");
    } finally {
      event.target.value = "";
    }
  }

  async function restoreText(consolidatedKey) {
    try {
      await restore(JSON.parse(field.value), consolidatedKey);
      window.location.reload();
    } catch {
      status("Cole um backup JSON válido para restaurar.");
    }
  }

  return { payload, queueSync, restore, exportFile, copy, importFile, restoreText };
}
