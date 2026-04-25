/**
 * Configuration Management for Script Sync
 * Handles caching and retrieval of settings from the Settings sheet
 */

// Cache duration: 5 minutes (300 seconds)
const CACHE_DURATION = 300;

// Sheet names
const STORAGE_SHEET_NAME = 'Storage';
const SETTINGS_SHEET_NAME = 'Settings';

/**
 * Get configuration from Settings sheet with caching
 * @returns {Object} Configuration key-value pairs
 */
function getConfig() {
  const cache = CacheService.getScriptCache();
  const cachedConfig = cache.get('config');
  
  if (cachedConfig) {
    try {
      return JSON.parse(cachedConfig);
    } catch (e) {
      Logger.log('Error parsing cached config: ' + e.toString());
    }
  }
  
  // Cache miss - read from sheet
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
  
  if (!settingsSheet) {
    Logger.log('Settings sheet not found');
    return {};
  }
  
  const lastRow = settingsSheet.getLastRow();
  if (lastRow < 2) {
    return {};
  }
  
  const data = settingsSheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const config = {};
  
  for (let i = 0; i < data.length; i++) {
    const key = data[i][0];
    const value = data[i][1];
    if (key) {
      config[key] = value;
    }
  }
  
  // Cache the config
  cache.put('config', JSON.stringify(config), CACHE_DURATION);
  
  return config;
}

/**
 * Get a specific config value
 * @param {string} key - Configuration key
 * @param {*} defaultValue - Default value if key not found
 * @returns {*} Configuration value
 */
function getConfigValue(key, defaultValue) {
  const config = getConfig();
  return config.hasOwnProperty(key) ? config[key] : defaultValue;
}

/**
 * Set a config value in the Settings sheet
 * @param {string} key - Configuration key
 * @param {*} value - Configuration value
 */
function setConfigValue(key, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
  
  if (!settingsSheet) {
    throw new Error('Settings sheet not found');
  }
  
  // Find existing row or append new one
  const lastRow = settingsSheet.getLastRow();
  const data = settingsSheet.getRange(2, 1, Math.max(1, lastRow - 1), 1).getValues();
  
  let rowIndex = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      rowIndex = i + 2; // +2 because we start from row 2
      break;
    }
  }
  
  if (rowIndex > 0) {
    // Update existing row
    settingsSheet.getRange(rowIndex, 2).setValue(value);
  } else {
    // Append new row
    settingsSheet.appendRow([key, value]);
  }
  
  // Clear cache
  clearConfigCache();
}

/**
 * Clear the configuration cache
 */
function clearConfigCache() {
  const cache = CacheService.getScriptCache();
  cache.remove('config');
}

/**
 * Update the last modified timestamp
 */
function updateLastModified() {
  const timestamp = new Date().toISOString();
  setConfigValue('_last_modified', timestamp);
}
