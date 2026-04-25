/**
 * Request Handlers for Script Sync
 * Business logic for all API endpoints
 */

/**
 * Handle ping request - test connectivity
 * @returns {ContentService.TextOutput} Success response
 */
function handlePing() {
  return createSuccessResponse('Connection established!');
}

/**
 * Handle get_last_modified request
 * @returns {ContentService.TextOutput} Last modified timestamp
 */
function handleGetLastModified() {
  const lastModified = getConfigValue('_last_modified', new Date().toISOString());
  
  return createSuccessResponse({
    last_modified: lastModified
  });
}

/**
 * Handle get_storage request
 * Returns storage data for requested keys
 * When requestedKeys is empty/null, returns metadata (enabled_keys) for server probing
 * @param {Array} requestedKeys - Array of keys to retrieve (empty for metadata probe)
 * @returns {ContentService.TextOutput} Storage data for requested keys or metadata
 */
function handleGetStorage(requestedKeys) {
  try {
    // If no keys requested, return metadata for server probing (enables fresh device sync)
    if (!requestedKeys || !Array.isArray(requestedKeys) || requestedKeys.length === 0) {
      const isInitialized = isDatabaseInitialized();
      const enabledKeys = isInitialized ? getEnabledSyncKeys() : [];
      const allStorageData = isInitialized ? getStorageData() : {};
      const result = {};
      
      // Return data for all enabled keys
      enabledKeys.forEach(key => {
        if (allStorageData.hasOwnProperty(key)) {
          result[key] = allStorageData[key];
        }
      });
      
      return createSuccessResponse({
        initialized: isInitialized,
        enabled_keys: enabledKeys,
        storage_data: result,
        count: Object.keys(result).length
      });
    }
    
    // Normal request path - return requested keys
    const allStorageData = getStorageData();
    const result = {};
    
    // Filter to only requested keys
    requestedKeys.forEach(key => {
      if (allStorageData.hasOwnProperty(key)) {
        result[key] = allStorageData[key];
      }
    });
    
    return createSuccessResponse({
      storage_data: result,
      count: Object.keys(result).length
    });
  } catch (error) {
    logError('handleGetStorage', error);
    return createErrorResponse('Failed to retrieve storage data: ' + error.toString(), 500);
  }
}

/**
 * Handle initialization request
 * Sets up the database with initial data
 * @param {Object} initData - Initial data to populate (key-value pairs)
 * @param {Array} selectedKeys - Array of keys selected for syncing
 * @param {boolean} force - If true, clear existing data and re-initialize
 * @returns {ContentService.TextOutput} Success or error response
 */
function handleInitialize(initData, selectedKeys, force) {
  // Validate sheet structure
  const validation = validateSheetStructure();
  if (!validation.valid) {
    return createErrorResponse('Sheet structure invalid: ' + validation.errors.join(', '), 500);
  }
  
  // Check if already initialized (unless force is true)
  if (!force && isDatabaseInitialized()) {
    return createErrorResponse('Database already initialized. Use "Reset Sync Settings" to re-initialize.', 400);
  }
  
  // Acquire lock for initialization
  const lock = acquireLock(10000);
  if (!lock) {
    return createErrorResponse('Could not acquire lock. Please try again.', 503);
  }
  
  try {
    // Clear existing data
    clearStorageSheet();
    
    // If force is true with no data, we're just clearing - don't mark as initialized
    const isClearing = force && (!initData || Object.keys(initData).length === 0) && (!selectedKeys || selectedKeys.length === 0);
    
    // Set initial data
    if (initData && typeof initData === 'object') {
      setMultipleStorageValues(initData);
    }
    
    // Set enabled sync keys
    if (selectedKeys && Array.isArray(selectedKeys)) {
      setEnabledSyncKeys(selectedKeys);
    }
    
    // Mark as initialized (unless we're just clearing)
    if (!isClearing) {
      setConfigValue('_connected_to_AO3', 'TRUE');
    } else {
      // Clear the initialized flag
      setConfigValue('_connected_to_AO3', '');
    }
    
    // Update last modified timestamp
    updateLastModified();
    
    releaseLock(lock);
    
    return createSuccessResponse({
      message: isClearing ? 'Successfully cleared server data!' : 'Successfully initialized database!',
      keys_synced: selectedKeys || []
    });
  } catch (error) {
    releaseLock(lock);
    logError('handleInitialize', error);
    return createErrorResponse('Initialization failed: ' + error.toString(), 500);
  }
}

