// Responds to test ping from client to confirm Google Apps Script endpoint is accessible.
// Returns a basic success response to indicate the connection is alive.
function handlePing() {
  return createSuccessResponse("Connection established!")
}

// Handles the full synchronization request from client:
// processes pending tag operations and note updates,
// then returns the updated server state including all statuses and notes.
// Applies GZIP compression to the response if enabled in config.
function handleSync(queue) {
    const results = {
      operations: null,
      notes: null,
      success: true
    };

    // Process regular status(tags) changes if they exist
    if (queue.operations && queue.operations.length > 0) {
      console.log(`[FicTracker] Processing ${queue.operations.length} operations`);
      const opResult = handleBatchUpdate(queue.operations);
      results.operations = JSON.parse(opResult.getContent());
    }
    
    // Process notes if they exist
    if (queue.notes && queue.notes.length > 0) {
      console.log(`[FicTracker] Processing ${queue.notes.length} note updates`);
      const noteResult = batchManageNotes(queue.notes);
      results.notes = noteResult;
    }
  
    // Always return the current state
    const allData = handleGetAll();

    data= {
        success: true,
        update_results: results,
        status_data: allData.statuses,
        notes: allData.notes
    }
    
    let response = null;
    const apply_gzip = get_config()['_apply_gzip']

    // Save bandwith by gzipping DB data
    if (apply_gzip) {
      data = gzipPack(data);
      response = ContentService.createTextOutput(data).setMimeType(ContentService.MimeType.TEXT);
    } else {
         return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
    }

    return response;
}

// Retrieves all stored fanfic statuses and user notes from the Google Sheet,
// decompressing any GZIP-compressed data where needed.
// Returns structured object with both statuses and notes.
function handleGetAll() {
  const dataMap = getSheetData();
  const result = {};

  for (const [key, data] of Object.entries(dataMap)) {
      try {
        result[key] = decompressTextBGzip(data.value);
      } catch (err) {
        console.warn(`[FicTracker] Decompression failed for "${key}", using raw value`);
        result[key] = data.value;
      }

  }

  // Get user notes
  const notesData = getAllNotesData();

  return {
    statuses: result,
    notes: notesData
  };
}

// Returns the last modified timestamp stored in the configuration,
// used by client to detect changes on the server side.
function handleGetLastModified() {
  return createSuccessResponse({ last_modified: getLastModified() });
}

// Extracts the "_last_modified" value from cached or live config sheet.
// Used to track when the data was last changed for sync purposes.
function getLastModified() {
  const lastModified = get_config()['_last_modified']
  return lastModified;
}

// Processes an array of operations (add/remove/set) to update fanfic statuses,
// compresses and writes updated data to the sheet,
// creates or updates rows as needed, and updates the last modified timestamp.
// Uses locking to ensure safe concurrent execution.
// Returns a success response with operation summary or an error message.
function handleBatchUpdate(operations) {
  if (!Array.isArray(operations) || operations.length === 0) {
    return createErrorResponse('Operations array required');
  }

  let lock = null;

  try {
    lock = acquireLock();

    if (!lock) {
      return createErrorResponse('Operation currently in progress. Please try again.');
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const dataMap = getSheetData();
    const updates = {};

    for (const op of operations) {
      const { action, key, value } = op;
      let currentData = updates[key] || (dataMap[key] ? decompressTextBGzip(dataMap[key].value).split(',') : []);

      switch (action) {
        case 'add':
          if (!currentData.includes(value)) currentData.push(value);
          break;
        case 'remove':
          const idx = currentData.indexOf(value);
          if (idx > -1) currentData.splice(idx, 1);
          break;
        case 'set':
          currentData = Array.isArray(value) ? value : [value];
          break;
        default:
          console.warn(`Unknown action "${action}" for key "${key}"`);
          continue;
      }
      updates[key] = currentData;
    }

    const rowsToUpdate = [];
    const rowsToAppend = [];

    for (const [key, data] of Object.entries(updates)) {
      const cleaned = data.filter(s => s !== '' && s != null);
      const compressed = compressTextBGzip(cleaned.join(','));
      if (dataMap[key]) {
        rowsToUpdate.push({ row: dataMap[key].row, value: compressed });
      } else {
        rowsToAppend.push([key, compressed]);
      }
    }

    rowsToUpdate.forEach(u => sheet.getRange(u.row, 2).setValue(u.value));
    if (rowsToAppend.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, 2).setValues(rowsToAppend);
    }

    // Ensure all changes are written before releasing the lock
    SpreadsheetApp.flush();

    updateLastModified();

    return createSuccessResponse({
      updated: Object.keys(updates).length,
      operations_processed: operations.length
    });

  } catch (err) {
    console.error('[FicTracker] Error in handleBatchUpdate: ' + err.message);
    return createErrorResponse('An unexpected error occurred: ' + err.message);
  } finally {
    releaseLock(lock);
  }
}

// Returns the user note for a specific fanfic ID from the notes sheet.
// Provides a success response containing the note object.
function handleGetNote(fanficId) {
  const note = getNote(fanficId);
  return createSuccessResponse(note);
}

// Returns all user notes stored on the server in a success response.
// Useful for restoring the full state on client initialization.
function handleGetAllNotes() {
  const notes = getAllNotesData();
  return createSuccessResponse(notes);
}

// Accepts an array of user note updates and applies them to the server sheet.
// Returns JSON-encoded response with the outcome of the update process.
function handleBatchNotes(noteUpdates) {
  const result = batchManageNotes(noteUpdates);
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
