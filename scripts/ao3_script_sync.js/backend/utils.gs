/**
 * Utility Functions for Script Sync
 * Response builders, lock management, error handling
 */

/**
 * Create a success response
 * @param {*} data - Response data
 * @returns {ContentService.TextOutput} JSON response
 */
function createSuccessResponse(data) {
  const response = {
    status: 'success',
    data: data,
    timestamp: new Date().toISOString()
  };
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Create an error response
 * @param {string} message - Error message
 * @param {number} code - Error code (optional)
 * @returns {ContentService.TextOutput} JSON response
 */
function createErrorResponse(message, code) {
  const response = {
    status: 'error',
    error: {
      message: message,
      code: code || 500
    },
    timestamp: new Date().toISOString()
  };
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Acquire a script lock with timeout
 * @param {number} timeout - Timeout in milliseconds (default: 5000)
 * @returns {Lock} Lock object or null if failed
 */
function acquireLock(timeout) {
  timeout = timeout || 5000;
  const lock = LockService.getScriptLock();
  
  try {
    lock.waitLock(timeout);
    return lock;
  } catch (e) {
    Logger.log('Failed to acquire lock: ' + e.toString());
    return null;
  }
}

/**
 * Release a script lock
 * @param {Lock} lock - Lock object to release
 */
function releaseLock(lock) {
  if (lock) {
    try {
      SpreadsheetApp.flush();
      lock.releaseLock();
    } catch (e) {
      Logger.log('Error releasing lock: ' + e.toString());
    }
  }
}

/**
 * Set CORS headers for the response
 * @returns {ContentService.TextOutput} Response with CORS headers
 */
function createCorsResponse() {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Validate that required sheets exist
 * @returns {Object} Object with validation result
 */
function validateSheetStructure() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const storageSheet = ss.getSheetByName(STORAGE_SHEET_NAME);
  const settingsSheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
  
  const errors = [];
  
  if (!storageSheet) {
    errors.push('Storage sheet not found');
  }
  
  if (!settingsSheet) {
    errors.push('Settings sheet not found');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Log an error with context
 * @param {string} context - Where the error occurred
 * @param {Error} error - The error object
 */
function logError(context, error) {
  const message = context + ': ' + error.toString();
  Logger.log(message);
  
  // Could also log to a sheet for debugging if needed
  // Uncomment to enable error logging to sheet:
  // try {
  //   const ss = SpreadsheetApp.getActiveSpreadsheet();
  //   const errorLog = ss.getSheetByName('ErrorLog');
  //   if (errorLog) {
  //     errorLog.appendRow([new Date(), context, error.toString()]);
  //   }
  // } catch (e) {
  //   Logger.log('Failed to log error to sheet: ' + e.toString());
  // }
}

/**
 * Parse comma-separated string into array
 * @param {string} str - Comma-separated string
 * @returns {Array} Array of trimmed values
 */
function parseCommaSeparated(str) {
  if (!str || typeof str !== 'string') {
    return [];
  }
  
  return str.split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

/**
 * Convert array to comma-separated string
 * @param {Array} arr - Array of values
 * @returns {string} Comma-separated string
 */
function arrayToCommaSeparated(arr) {
  if (!Array.isArray(arr)) {
    return '';
  }
  
  return arr.join(',');
}
