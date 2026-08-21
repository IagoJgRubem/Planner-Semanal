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
