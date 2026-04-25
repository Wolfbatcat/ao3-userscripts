/**
 * Sheet Operations for Script Sync
 * Direct interaction with Storage and Settings sheets
 */

/**
 * Get all storage data from the Storage sheet
 * @returns {Object} Key-value pairs from storage
 */
function getStorageData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const storageSheet = ss.getSheetByName(STORAGE_SHEET_NAME);
  
  if (!storageSheet) {
    throw new Error('Storage sheet not found');
  }
  
  const lastRow = storageSheet.getLastRow();
  if (lastRow < 2) {
    return {};
  }
  
  const data = storageSheet.getRange(2, 1, lastRow - 1, 3).getValues();
  const storage = {};
  
  for (let i = 0; i < data.length; i++) {
    const key = data[i][0];
    const value = data[i][1];
    const timestamp = data[i][2];
    if (key) {
      storage[key] = {
        value: value !== null && value !== undefined ? value.toString() : '',
        timestamp: timestamp ? (parseInt(timestamp) || 0) : 0
      };
    }
  }
  
  return storage;
}

/**
 * Get a specific storage value
 * @param {string} key - Storage key
 * @returns {string|null} Storage value or null if not found
 */
function getStorageValue(key) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const storageSheet = ss.getSheetByName(STORAGE_SHEET_NAME);
  
  if (!storageSheet) {
    return null;
  }
  
  const lastRow = storageSheet.getLastRow();
  if (lastRow < 2) {
    return null;
  }
  
  const data = storageSheet.getRange(2, 1, lastRow - 1, 3).getValues();
  
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      return {
        value: data[i][1] !== null && data[i][1] !== undefined ? data[i][1].toString() : '',
        timestamp: data[i][2] ? (parseInt(data[i][2]) || 0) : 0
      };
    }
  }
  
  return null;
}

/**
 * Set a storage value (update existing or append new)
 * @param {string} key - Storage key
 * @param {string} value - Storage value
 */
function setStorageValue(key, value, timestamp) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const storageSheet = ss.getSheetByName(STORAGE_SHEET_NAME);
  
  if (!storageSheet) {
    throw new Error('Storage sheet not found');
  }
  
  // Convert value to string
  const stringValue = value !== null && value !== undefined ? value.toString() : '';
  const ts = timestamp || Date.now();
  
  // Find existing row or append new one
  const lastRow = storageSheet.getLastRow();
  const data = lastRow >= 2 ? storageSheet.getRange(2, 1, lastRow - 1, 1).getValues() : [];
  
  let rowIndex = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      rowIndex = i + 2; // +2 because we start from row 2
      break;
    }
  }
  
  if (rowIndex > 0) {
    // Update existing row (value in col B, timestamp in col C)
    storageSheet.getRange(rowIndex, 2, 1, 2).setValues([[stringValue, ts]]);
    storageSheet.getRange(rowIndex, 4).setFormula(
      `=IF(C${rowIndex}="","",TEXT((C${rowIndex}/1000/86400)+DATE(1970,1,1),"yyyy-mm-dd hh:mm:ss")&" UTC")`
    );
  } else {
    // Append new row
    const newRow = storageSheet.getLastRow() + 1;
    storageSheet.getRange(newRow, 1, 1, 3).setValues([[key, stringValue, ts]]);
    storageSheet.getRange(newRow, 4).setFormula(
      `=IF(C${newRow}="","",TEXT((C${newRow}/1000/86400)+DATE(1970,1,1),"yyyy-mm-dd hh:mm:ss")&" UTC")`
    );
  }
}

/**
 * Delete a storage key
 * @param {string} key - Storage key to delete
 * @returns {boolean} True if key was found and deleted
 */
function deleteStorageKey(key) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const storageSheet = ss.getSheetByName(STORAGE_SHEET_NAME);
  
  if (!storageSheet) {
    return false;
  }
  
  const lastRow = storageSheet.getLastRow();
  if (lastRow < 2) {
    return false;
  }
  
  const data = storageSheet.getRange(2, 1, lastRow - 1, 1).getValues();
  
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      storageSheet.deleteRow(i + 2); // +2 because we start from row 2
      return true;
    }
  }
  
  return false;
}

/**
 * Set multiple storage values at once
 * @param {Object} keyValuePairs - Object with key-value pairs
 */
function setMultipleStorageValues(keyValuePairs) {
  if (!keyValuePairs || typeof keyValuePairs !== 'object') {
    return;
  }
  
  for (const key in keyValuePairs) {
    if (keyValuePairs.hasOwnProperty(key)) {
      setStorageValue(key, keyValuePairs[key]);
    }
  }
}

/**
 * Clear all data from the Storage sheet (keeps header row if exists)
 */
function clearStorageSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const storageSheet = ss.getSheetByName(STORAGE_SHEET_NAME);
  
  if (!storageSheet) {
    return;
  }
  
  const lastRow = storageSheet.getLastRow();
  if (lastRow >= 2) {
    storageSheet.deleteRows(2, lastRow - 1);
  }
}

/**
 * Get the list of enabled sync keys from Settings
 * @returns {Array} Array of enabled key names
 */
function getEnabledSyncKeys() {
  const keysString = getConfigValue('_sync_enabled_keys', '');
  return parseCommaSeparated(keysString);
}

/**
 * Set the list of enabled sync keys in Settings
 * @param {Array} keys - Array of key names to enable
 */
function setEnabledSyncKeys(keys) {
  if (!Array.isArray(keys)) {
    keys = [];
  }
  
  const keysString = arrayToCommaSeparated(keys);
  setConfigValue('_sync_enabled_keys', keysString);
}

/**
 * Check if database is initialized
 * @returns {boolean} True if initialized
 */
function isDatabaseInitialized() {
  const connectedFlag = getConfigValue('_connected_to_AO3', false);
  return connectedFlag === true || connectedFlag === 'TRUE' || connectedFlag === 'true';
}
