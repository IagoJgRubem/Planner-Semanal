export function createAudioNoteStore({ databaseName = "planner-audio-notes-v1", storeName = "notes" } = {}) {
  let databasePromise;

  function openDatabase() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return databasePromise;
  }

  async function transact(mode, operation) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = operation(store);
      transaction.oncomplete = () => resolve(request?.result);
      transaction.onerror = () => reject(transaction.error);
      request?.addEventListener("error", () => reject(request.error));
    });
  }

  return {
    save(key, blob) {
      return transact("readwrite", (store) => store.put(blob, key));
    },
    load(key) {
      return transact("readonly", (store) => store.get(key));
    },
    remove(key) {
      return transact("readwrite", (store) => store.delete(key));
    },
  };
}