/**
 * Handle sync request
 * Processes pending changes and returns current server state
 * @param {Object} queue - Queue object with operations array
 * @returns {ContentService.TextOutput} Updated storage data
 */
function handleSync(queue) {
  // Validate that database is initialized
  if (!isDatabaseInitialized()) {
    return createErrorResponse('Database not initialized. Please initialize first.', 400);
  }
  
  // Acquire lock for sync operation
  const lock = acquireLock(5000);
  if (!lock) {
    return createErrorResponse('Sync in progress. Please wait.', 503);
  }
  
  try {
    let operationsProcessed = 0;
    
    // Pre-load existing storage for timestamp-based conflict resolution
    const existingStorage = getStorageData();
    
    // Process operations if provided
    if (queue && queue.operations && Array.isArray(queue.operations)) {
      for (let i = 0; i < queue.operations.length; i++) {
        const op = queue.operations[i];
        
        if (!op.key) {
          continue;
        }
        
        // Handle set operation (update or create)
        if (op.value !== null && op.value !== undefined) {
          // Timestamp conflict resolution: only write if incoming is newer or equal
          const existing = existingStorage[op.key];
          const storedTimestamp = existing ? (existing.timestamp || 0) : 0;
          const incomingTimestamp = op.timestamp || 0;
          if (incomingTimestamp >= storedTimestamp) {
            setStorageValue(op.key, op.value, incomingTimestamp || Date.now());
            operationsProcessed++;
          } else {
            Logger.log('Skipping stale update for key: ' + op.key + ' (incoming: ' + incomingTimestamp + ', stored: ' + storedTimestamp + ')');
          }
        } else {
          // Handle delete operation (value is null/undefined)
          deleteStorageKey(op.key);
          operationsProcessed++;
        }
      }
    }
    
    // Update last modified timestamp
    updateLastModified();
    
    // Get current enabled keys
    const enabledKeys = getEnabledSyncKeys();
    
    // Get all storage data (re-read after writes)
    const allStorageData = getStorageData();
    
    // Filter to only enabled keys — return full {value, timestamp} objects
    const storageData = {};
    for (let i = 0; i < enabledKeys.length; i++) {
      const key = enabledKeys[i];
      if (allStorageData.hasOwnProperty(key)) {
        storageData[key] = allStorageData[key];
      }
    }
    
    releaseLock(lock);
    
    return createSuccessResponse({
      success: true,
      update_results: {
        operations_processed: operationsProcessed
      },
      storage_data: storageData,
      enabled_keys: enabledKeys
    });
  } catch (error) {
    releaseLock(lock);
    logError('handleSync', error);
    return createErrorResponse('Sync failed: ' + error.toString(), 500);
  }
}

/**
 * Handle update enabled keys request
 * Updates the list of keys that should be synced
 * @param {Array} enabledKeys - Array of key names to enable
 * @returns {ContentService.TextOutput} Success response
 */
function handleUpdateEnabledKeys(enabledKeys) {
  if (!isDatabaseInitialized()) {
    return createErrorResponse('Database not initialized. Please initialize first.', 400);
  }
  
  if (!Array.isArray(enabledKeys)) {
    return createErrorResponse('enabledKeys must be an array', 400);
  }
  
  const lock = acquireLock(5000);
  if (!lock) {
    return createErrorResponse('Operation in progress. Please wait.', 503);
  }
  
  try {
    setEnabledSyncKeys(enabledKeys);
    updateLastModified();
    
    releaseLock(lock);
    
    return createSuccessResponse({
      message: 'Enabled keys updated successfully',
      enabled_keys: enabledKeys
    });
  } catch (error) {
    releaseLock(lock);
    logError('handleUpdateEnabledKeys', error);
    return createErrorResponse('Failed to update enabled keys: ' + error.toString(), 500);
  }
}
