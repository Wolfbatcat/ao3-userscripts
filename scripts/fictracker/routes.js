// Handles HTTP GET requests, routing based on 'action' parameter (e.g., 'ping', 'get_last_modified').
// Returns appropriate responses or error for unknown actions, with error logging.
function doGet(e) {
  try {
    const action = e.parameter.action;
    switch (action) {
      case 'get_last_modified': return handleGetLastModified();
      case 'ping': return handlePing();
      default: return createErrorResponse('Invalid action');
    }
  } catch (err) {
    console.error('[FicTracker] GET error:', err);
    return createErrorResponse(err.message);
  }
}

// Handles HTTP POST requests, routing based on JSON 'action' field in the request body.
// Supports batch updates, note updates, sync, and initialization actions.
// Returns appropriate success or error responses with error logging.
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const { action } = data;
    
    switch (action) {
      case 'batch_update': return handleBatchUpdate(data.operations);
      case 'batch_notes': return handleBatchNotes(data.noteUpdates);
      case 'sync': return handleSync(data.queue);
      case 'initialize': return handleInitialize(data.initData);
      default: return createErrorResponse('Invalid action');
    }
  } catch (err) {
    console.error('[FicTracker] POST error:', err);
    return createErrorResponse(err.message);
  }
}

// Handles HTTP OPTIONS requests to support CORS preflight checks,
// setting appropriate headers to allow cross-origin POST requests.
function doOptions(e) {
  return ContentService.createTextOutput()
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}


// Processes the initialization action from client, invoking sheet setup with provided initial data.
// Returns success or error responses and logs errors if initialization fails.
function handleInitialize(initData) {
  try {
    message = initializeSheet(initData);
    return createSuccessResponse({
      message
    });
  } catch (err) {
    console.error('[FicTracker] Initialization error:', err);
    return createErrorResponse(err.message);
  }
}

// Performs the actual Google Sheet initialization by clearing caches,
// appending key-value data rows (except user notes) to the storage sheet,
// setting config flags, and saving user notes separately.
// Logs progress and warnings if already initialized.
function initializeSheet(initData) {
  console.log('[FicTracker] Starting initialization process...');
  
  const cache = CacheService.getScriptCache();
  cache.remove('config');
  
  let settings = get_config();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  
  if (settings._last_modified || settings._connected_to_AO3) {
    console.warn('[FicTracker] Initialization aborted: DB already initialized.');
    return 'DB already initialized! You are good to go :)'
  }
  
  // Extract FT_userNotes and process separately
  const userNotes = initData.FT_userNotes;
  delete initData.FT_userNotes; // Remove from main data
  
  // Prepare rows to append: [key, value]
  const rows = [];
  Object.keys(initData).forEach(key => {
    rows.push([key, initData[key]]);
    console.log(`[FicTracker] Adding key: ${key}`);
  });
  
  updateLastModified();
  // set config _connected_to_AO3 TRUE
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Settings").getRange("B3").setValue(true)
  
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 2).setValues(rows);
  console.log('[FicTracker] Initialization complete: rows appended to sheet.');
  
  // Handle user notes separately if they exist
  if (userNotes) {
    console.log('[FicTracker] Processing user notes...');
    const notesData = JSON.parse(userNotes);
    saveNotesData(notesData);
    console.log('[FicTracker] User notes initialized in UserNotes sheet.');
  }
  
  return 'Successfully initialized DB!'
}
