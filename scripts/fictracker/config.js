const SHEET_NAME = 'Storage';
const LAST_MODIFIED_KEY = '_last_modified';
const CACHE_DURATION = 300; // 5 minutes
const APPLY_GZIP = false;

// Loads configuration key-value pairs from the "Settings" sheet, with fallback to 5-minute cache.
// If cached config is available and valid, it's returned immediately for performance.
// Otherwise, reads and parses sheet rows (starting from row 2), builds the config object,
// caches it, and returns it. Logs both cached and fresh loads for visibility.
function get_config() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('config');
  if (cached) {
    try {
      console.info(`[FicTracker] Loaded config from cache: ${cached}`)
      return JSON.parse(cached);
    } catch (e) {
      console.error(e);
    }
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const config = {};

  for (const [key, value] of data) {
    if (key != null && key !== '') {
      config[String(key).trim()] = value;
    }
  }

  // Cache for 5 minutes
  cache.put('config', JSON.stringify(config), CACHE_DURATION);

  console.log('[FicTracker] Loaded config:', config);
  return config;
}