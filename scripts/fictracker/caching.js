const cache = CacheService.getScriptCache();

// Retrieves JSON-parsed data from the Apps Script cache for a given key.
// Returns `null` if the key is not found or cache has expired.
function getCachedData(key) {
  const data = cache.get(key);
  return data ? JSON.parse(data) : null;
}

// Stores JSON-stringified value in the Apps Script cache under the given key,
// with an optional expiration duration (default: CACHE_DURATION seconds).
function setCachedData(key, value, duration = CACHE_DURATION) {
  cache.put(key, JSON.stringify(value), duration);
}

// Removes a specific key (default: 'sheet_data') from the Apps Script cache,
// effectively forcing a fresh read from the sheet on next access.
// Logs the invalidation for visibility/debugging.
function invalidateCache(key = 'sheet_data') {
  cache.remove(key);
  console.log(`[FicTracker] Cache invalidated for key "${key}"`);
}
