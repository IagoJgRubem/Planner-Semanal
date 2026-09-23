// Snapshots JSON versionados sob a chave consolidada do planner,
// viabilizando exportação, cópia e restauração manual de dados locais.

export const CONSOLIDATED_BACKUP_KEY = "planner.backup-consolidated";

// Schema válido para importação de backup
const VALID_BACKUP_SCHEMA = {
  required: ["app", "version"],
  optionalData: true,
  optionalSnapshot: true,
};

function validateBackupSchema(payload) {
  if (!payload || typeof payload !== "object") {
    return { valid: false, error: "Payload deve ser um objeto" };
  }
  
  // Verificar campos obrigatórios
  if (typeof payload.app !== "string") {
    return { valid: false, error: "Campo 'app' deve ser uma string" };
  }
  
  if (typeof payload.version !== "number") {
    return { valid: false, error: "Campo 'version' deve ser um número" };
  }
  
  // Validar exportedAt se presente
  if (payload.exportedAt && typeof payload.exportedAt !== "string") {
    return { valid: false, error: "Campo 'exportedAt' deve ser uma string ISO" };
  }
  
  // Validar data se presente
  if (payload.data !== undefined) {
    if (typeof payload.data !== "object" || payload.data === null) {
      return { valid: false, error: "Campo 'data' deve ser um objeto ou undefined" };
    }
    // Validar cada entrada em data - pode ser string, null ou objeto
    for (const [key, value] of Object.entries(payload.data)) {
      if (typeof key !== "string") {
        return { valid: false, error: `Chave em 'data' deve ser string: ${key}` };
      }
      // Aceita string, null, ou objeto (para dados estruturados)
      if (value !== null && typeof value !== "string" && typeof value !== "object") {
        return { valid: false, error: `Valor em 'data[${key}]' deve ser string, objeto ou null` };
      }
    }
  }
  
  // Validar snapshot se presente
  if (payload.snapshot !== undefined) {
    if (typeof payload.snapshot !== "object" || payload.snapshot === null) {
      return { valid: false, error: "Campo 'snapshot' deve ser um objeto ou undefined" };
    }
  }
  
  // Garantir que tenha pelo menos data ou snapshot
  if (!payload.data && !payload.snapshot) {
    return { valid: false, error: "Backup deve conter 'data' ou 'snapshot'" };
  }
  
  return { valid: true };
}

export function createBackupController({ storage, app, version, storageKeys, collectSnapshot, restoreSnapshot, field, download, status, consolidatedKey = CONSOLIDATED_BACKUP_KEY }) {
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
    // Validar schema antes de processar
    const validation = validateBackupSchema(payloadValue);
    if (!validation.valid) {
      throw new Error(`Backup inválido: ${validation.error}`);
    }
    
    if (payloadValue.app !== app) throw new Error("Estrutura inválida");
    if (typeof payloadValue.version === "number" && payloadValue.version > version) throw new Error("Backup de versão mais recente");
    
    // Priorizar data se presente e válido
    if (payloadValue.data && typeof payloadValue.data === "object") {
      // Restaurar dados do storage
      Object.entries(payloadValue.data).forEach(([key, value]) => {
        if (typeof value === "string") storage.setItem(key, value);
        else if (value === null) storage.removeItem(key);
        else if (typeof value === "object") {
          // Para objetos, serializar como JSON string
          storage.setItem(key, JSON.stringify(value));
        }
      });
      // Chamar restoreSnapshot se disponível para processamento adicional
      if (typeof restoreSnapshot === "function" && payloadValue.snapshot) {
        restoreSnapshot(payloadValue.snapshot);
      }
    } else if (payloadValue.snapshot && typeof payloadValue.snapshot === "object") {
      // Fallback para snapshot se data não estiver presente
      if (typeof restoreSnapshot === "function") {
        restoreSnapshot(payloadValue.snapshot);
      }
      Object.entries(payloadValue.snapshot).forEach(([key, value]) => {
        if (typeof value === "string") storage.setItem(key, value);
        else if (value === null) storage.removeItem(key);
        else if (typeof value === "object") {
          storage.setItem(key, JSON.stringify(value));
        }
      });
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
      await navigator.clipboard?.writeText(value);
      status("Backup consolidado copiado.");
    } catch (clipboardError) {
      // Fallback defensivo: tentar seleção e cópia manual
      try {
        field.focus();
        field.select();
        const successful = document.execCommand("copy");
        if (successful) {
          status("Backup selecionado para cópia.");
        } else {
          status("Não foi possível copiar. Selecione o texto manualmente.");
        }
      } catch (selectError) {
        console.warn("Clipboard indisponível:", selectError);
        status("Selecione o texto do backup para copiar manualmente.");
      }
    }
  }

  async function importFile(event, consolidatedKey) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await restore(parsed, consolidatedKey);
      window.location.reload();
    } catch (error) {
      console.error("Erro ao importar backup:", error);
      status(`Não foi possível restaurar este backup: ${error.message || "JSON inválido"}`);
    } finally {
      event.target.value = "";
    }
  }

  async function restoreText(consolidatedKey) {
    try {
      const parsed = JSON.parse(field.value);
      await restore(parsed, consolidatedKey);
      window.location.reload();
    } catch (error) {
      console.error("Erro ao restaurar backup do texto:", error);
      status(`Cole um backup JSON válido para restaurar: ${error.message || "JSON inválido"}`);
    }
  }

  return { payload, queueSync, restore, exportFile, copy, importFile, restoreText };
}
