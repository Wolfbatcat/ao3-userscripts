// Retrieves all key-value pairs from the storage sheet, using cache for efficiency.
// On cache miss, reads from the sheet, builds a map of {key: {value, row}}, caches it, and returns the map.
function getSheetData() {
  const cacheKey = 'sheet_data';
  const cached = getCachedData(cacheKey);
  if (cached) {
    console.log('[FicTracker] Cache hit for sheet data');
    return cached;
  }

  console.log('[FicTracker] Cache miss. Fetching data from sheet.');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  const data = sheet.getRange(2, 1, lastRow, 2).getValues();

  const dataMap = {};
  for (let i = 0; i < data.length; i++) {
    const [key, value] = data[i];
    if (key) {
      dataMap[key] = { value, row: i + 2 };
    }
  }

  setCachedData(cacheKey, dataMap);
  return dataMap;
}

// Updates the "_last_modified" timestamp in the Settings sheet to the current ISO datetime,
// logs the update, and invalidates the relevant cache to ensure fresh data is read next time.
function updateLastModified() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Settings");
  const timestamp = new Date().toISOString();
  sheet.getRange("B2").setValue(timestamp);
  console.log(`[FicTracker] Last modified updated to ${timestamp}`);
  invalidateCache();
}
