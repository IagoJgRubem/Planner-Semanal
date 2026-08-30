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

export function createJSONStore(storage = window.localStorage) {
  return {
    read(key, fallback) {
      try {
        const raw = storage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        storage.removeItem(key);
        return fallback;
      }
    },
    write(key, value) {
      storage.setItem(key, JSON.stringify(value));
      return value;
    },
    readText(key, fallback = "") {
      return storage.getItem(key) ?? fallback;
    },
    writeText(key, value) {
      storage.setItem(key, value);
      return value;
    },
    remove(key) {
      storage.removeItem(key);
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
