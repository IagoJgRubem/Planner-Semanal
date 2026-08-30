// Chaves principais persistidas pelo gerenciador de estado local do PWA.
export const PLANNER_STORAGE_KEYS = {
  planner: "planner",
  dailyAgenda: "planner.daily-agenda",
  dailyBlocks: "planner.daily-blocks",
  monthlyGoals: "planner.monthly-goals",
  templates: "planner.templates",
  history: "planner.history",
  durations: "planner.durations",
  timeOff: "planner.time-off",
  profile: "planner.profile",
  prefs: "planner.prefs",
  rollover: "planner.rollover",
};

// Indicadores de estouro de cota comuns entre engines (Blink/WebKit/Gecko).
const QUOTA_ERROR_CODES = new Set([
  "QuotaExceededError",
  "NS_ERROR_DOM_QUOTA_REACHED",
  "QuotaExceededError: DOM Quota Exceeded Error",
  "NS_ERROR_FILE_NO_DEVICE_SPACE",
]);

export function isQuotaExceededError(error) {
  return Boolean(
    error &&
    (QUOTA_ERROR_CODES.has(error?.name) ||
     QUOTA_ERROR_CODES.has(error?.code) ||
     /quota/i.test(String(error?.name) || "") ||
     /quota exceeded/i.test(String(error?.message) || "")),
  );
}

// Camada leve de fallback para IndexedDB: usada apenas quando o
// localStorage estoura a cota. O localStorage continua sendo a fonte
// síncrona principal; chaves volumosas são redirecionadas e um
// apontador de referência é mantido no lugar. Com isso as chamadas
// feitas por app.js e pelos testes permanecem intactas.

export function createIDBFallback(databaseName = "planner-db", storeName = "overflow") {
  let databasePromise;

  function openDatabase() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(storeName)) {
          request.result.createObjectStore(storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return databasePromise;
  }

  async function getStore(mode) {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  async function save(key, value) {
    try {
      const store = await getStore("readwrite");
      store.put(value, key);
    } catch {
      // Fallback silencioso: se o IndexedDB também falhar, mantém o apontador。
    }
  }

  async function load(key) {
    try {
      const store = await getStore("readonly");
      return await new Promise((resolve) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(undefined);
      });
    } catch {
      return undefined;
    }
  }

  async function remove(key) {
    try {
      const store = await getStore("readwrite");
      store.delete(key);
    } catch {
      // silencioso
    }
  }

  return { save, load, remove };
}

const IDB_REF_PREFIX = "idb:";

function readThrough(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    if (raw?.startsWith(IDB_REF_PREFIX)) return undefined; // apontador: valores residem no IndexedDB
    return raw ? JSON.parse(raw) : fallback;

  } catch {
    storage.removeItem(key);
    return fallback;

  }
}

function writeThrough(storage, idb, key, value, quotaKeys) {
  const serialized = JSON.stringify(value);
  try {
    storage.setItem(key, serialized);
    return value;
  } catch (error) {
    if (idb && isQuotaExceededError(error) && quotaKeys.has(key)) {
      storage.setItem(key, `${IDB_REF_PREFIX}${key}`);
      idb.save(key, serialized);
      return value;
    }
    throw error;
  }
}

function readTextThrough(storage, key, fallback) {
  const raw = storage.getItem(key);
  if (raw?.startsWith(IDB_REF_PREFIX)) {
    return fallback; // leitura síncrona não aguarda IndexedDB; fallback seguro
  }
  return raw ?? fallback;

}

export function createJSONStore(storage = window.localStorage, { idb = null, quotaKeys = new Set() } = {}) {
  const fallbackIdb = idb || createIDBFallback();
  return {
    read(key, fallback) {
      const raw = storage.getItem(key);
      if (raw?.startsWith(IDB_REF_PREFIX)) {
        return fallback; // apontador: valor residual no IndexedDB não é aguardado no caminho síncrono
      }
      return readThrough(storage, key, fallback);
    },
    write(key, value) {
      return writeThrough(storage, quotaKeys.has(key) ? fallbackIdb : null, key, value, quotaKeys);
    },
    readText(key, fallback = "") {
      return readTextThrough(storage, key, fallback);
    },
    writeText(key, value) {
      try {
        storage.setItem(key, value);
        return value;
      } catch (error) {
        if (fallbackIdb && isQuotaExceededError(error) && quotaKeys.has(key)) {
          storage.setItem(key, `${IDB_REF_PREFIX}${key}`);
          fallbackIdb.save(key, value);
          return value;
        }
        throw error;
      }
    },
    remove(key) {
      storage.removeItem(key);
      fallbackIdb?.remove(key);
    },
  };
}

export function defaultPlannerDoc() {
  return { fields: {}, checks: {}, checklist: {}, priorities: {} };
}

// Leitura resiliente do documento do planner: corrupção é descartada e
// substituída por um fallback seguro, nunca quebrando a aplicação.

export function loadPlanner(storage = window.localStorage, key = PLANNER_STORAGE_KEYS.planner) {
  const defaults = defaultPlannerDoc();
  try {
    const raw = storage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return defaults;
    return {
      fields: parsed.fields && typeof parsed.fields === "object" ? parsed.fields : {},
      checks: parsed.checks && typeof parsed.checks === "object" ? parsed.checks : {},
      checklist: parsed.checklist && typeof parsed.checklist === "object" ? parsed.checklist : {},
      priorities: parsed.priorities && typeof parsed.priorities === "object" ? parsed.priorities : {},
    };
  } catch {
    storage.removeItem(key);
    return defaults;
  }
}

// Escrita atrasada (debounce) para agrupar alterações rápidas de digitação
// e checagem em uma única serialização do plannerDoc, evitando escritas
// síncronas excessivas no localStorage.

export function createDebouncedPersist(writePlanner, delay = 350, timerWindow = window) {
  let timerId = null;
  return function debouncedPersist(...args) {
    timerWindow.clearTimeout(timerId);
    timerId = timerWindow.setTimeout(() => writePlanner(...args), delay);
  };
}
