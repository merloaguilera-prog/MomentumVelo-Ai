(function (root) {
  "use strict";
  function clearLocalData(storages) {
    let removed = 0;
    let failed = false;
    for (const storage of storages) {
      try {
        const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
          .filter(key => typeof key === "string" && key.startsWith("momentumvelo."));
        for (const key of keys) {
          try { storage.removeItem(key); removed++; } catch (_) { failed = true; }
        }
      } catch (_) { failed = true; }
    }
    return { removed, failed };
  }
  const api = { clearLocalData };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MomentumVeloAccountData = api;
})(typeof window !== "undefined" ? window : globalThis);
